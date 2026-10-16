// The Play panel: the emulator, its controls and build status. ROM files,
// build timings, the log and the code are in each editor's Code tab.

import { useState, type ReactNode } from "react";
import type { Preview } from "./usePreview.ts";

interface Props {
  preview: Preview;
  title: string;
  /** Shown under the game, e.g. the console-time meter. */
  meter?: ReactNode;
  /** What to say when the build fails (default: our bug, details in the Code tab). */
  failure?: ReactNode;
}

export function PreviewPanel({ preview, title, meter, failure }: Props) {
  const { emuContainer, stage, enterTv, emulator, result, status, error } = preview;
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);

  return (
    <section className="panel preview" aria-labelledby="preview-h">
      <h2 id="preview-h">Play</h2>
      <div ref={stage} className="tv-stage">
        <p className="tv-title" aria-hidden="true">
          {title}
        </p>
        <div ref={emuContainer} className="emu" />
        <p className="tv-hint" aria-hidden="true">
          Joystick or arrow keys to move · Fire button or Space · Esc to leave
        </p>
      </div>
      <div className="emu-controls">
        <button
          type="button"
          className="secondary"
          onClick={() => {
            emulator.current?.pause(!paused);
            setPaused(!paused);
          }}
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button type="button" className="secondary" onClick={() => emulator.current?.reset()}>
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
          {muted ? "Sound off" : "Sound on"}
        </button>
        <button type="button" className="secondary" onClick={enterTv}>
          Full screen
        </button>
        <span className="hint" id="emu-hint">
          Arrows move, Space fires, Tab leaves. Gamepads work too.
        </span>
      </div>
      <p className={`status ${result?.kind ?? ""}`} data-testid="build-status" role="status">
        {status}
      </p>
      {result?.kind === "invalid" && (
        <ul className="errors" data-testid="build-errors">
          {result.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {result?.kind === "failed" &&
        (failure ?? <p className="muted small">That's a Cartridge Studio bug, not yours. The details are in the Code tab.</p>)}
      {error && <p className="error">{error}</p>}
      {meter}
    </section>
  );
}
