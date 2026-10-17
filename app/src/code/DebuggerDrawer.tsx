// The debugger drawer (Coder tier): pause the game and step it 1 or 10 frames,
// watch variables by name (the kit's known ones, or any dasm symbol), see the
// kit's 24 object slots, the measured frame rate, and dasm's listing. It reads
// the running preview through the emulator worker's peek and step messages,
// and keeps to that: no disassembler and no memory editor.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { WatchMap } from "../harness/behaviour.ts";
import type { Preview } from "../ui/usePreview.ts";
import { download } from "../ui/usePreview.ts";
import {
  LOOP_SYMBOLS,
  addSample,
  frameRate,
  hexAddress,
  objectRanges,
  objectSlots,
  parseSymbolTable,
  seedWatches,
  watchRange,
  watchValue,
  type LoopSample,
  type ObjectSlot,
  type Watch,
  type WatchValue,
} from "./debug.ts";

/** How often the drawer reads memory while the game runs. */
const READ_EVERY_MS = 100;

interface Props {
  preview: Preview;
  title: string;
  /** Variables to watch from the start, by name (KIT_WATCH); those this build has are shown. */
  known: WatchMap;
  /** Names for the object table's types, by index (a kit game's things). */
  typeNames?: string[];
  /** The kit's estimate of how busy a frame is, to set beside the measurement. */
  estimate?: string;
}

type Shown = WatchValue & { changed: boolean; was?: number };
type Listing = { status: "none" } | { status: "making" } | { status: "ready"; text: string; build: unknown } | { status: "error"; message: string };

const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName));

