// The Play panel: the emulator, its controls and build status, in plain
// words. ROM files are in Show it; build details and the code are in the
// Code tab.

import { useState, type ReactNode } from "react";
import { Icon } from "./Icon.tsx";
import type { Preview } from "./usePreview.ts";

/** How to play, in the editor and on the TV alike. */
const PLAY_HINT = "Arrow keys or a gamepad to move, Space or the fire button to fire. Esc to stop playing.";

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
  const { emuContainer, stage, enterTv, emulator, result, lastGood, status, error } = preview;
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
          {PLAY_HINT}
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
          <Icon name={paused ? "play" : "pause"} />
          {paused ? "Resume" : "Pause"}
        </button>
        <button type="button" className="secondary" onClick={() => emulator.current?.reset()}>
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
        <button type="button" className="secondary" onClick={enterTv} disabled={!lastGood} title="Full screen, with the title and a gamepad prompt">
          <Icon name="tv" />
          Play on a TV
        </button>
        <span className="hint" id="emu-hint">
          {PLAY_HINT}
        </span>
      </div>
      <p className={`status ${result?.kind ?? ""}`} data-testid="build-status" role="status">
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
        <div className="broken small" data-testid="build-failed">
          <p>
            Something went wrong on our side, not yours. Your work is saved
            {lastGood ? " and the game keeps running the last version that worked." : "."}
          </p>
          <ul>
            <li>Press Undo to take back your last change, and the game should build again.</li>
            <li>If it still doesn't, reload the page: your game comes back as you left it.</li>
            <li>To help us fix it, use Save game file and send us the file with the details from the Code tab.</li>
          </ul>
        </div>
        ))}
      {error && <p className="error">{error}</p>}
      {meter}
    </section>
  );
}
