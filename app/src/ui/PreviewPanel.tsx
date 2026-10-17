// The Play panel: the emulator, its controls and the build's own numbers
// (time, and how full the cartridge is). ROM files are in Show it; the code
// is in the Code tab.

import { useId, useState, type ReactNode } from "react";
import { parseBuildLog } from "../code/build-log.ts";
import { CartridgeStats } from "../code/CartridgeSpace.tsx";
import { kb, type CartFill } from "./build-status.ts";
import { Icon } from "./Icon.tsx";
import { useTier } from "./prefs.ts";
import { toast } from "./Toaster.tsx";
import "./preview-faults.css";
import type { Preview } from "./usePreview.ts";

/** How to play, in the editor and on the TV alike. */
const PLAY_HINT = "Arrow keys or a gamepad to move, Space or the fire button to fire. Esc to stop playing.";
/** On the TV, for the gamepad in someone's hands. */
const TV_HINT = "Stick or d-pad to move, any face button to fire. Start pauses. Select plays again. Hold Select, or press Esc, to leave.";
const TV_PAUSED = "Paused. Press Start to carry on. Hold Select, or press Esc, to leave.";
/** Beside the full-screen button, before anyone presses it. */
export const TV_BUTTON_HINT = "Plug the laptop into the TV with HDMI first; a USB gamepad works.";

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
  const { emuContainer, stage, enterTv, emulator, result, lastGood, status, fill, error, emuFault, restartPreview, paused, setPaused, restart } = preview;
  const [muted, setMuted] = useState(false);
  const tvHint = useId();

  return (
    <section className="panel preview" aria-labelledby="preview-h">
      <h2 id="preview-h">Play</h2>
      <div ref={stage} className={`tv-stage${paused ? " tv-paused" : ""}`}>
        <p className="tv-title" aria-hidden="true">
          {title}
        </p>
        <div ref={emuContainer} className="emu" />
        <p className="tv-hint" aria-hidden="true">
          {paused ? TV_PAUSED : TV_HINT}
        </p>
      </div>
      <div className="emu-controls">
        <button
          type="button"
          className="secondary"
          onClick={() => setPaused(!paused)}
        >
          <Icon name={paused ? "play" : "pause"} />
          {paused ? "Resume" : "Pause"}
        </button>
        <button type="button" className="secondary" onClick={restart}>
          <Icon name="restart" />
          Restart
        </button>
        <button
          type="button"
          className="secondary"
          aria-pressed={muted}
          onClick={() => {
            emulator.current?.setMuted(!muted);
            setMuted(!muted);
          }}
        >
          <Icon name={muted ? "mute" : "sound"} />
          {muted ? "Sound off" : "Sound on"}
        </button>
        <span className="hint" id="emu-hint">
          {PLAY_HINT}
        </span>
      </div>
      <div className="emu-controls tv-row">
        <button type="button" className="secondary" onClick={enterTv} disabled={!lastGood} aria-describedby={tvHint}>
          Full screen (for a TV)
        </button>
        <span className="hint" id={tvHint}>
          {TV_BUTTON_HINT}
        </span>
      </div>
      <p className={`status ${result?.kind ?? ""}`} data-testid="build-status" role="status">
        {status}
      </p>
      {fill && lastGood?.stats && <CartFillMeter fill={fill} stats={lastGood.stats} />}
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

const FILL_WORDS = { ok: "Room to spare", near: "Nearly full", over: "Too big" };

/** "How full the cartridge is": the compiler's ROM report as a bar, with its figures one click away (open in the 7800basic tier). */
function CartFillMeter({ fill, stats }: { fill: CartFill; stats: Parameters<typeof CartridgeStats>[0]["stats"] }) {
  const id = useId();
  const tier = useTier();
  const pct = Math.round((fill.used / fill.total) * 100);
  const text = `${kb(fill.used)} of ${kb(fill.total)} KB`;
  return (
    <div className="cpu-meter cart-fill" data-testid="cart-fill">
      <div className="cpu-label">
        <span id={`${id}-label`}>How full the cartridge is</span>
        <span className={`cpu-word ${fill.level}`}>
          {text}, {FILL_WORDS[fill.level].toLowerCase()}
        </span>
      </div>
      <div
        className="cpu-bar"
        role="meter"
        aria-labelledby={`${id}-label`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, pct)}
        aria-valuetext={`${text}, ${FILL_WORDS[fill.level].toLowerCase()}`}
      >
        <span className={fill.level} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      {/* Keyed by tier, so switching to 7800basic opens it and switching away closes it. */}
      <details key={tier} className="small" open={tier === "7800basic"} data-testid="cartridge-stats">
        <summary>Cartridge stats</summary>
        <CartridgeStats stats={stats} />
      </details>
    </div>
  );
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
            () => toast("Couldn't copy; select the text above instead"),
          )
        }
      >
        <Icon name="copy" />
        {copyLabel}
      </button>
    </details>
  );
}
