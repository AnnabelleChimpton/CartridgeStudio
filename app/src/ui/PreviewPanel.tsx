// The Play panel: the emulator, its controls, build status and ROM downloads.

import { useState, type ReactNode } from "react";
import { slugify } from "../files/exports.ts";
import { download, type Preview } from "./usePreview.ts";

export function PreviewPanel({ preview, title, extraDownloads }: { preview: Preview; title: string; extraDownloads?: ReactNode }) {
  const { emuContainer, emulator, result, lastGood, status, error, setError, buildSigned } = preview;
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
      <div ref={emuContainer} className="emu" />
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
        <button
          type="button"
          className="secondary"
          onClick={() => void emuContainer.current?.querySelector("canvas")?.requestFullscreen()}
        >
          Fullscreen
        </button>
        <span className="hint">Arrows move · Space fires · Gamepads work too</span>
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
    </section>
  );
}
