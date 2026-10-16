// Creator tests (Coder tier): "Record a check" restarts the game from
// power-on and records the joystick while you play; then you say what should
// be true at that moment ("score is at least 50"). Every build runs every
// test in a worker and shows which pass, and the frame a failing one failed
// on. The tests are saved as tests.json beside the game (creator-tests.ts).

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Recording } from "../emulator/protocol.ts";
import type { WatchMap } from "../harness/behaviour.ts";
import type { Preview } from "../ui/usePreview.ts";
import { OPS, addRecordedTest, describeTest, removeTest, testFrames, type CheckTarget, type Op } from "./creator-tests.ts";
import { decodeValue } from "../harness/behaviour.ts";
import { hexAddress, parseSymbolTable, seedWatches } from "./debug.ts";
import type { CreatorTests } from "./useCreatorTests.ts";

interface Props {
  preview: Preview;
  tests: CreatorTests;
  /** The game's known variables by name (KIT_WATCH); those this build has are offered first. */
  known: WatchMap;
}

type Mode = { kind: "idle" } | { kind: "recording" } | { kind: "checking"; rec: Recording };

/** The option that switches the variable picker to a symbol search. */
const SYMBOL = "\0symbol";

export function TestsPanel({ preview, tests, known }: Props) {
  const ids = useId();
  const { emulator, lastGood, setPaused } = preview;
  const { file, setFile, run } = tests;
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [frames, setFrames] = useState(0);
  const [said, setSaid] = useState("");
  const [error, setError] = useState("");

  const symbolText = lastGood?.symbols ?? "";
  const symbolList = useMemo(() => parseSymbolTable(symbolText), [symbolText]);
  const symbols = useMemo(() => new Map(symbolList.map((s) => [s.name, s.address])), [symbolList]);
  const knownHere = useMemo(() => seedWatches(known, symbols), [known, symbols]);

  // The check being written.
  const [name, setName] = useState("");
  const [choice, setChoice] = useState("");
  const [symbol, setSymbol] = useState("");
  const [op, setOp] = useState<Op>("eq");
  const [value, setValue] = useState("");
  const [now, setNow] = useState<number | null>(null);
  const nameField = useRef<HTMLInputElement>(null);
  const recordButton = useRef<HTMLButtonElement>(null);

  const target: CheckTarget | null = useMemo(() => {
    if (choice === SYMBOL) return symbols.has(symbol.trim()) ? { name: symbol.trim(), entry: { symbol: symbol.trim() } } : null;
    const k = knownHere.find((w) => w.label === choice);
    if (!k) return null;
    const { label, ...entry } = k;
    return { name: label, entry };
  }, [choice, symbol, symbols, knownHere]);

  // The chosen variable's value now (the game is paused while a check is written).
  useEffect(() => {
    const emu = emulator.current;
    if (mode.kind !== "checking" || !target || !emu) {
      setNow(null);
      return;
    }
    const base = symbols.get(target.entry.symbol)!;
    let live = true;
    void emu.peek([[base + (target.entry.offset ?? 0), target.entry.bytes ?? 1]]).then((p) => {
      if (!live) return;
      const v = decodeValue(p.bytes[0]!, target.entry.bcd);
      setNow(v);
      setValue(String(v));
    });
    return () => {
      live = false;
    };
  }, [mode, target, symbols, emulator]);

  // Focus follows the flow: into the new check, then back to Record a check once it's saved or discarded.
  const wasChecking = useRef(false);
  useEffect(() => {
    if (mode.kind === "checking") nameField.current?.focus();
    else if (wasChecking.current) recordButton.current?.focus();
    wasChecking.current = mode.kind === "checking";
  }, [mode.kind]);

  // Frames recorded so far, a few times a second.
  useEffect(() => {
    const emu = emulator.current;
    if (mode.kind !== "recording" || !emu) return;
    let last = 0;
    return emu.onFrame((f) => {
      if (performance.now() - last < 250) return;
      last = performance.now();
      setFrames(f);
    });
  }, [mode, emulator]);

  // A new build ends a recording (the worker drops it): say so rather than saving a check against the wrong game.
  const recordedOn = useRef<unknown>(null);
  useEffect(() => {
    if (mode.kind === "recording" && recordedOn.current !== lastGood) {
      setMode({ kind: "idle" });
      setSaid("The game was rebuilt while recording, so the recording stopped. Record the check again.");
    }
  }, [lastGood, mode]);

  const startRecording = async () => {
    const emu = emulator.current;
    if (!emu || !lastGood) return;
    setError("");
    recordedOn.current = lastGood;
    await emu.startRecording();
    setPaused(false);
    setFrames(0);
    setMode({ kind: "recording" });
    setSaid("Recording from power-on. Play the game until the moment to check, then press Add a check.");
    preview.emuContainer.current?.querySelector("canvas")?.focus();
  };

  const stopRecording = async (keep: boolean) => {
    const emu = emulator.current;
    if (!emu) return;
    setPaused(true);
    const rec = await emu.stopRecording();
    if (!keep) {
      setMode({ kind: "idle" });
      setSaid("Recording cancelled. The game is paused.");
      return;
    }
    if (!rec) {
      setMode({ kind: "idle" });
      setSaid("The game was rebuilt while recording, so there's nothing to check. Record again.");
      return;
    }
    setName(`Check ${file.tests.length + 1}`);
    setChoice(knownHere[0]?.label ?? SYMBOL);
    setSymbol("");
    setOp("eq");
    setMode({ kind: "checking", rec });
    setSaid(`Paused at frame ${rec.frames}. Say what should be true now.`);
  };

  const save = () => {
    if (mode.kind !== "checking" || !target) return;
    const n = Number(value);
    if (value.trim() === "" || !Number.isInteger(n)) {
      setError("The value is a whole number, like 50.");
      return;
    }
    try {
      const next = addRecordedTest(file, name, mode.rec, { target, op, value: n });
      setFile(next);
      const t = next.tests.at(-1)!;
      setError("");
      setMode({ kind: "idle" });
      setSaid(`Saved “${t.name}”: ${describeTest(t)} at frame ${mode.rec.frames}. It runs on every build.`);

    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const results = run.status === "done" ? run.results : null;
  const failed = results?.filter((r) => !r.passed).length ?? 0;
  const summary =
    file.tests.length === 0
      ? ""
      : run.status === "running"
        ? "Running the tests…"
        : run.status === "error"
          ? `The test runner stopped: ${run.message}`
          : results
            ? failed
              ? `${failed} of ${results.length} ${results.length === 1 ? "test" : "tests"} failed.`
              : `All ${results.length} ${results.length === 1 ? "test passes" : "tests pass"}.`
            : "";

  const announced = useRef("");
  if (run.status !== "running") announced.current = summary;

  return (
    <section className="creator-tests" aria-labelledby={`${ids}-h`} data-testid="creator-tests">
      <h3 className="section-h" id={`${ids}-h`}>
        Tests
      </h3>
      <p className="muted small">
        Record a check: the game restarts, you play to a moment, then say what should be true then, like “score is at least 50”. Every build replays it and says if it
        still holds. They're saved with the game as tests.json and go out with its source.
      </p>

      {mode.kind === "idle" && (
        <div className="toolbar">
          <button ref={recordButton} type="button" disabled={!lastGood} onClick={() => void startRecording()}>
            Record a check
          </button>
        </div>
      )}
      {mode.kind === "recording" && (
        <div className="recording" role="group" aria-label="Recording">
          <p className="small">
            Recording from power-on: <span data-testid="recorded-frames">{frames}</span> frames. Play, then:
          </p>
          <div className="toolbar">
            <button type="button" onClick={() => void stopRecording(true)}>
              Add a check
            </button>
            <button type="button" className="secondary" onClick={() => void stopRecording(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {mode.kind === "checking" && (
        <form
          className="check-form"
          aria-label="New check"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <p className="small">After {mode.rec.frames} frames from power-on:</p>
          <div className="check-fields">
            <label>
              Name
              <input ref={nameField} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Variable
              <select value={choice} onChange={(e) => setChoice(e.target.value)}>
                {knownHere.map((w) => (
                  <option key={w.label} value={w.label}>
                    {w.label}
                  </option>
                ))}
                <option value={SYMBOL}>A symbol from the build…</option>
              </select>
            </label>
            {choice === SYMBOL && (
              <label>
                Symbol
                <input list={`${ids}-symbols`} value={symbol} autoComplete="off" spellCheck={false} onChange={(e) => setSymbol(e.target.value)} />
                <datalist id={`${ids}-symbols`}>
                  {symbolList
                    .filter((s) => s.area === "ram")
                    .map((s) => (
                      <option key={s.name} value={s.name} label={hexAddress(s.address)} />
                    ))}
                </datalist>
              </label>
            )}
            <label>
              Comparison
              <select value={op} onChange={(e) => setOp(e.target.value as Op)}>
                {OPS.map((o) => (
                  <option key={o.op} value={o.op}>
                    {o.words}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Value
              <input inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} aria-describedby={`${ids}-now`} />
            </label>
          </div>
          <p className="muted small" id={`${ids}-now`} aria-live="polite">
            {target ? (now === null ? "Reading…" : `${target.name} is ${now} now.`) : choice === SYMBOL ? "Type a symbol's name, like score0." : ""}
          </p>
          {error && (
            <p className="error small" role="alert">
              {error}
            </p>
          )}
          <div className="toolbar">
            <button type="submit" disabled={!target}>
              Save the check
            </button>
            <button type="button" className="secondary" onClick={() => setMode({ kind: "idle" })}>
              Discard
            </button>
          </div>
        </form>
      )}

      <p className="visually-hidden" role="status" data-testid="tests-said">
        {said}
      </p>

      {file.tests.length > 0 && (
        <>
          <p className={`small tests-summary ${failed ? "error" : ""}`} data-testid="tests-summary">
            {summary}
          </p>
          {/* Only a finished run's summary is announced, and only when it changes: not on every build. */}
          <p className="visually-hidden" role="status">
            {announced.current}
          </p>
          <ul className="test-list" data-testid="test-list">
            {file.tests.map((t, i) => {
              const r = results?.[i];
              const state = run.status === "running" ? "running" : r ? (r.passed ? "pass" : "fail") : "none";
              return (
                <li key={`${i}-${t.name}`} className={`test ${state}`}>
                  <span className="test-state">{state === "pass" ? "Pass" : state === "fail" ? "Fail" : state === "running" ? "Running" : "Not run"}</span>
                  <span className="test-what">
                    <strong>{t.name}</strong>: {describeTest(t)}, after {testFrames(t.steps)} frames
                    {r && !r.passed && (
                      <span className="test-failure">
                        {" "}
                        Failed at frame {r.frames}. {r.failure?.replace(/^At frame \d+: /, "")}.
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="link small"
                    onClick={() => {
                      setFile(removeTest(file, i));
                      setSaid(`Removed “${t.name}”.`);
                    }}
                  >
                    Remove<span className="visually-hidden"> the test “{t.name}”</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