export function DebuggerDrawer({ preview, title, known, typeNames, estimate }: Props) {
  const ids = useId();
  const [open, setOpen] = useState(false);
  const { emulator, lastGood, paused, setPaused } = preview;
  const symbolText = lastGood?.symbols ?? "";
  const symbolList = useMemo(() => parseSymbolTable(symbolText), [symbolText]);
  const symbols = useMemo(() => new Map(symbolList.map((s) => [s.name, s.address])), [symbolList]);

  const [watches, setWatches] = useState<Watch[] | null>(null);
  // The known variables, once there's a build to find them in.
  useEffect(() => {
    if (watches === null && symbols.size) setWatches(seedWatches(known, symbols));
  }, [watches, symbols, known]);
  const list = useMemo(() => watches ?? [], [watches]);

  const [values, setValues] = useState<Record<string, Shown>>({});
  const [objects, setObjects] = useState<ObjectSlot[] | null>(null);
  const [samples, setSamples] = useState<LoopSample[]>([]);
  const [frame, setFrame] = useState<number | null>(null);
  const [said, setSaid] = useState("");
  const [pick, setPick] = useState("");
  const [pickError, setPickError] = useState("");
  const [listing, setListing] = useState<Listing>({ status: "none" });
  const drawer = useRef<HTMLDivElement>(null);
  const lastFrame = useRef<number | null>(null);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  /** Reads every watch, the object table and the loop counter in one go. */
  const read = async (): Promise<{ frame: number; values: Record<string, Shown> } | null> => {
    const emu = emulator.current;
    if (!emu || !symbols.size) return null;
    const ranges: [number, number][] = [];
    const watchAt = list.map((w) => {
      const r = watchRange(w, symbols);
      return r ? ranges.push(r) - 1 : -1;
    });
    const objRanges = objectRanges(symbols);
    const objAt = objRanges ? ranges.push(...objRanges) - objRanges.length : -1;
    const lo = symbols.get(LOOP_SYMBOLS[0]);
    const hi = symbols.get(LOOP_SYMBOLS[1]);
    const loopAt = lo !== undefined ? ranges.push([lo, 1], [hi ?? lo, hi === undefined ? 0 : 1]) - 2 : -1;
    const peek = await emu.peek(ranges);
    const before = valuesRef.current;
    // Read again on the same frame (a step's own frame message): keep what the step marked as changed.
    const sameFrame = peek.frame === lastFrame.current;
    lastFrame.current = peek.frame;
    const next: Record<string, Shown> = {};
    list.forEach((w, i) => {
      if (watchAt[i]! < 0) return;
      const v = watchValue(w, peek.bytes[watchAt[i]!]!);
      const old = before[w.label];
      next[w.label] =
        sameFrame && old?.value === v.value ? old : { ...v, changed: old !== undefined && old.value !== v.value, was: old?.value };
    });
    setValues(next);
    setFrame(peek.frame);
    if (objAt >= 0) setObjects(objectSlots(peek.bytes.slice(objAt, objAt + 4)));
    else setObjects(null);
    if (loopAt >= 0) {
      const loops = peek.bytes[loopAt]![0]! + (peek.bytes[loopAt + 1]![0] ?? 0) * 256;
      setSamples((s) => addSample(s, { frame: peek.frame, loops }));
    }
    return { frame: peek.frame, values: next };
  };
  const readRef = useRef(read);
  readRef.current = read;

  // While open: read after frames, at most every READ_EVERY_MS, and after each new build.
  useEffect(() => {
    const emu = emulator.current;
    if (!open || !emu) return;
    let busy = false;
    let last = 0;
    const tick = () => {
      const now = performance.now();
      if (busy || now - last < READ_EVERY_MS) return;
      busy = true;
      last = now;
      void readRef.current().finally(() => (busy = false));
    };
    tick();
    return emu.onFrame(tick);
  }, [open, emulator, lastGood]);

  // Pausing shows the frame it stopped on (the last read may be a few frames old), and a new watch shows its value at once.
  useEffect(() => {
    if (open && paused) void readRef.current();
  }, [open, paused, list]);

  const step = async (n: number) => {
    const emu = emulator.current;
    if (!emu || !lastGood) return;
    if (!paused) setPaused(true);
    await emu.stepFrames(n);
    const r = await read();
    if (!r) return;
    const changes = Object.entries(r.values)
      .filter(([, v]) => v.changed)
      .map(([label, v]) => `${label} ${v.was} to ${v.value}`);
    setSaid(`Frame ${r.frame}, after ${n === 1 ? "1 frame" : `${n} frames`}. ${changes.length ? `Changed: ${changes.join(", ")}.` : "No watched value changed."}`);
  };
  const stepRef = useRef(step);
  stepRef.current = step;

  // Shortcuts while the game or the drawer has focus: "." steps a frame, ">" steps ten (pausing first if need be).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.key !== "." && e.key !== ">") return;
      const active = document.activeElement;
      const inGame = !!active && !!preview.emuContainer.current?.contains(active);
      if (!inGame && !drawer.current?.contains(active)) return;
      e.preventDefault();
      void stepRef.current(e.key === "." ? 1 : 10);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, preview.emuContainer]);

  const addWatch = () => {
    const name = pick.trim();
    if (!name) return;
    if (!symbols.has(name)) {
      setPickError(`This build has no symbol called “${name}”.`);
      return;
    }
    if (list.some((w) => w.label === name)) {
      setPickError(`${name} is already in the list.`);
      return;
    }
    setPickError("");
    setWatches([...list, { label: name, symbol: name }]);
    setPick("");
    setSaid(`Watching ${name}.`);
  };

  const makeListing = async () => {
    setListing({ status: "making" });
    try {
      const text = await preview.buildListing();
      setListing({ status: "ready", text, build: lastGood });
      setSaid(`The listing is ready: ${text.split("\n").length.toLocaleString("en-US")} lines.`);
    } catch (e) {
      setListing({ status: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  const rate = frameRate(samples);
  const inUse = objects?.filter((o) => o.type !== null).length ?? 0;
  const ramCount = symbolList.filter((s) => s.area === "ram").length;

  return (
    <section className="debugger" aria-labelledby={`${ids}-h`} data-testid="debugger">
      <h3 className="section-h debugger-h" id={`${ids}-h`}>
        <button type="button" className="disclosure" aria-expanded={open} aria-controls={`${ids}-body`} onClick={() => setOpen(!open)}>
          Debugger
        </button>
      </h3>
      <div id={`${ids}-body`} ref={drawer} hidden={!open} className="debugger-body">
        {!lastGood ? (
          <p className="muted small">Build the game to debug it.</p>
        ) : (
          <>
            <div className="toolbar debugger-controls" role="group" aria-label="Run the game">
              <button type="button" className="secondary" onClick={() => setPaused(!paused)}>
                {paused ? "Resume" : "Pause"}
              </button>
              <button type="button" className="secondary" disabled={!paused} aria-keyshortcuts="." onClick={() => void step(1)}>
                Step 1 frame
              </button>
              <button type="button" className="secondary" disabled={!paused} aria-keyshortcuts=">" onClick={() => void step(10)}>
                Step 10 frames
              </button>
              <span className="debugger-frame" data-testid="debugger-frame">
                Frame {frame ?? "–"}
              </span>
            </div>
            <p className="muted small">With the game or this drawer focused, press . to step one frame and &gt; to step ten.</p>
            <p className="visually-hidden" role="status" data-testid="debugger-said">
              {said}
            </p>

            <table className="debug-table watch-table" data-testid="watch-list">
              <caption>Watch list</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Address</th>
                  <th scope="col">Hex</th>
                  <th scope="col">Decimal</th>
                  <th scope="col">
                    <span className="visually-hidden">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((w) => {
                  const r = watchRange(w, symbols);
                  const v = values[w.label];
                  return (
                    <tr key={w.label} className={v?.changed ? "changed" : undefined} data-watch={w.label}>
                      <th scope="row">
                        {w.label}
                        {w.label !== w.symbol && <span className="muted small"> {w.symbol}{w.offset ? `+${w.offset}` : ""}</span>}
                      </th>
                      <td>{r ? hexAddress(r[0]) : "not in this build"}</td>
                      <td className="num">{v?.hex ?? "–"}</td>
                      <td className="num">
                        <span className="watch-dec">{v?.value ?? "–"}</span>
                        {v?.changed && <span className="visually-hidden"> (changed from {v.was})</span>}
                      </td>
                      <td>
                        <button type="button" className="link small" onClick={() => setWatches(list.filter((x) => x !== w))}>
                          Remove<span className="visually-hidden"> {w.label}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <form
              className="watch-add"
              onSubmit={(e) => {
                e.preventDefault();
                addWatch();
              }}
            >
              <label htmlFor={`${ids}-pick`}>Watch a symbol</label>
              <input
                id={`${ids}-pick`}
                list={`${ids}-symbols`}
                value={pick}
                autoComplete="off"
                spellCheck={false}
                aria-describedby={`${ids}-pick-hint ${ids}-pick-error`}
                onChange={(e) => setPick(e.target.value)}
              />
              <datalist id={`${ids}-symbols`}>
                {symbolList.map((s) => (
                  <option key={s.name} value={s.name} label={`${hexAddress(s.address)} ${s.area === "ram" ? "RAM" : s.area === "rom" ? "ROM" : ""}`} />
                ))}
              </datalist>
              <button type="submit" className="secondary">
                Add
              </button>
              <span className="muted small" id={`${ids}-pick-hint`}>
                Any name from dasm's symbol table: {ramCount.toLocaleString("en-US")} in RAM, {(symbolList.length - ramCount).toLocaleString("en-US")} more.
              </span>
              <span className="error small" id={`${ids}-pick-error`} role="alert">
                {pickError}
              </span>
            </form>

            <h4 className="debug-sub">Frame time</h4>
            <p className="small" data-testid="frame-time">
              {!symbols.has(LOOP_SYMBOLS[0])
                ? "This program has no loopslo counter, so there's nothing to measure. Add one that goes up once per main-loop pass (as the kit does) to see the frame rate."
                : rate
                  ? `Measured: ${rate.fps.toFixed(1)} fps, ${Number.isFinite(rate.msPerLoop) ? `${rate.msPerLoop.toFixed(1)} ms` : "no complete pass"} per main-loop pass, over the last ${rate.frames} frames. ${rate.frames - rate.fps * (rate.frames / 60) >= 2 ? "Below 60: the main loop takes longer than a frame." : "A full 60: every pass fits in a frame."}`
                  : "Measured: run the game or step it to measure."}
              {estimate && <span className="muted"> {estimate}</span>}
            </p>

            {objects && (
              <details className="debug-objects">
                <summary>
                  Objects: {inUse} of {objects.length} slots in use
                </summary>
                <table className="debug-table" data-testid="object-table">
                  <caption className="visually-hidden">Object slots</caption>
                  <thead>
                    <tr>
                      <th scope="col">Slot</th>
                      <th scope="col">Thing</th>
                      <th scope="col">x</th>
                      <th scope="col">y</th>
                      <th scope="col">Timer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {objects.map((o) => (
                      <tr key={o.slot} className={o.type === null ? "slot-empty" : undefined}>
                        <th scope="row">{o.slot}</th>
                        <td>{o.type === null ? "empty" : (typeNames?.[o.type] ?? `type ${o.type}`)}</td>
                        <td className="num">{o.type === null ? "" : o.x}</td>
                        <td className="num">{o.type === null ? "" : o.y}</td>
                        <td className="num">{o.type === null ? "" : o.timer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}

            <h4 className="debug-sub">Listing</h4>
            <p className="muted small">dasm's assembly listing: every line of game.bas next to the 6502 code and addresses it became. It comes from a separate build of the current game.</p>
            <div className="toolbar">
              <button type="button" className="secondary" disabled={listing.status === "making"} onClick={() => void makeListing()}>
                {listing.status === "ready" ? "Make the listing again" : listing.status === "making" ? "Making the listing…" : "Make the listing"}
              </button>
              {listing.status === "ready" && (
                <button type="button" className="secondary" onClick={() => download(new TextEncoder().encode(listing.text), `${title.trim() ? title.trim().replace(/[^\w-]+/g, "-").toLowerCase() : "game"}.list.txt`, { toast: true })}>
                  Download the listing
                </button>
              )}
            </div>
            {listing.status === "error" && <p className="error small">{listing.message}</p>}
            {listing.status === "ready" && (
              <>
                {listing.build !== lastGood && <p className="small">The game has changed since this listing was made. Press Make the listing again to match it.</p>}
                <pre className="debug-listing" tabIndex={0} role="region" aria-label="dasm listing" data-testid="listing">
                  {listing.text}
                </pre>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
