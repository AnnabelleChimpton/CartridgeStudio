import { useEffect, useState, type ReactNode } from "react";
import { parseBuildLog } from "../code/build-log.ts";
import type { ConsoleButton, Difficulty, Switches } from "../emulator/emulator.ts";
import { KitText } from "./BrandMark.tsx";
import { Icon } from "./Icon.tsx";
import { toast } from "./Toaster.tsx";
import "./preview-faults.css";
import type { Preview } from "./usePreview.ts";

/** On the TV, for the gamepad in someone's hands. */
const TV_HINT = "Stick or d-pad to move, a face button to fire. Start is Pause. Hold Select, or press Esc, to leave.";
const TV_PAUSED = "Paused. Press Start to carry on.";
const CLICK_HINT = "Click the screen, then press fire.";
const PLAY_HINT = "Arrows or gamepad to move. Space fires. Esc stops.";
/** The console picture, in console pixels. */
const SCREEN_WIDTH = 320;

const BUTTONS: { id: ConsoleButton; label: string }[] = [
  { id: "pause", label: "Pause" },
  { id: "select", label: "Select" },
  { id: "reset", label: "Reset" },
];

interface Props {
  preview: Preview;
  title: string;
  /** Shown under the game, e.g. the kit's busy meter. */
  meter?: ReactNode;
  /** A build error in plain words, and what to do about it when the error itself doesn't say. */
  explainError?: (error: string) => { text: string; help: string | null };
  /** What to say when the build fails (default: our bug, with what to do; details in the Code tab). */
  failure?: ReactNode;
}

