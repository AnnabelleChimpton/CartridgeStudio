// The Play panel: the emulator, its controls and build status. ROM files,
// build timings and the generated code are tucked under "For developers".

import { useState, type ReactNode } from "react";
import { slugify } from "../files/exports.ts";
import { download, type Preview } from "./usePreview.ts";

interface Props {
  preview: Preview;
  title: string;
  /** Shown under the game, e.g. the console-time meter. */
  meter?: ReactNode;
  extraDownloads?: ReactNode;
}

export function PreviewPanel({ preview, title, meter, extraDownloads }: Props) {
  const { emuContainer, stage, enterTv, emulator, result, lastGood, status, timing, error, setError, buildSigned } = preview;
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Downloads are always signed, so they boot on a real console.
  const exportRom = async (format: "a78" | "bin") => {
    setExporting(true);
    try {
      const rom = await buildSigned();
      download(format === "a78" ? rom.a78 : rom.bin, `${slugify(title)}.${format}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

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
      {result?.kind === "failed" && (
        <details className="small">
          <summary>Details for the Cartridge Studio team</summary>
          <pre className="log">{`${result.stage}: ${result.message}\n${result.log}`}</pre>
        </details>
      )}
      {error && <p className="error">{error}</p>}
      {meter}
      <details className="dev">
        <summary>For developers</summary>
        <p className="muted small" data-testid="build-timing">
          {timing}
        </p>
        <div className="toolbar">
          <button type="button" className="secondary" disabled={!lastGood || exporting} onClick={() => void exportRom("a78")}>
            Download .a78
          </button>
          <button type="button" className="secondary" disabled={!lastGood || exporting} onClick={() => void exportRom("bin")}>
            Download .bin
          </button>
          {extraDownloads}
          {exporting && <span className="muted small">Preparing download…</span>}
        </div>
        <details className="code">
          <summary>View code</summary>
          <pre data-testid="game-bas">{lastGood?.source ?? ""}</pre>
        </details>
      </details>
    </section>
  );
}