export function PreviewPanel({ preview, title, meter, explainError, failure }: Props) {
  const { emuContainer, stage, enterTv, emulator, result, lastGood, status, fill, error, emuFault, restartPreview, paused, setPaused } = preview;
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const scale = useIntegerScale(stage);
  const running = !!lastGood && !emuFault;
  const full = result?.kind === "built" && fill && fill.level !== "ok";

  return (
    <section className="panel preview" aria-labelledby="preview-h">
      <h2 id="preview-h" className="visually-hidden">
        Play
      </h2>
      <div
        ref={stage}
        className={`tv-stage${paused ? " tv-paused" : ""}`}
        style={scale ? ({ "--screen-w": `${SCREEN_WIDTH * scale}px` } as React.CSSProperties) : undefined}
      >
        <p className="tv-title" aria-hidden="true">
          {title}
        </p>
        <div
          ref={emuContainer}
          className="emu"
          onFocus={() => setPlaying(true)}
          onBlur={() => setPlaying(false)}
        />
        <p className="tv-hint" aria-hidden="true">
          {paused ? TV_PAUSED : TV_HINT}
        </p>
        <div className="tv-chin">
          <span className="tv-chin-title" aria-hidden="true">
            <KitText text={title} scale={2} maxChars={Infinity} />
          </span>
          <button
            type="button"
            className="icon"
            aria-label="Sound"
            aria-pressed={!muted}
            onClick={() => {
              emulator.current?.setMuted(!muted);
              setMuted(!muted);
            }}
          >
            <Icon name={muted ? "mute" : "sound"} />
          </button>
          <span className={`power-light${running ? (paused ? " paused" : " on") : ""}`} aria-hidden="true" />
          <span className="power-word" aria-hidden="true">
            <KitText text="Power" scale={1} />
          </span>
        </div>
      </div>
      <p className="hint play-hint" id="emu-hint">
        {playing ? PLAY_HINT : CLICK_HINT}
      </p>
      <div className="console-row" role="group" aria-label="Console">
        {BUTTONS.map((b) => (
          <button key={b.id} type="button" className="keycap" disabled={!running} onClick={() => preview.pressConsole(b.id)}>
            {b.label}
          </button>
        ))}
        <span className="diff-pair">
          <DifficultySwitch side="left" switches={preview.switches} onChange={preview.setDifficulty} />
          <DifficultySwitch side="right" switches={preview.switches} onChange={preview.setDifficulty} />
        </span>
        <button
          type="button"
          className="keycap tv-button"
          onClick={enterTv}
          disabled={!lastGood}
          title="Plug the laptop into the TV with HDMI first. A USB gamepad works."
        >
          Full screen (for a TV)
        </button>
      </div>
      <p className={`status ${result?.kind ?? ""}${full ? " full" : ""}`} data-testid="build-status" role="status">
        {status}
      </p>
      {result?.kind === "invalid" && (
        <>
          <p className="small">
            {lastGood ? "The game keeps running the last version that worked. To play your changes, fix " : "To play the game, fix "}
            {result.errors.length > 1 ? "these" : "this"}:
          </p>
          <ul className="errors" data-testid="build-errors">
            {result.errors.map((e) => {
              const { text, help } = explainError?.(e) ?? { text: e, help: null };
              return (
                <li key={e}>
                  {text}
                  {help && <span className="error-help"> {help}</span>}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {result?.kind === "failed" &&
        (failure ?? (
          <div className="broken small" data-testid="build-failed" role="alert">
            <p>
              {failureHeadline(result.stage)} Your game is saved
              {lastGood ? ", and the last good build still plays." : "."} Press Undo to take back your last change.
            </p>
            <RawLog
              summary={failureDetails(result.stage, result.message, result.log)}
              text={`${result.message}${result.log ? `\n\n${result.log}` : ""}`}
              copyLabel="Copy build log"
            />
          </div>
        ))}
      {emuFault && (
        <div className="error" role="alert" data-testid="emu-fault">
          <p>The game preview stopped. Your game is saved.</p>
          <button
            type="button"
            onClick={() =>
              void restartPreview().then(() => {
                // The new emulator starts running, with the sound as the button says.
                setPaused(false);
                emulator.current?.setMuted(muted);
              })
            }
          >
            <Icon name="restart" />
            Restart the preview
          </button>
          <RawLog text={emuFault} copyLabel="Copy error" />
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {meter}
    </section>
  );
}

/** A two-position slide switch, A or B, drawn the way the console's are. */
function DifficultySwitch({
  side,
  switches,
  onChange,
}: {
  side: keyof Switches;
  switches: Switches | null;
  onChange: (side: keyof Switches, position: Difficulty) => void;
}) {
  const at = switches?.[side];
  const name = side === "left" ? "Left difficulty" : "Right difficulty";
  return (
    <button
      type="button"
      role="switch"
      className="diff-switch"
      aria-checked={at === "A"}
      aria-label={`${name} A`}
      title={at ? `${name}: ${at}` : name}
      disabled={!at}
      onClick={() => at && onChange(side, at === "A" ? "B" : "A")}
    >
      <span className="diff-name" aria-hidden="true">
        {name}
      </span>
      <span className="diff-track" aria-hidden="true">
        <span className="diff-knob" />
      </span>
      <span className="diff-at" aria-hidden="true">
        {at ?? "B"}
      </span>
    </button>
  );
}

/**
 * The largest whole number of screen pixels per console pixel that fits the
 * stage, so every console pixel is the same size. Null below 2: the picture
 * then fits the width.
 */
function useIntegerScale(stage: React.RefObject<HTMLDivElement | null>): number | null {
  const [scale, setScale] = useState<number | null>(null);
  useEffect(() => {
    const el = stage.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      if (document.fullscreenElement === el) return;
      const s = Math.floor((entry?.contentRect.width ?? 0) / SCREEN_WIDTH);
      setScale(s >= 2 ? s : null);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [stage]);
  return scale;
}

/** The first sentence of a failed build: which stage stopped. */
export function failureHeadline(stage: string): string {
  switch (stage) {
    case "worker":
    case "internal":
      return "The game builder stopped.";
    case "timeout":
      return "The build took too long and was stopped.";
    case "toolchain":
      return "The game builder couldn't start.";
    case "7800basic":
      return "The 7800basic compiler stopped.";
    case "dasm":
      return "The dasm assembler stopped.";
    default:
      return `The ${stage} step of the build stopped.`;
  }
}

/** The disclosure's line for a failed build: "Details: dasm, line 212: Branch out of range". */
export function failureDetails(stage: string, message: string, log: string): string {
  const p = parseBuildLog(log).find((x) => x.severity === "error");
  if (!p) return message ? `Details: ${stage}: ${message}` : "Details";
  return `Details: ${p.tool}${p.line !== undefined ? `, line ${p.line}` : ""}: ${p.message}`;
}

/** The raw message or log, one click away, with a copy button. */
function RawLog({ text, copyLabel, summary = "Details" }: { text: string; copyLabel: string; summary?: string }) {
  return (
    <details className="raw-log">
      <summary>{summary}</summary>
      <pre>{text}</pre>
      <button
        type="button"
        className="secondary"
        onClick={() =>
          void navigator.clipboard.writeText(text).then(
            () => toast("Copied"),
            () => toast("Couldn't copy. Select the text above instead."),
          )
        }
      >
        <Icon name="copy" />
        {copyLabel}
      </button>
    </details>
  );
}
