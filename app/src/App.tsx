// M1 editor: project store -> code generator -> build worker -> preview.
// Every edit rebuilds the ROM 300 ms later and reloads the preview.

import { useEffect, useRef, useState } from "react";
import { InlineBuildService, WorkerBuildService, type BuildService, type ReadyInfo } from "./build/build-service.ts";
import type { ProjectBuildResult } from "./build/project-build.ts";
import { WorkerEmulator } from "./emulator/worker-emulator.ts";
import { loadSavedProject, saveProject } from "./project/persist.ts";
import { useProjectStore } from "./project/store.ts";
import { TEMPLATES, getTemplate } from "./project/templates.ts";
import { SpriteEditor } from "./sprite/SpriteEditor.tsx";
import { GraphicsPanel, RulesPanel, SettingsPanel, SoundsPanel } from "./ui/panels.tsx";
import { PrintPanel } from "./ui/PrintPanel.tsx";
import { CARTRIDGE_EXTENSION, readCartridgeFile, writeCartridgeFile } from "./files/cartridge-file.ts";
import { slugify as slug, sourceZip } from "./files/exports.ts";
import { encodeRgbaPng } from "./files/png.ts";
import type { Screenshot } from "./print/pdf.ts";

const BUILD_DEBOUNCE_MS = 300;
const SAVE_DEBOUNCE_MS = 500;

type Built = Extract<ProjectBuildResult, { kind: "built" }>;

interface BuildRecord {
  n: number;
  kind: ProjectBuildResult["kind"];
  cached: boolean;
  /** From the edit settling (debounce over) to the ROM in hand. */
  wallMs: number;
  generateMs: number;
  buildMs: number;
}

declare global {
  interface Window {
    /** Hooks for the Playwright tests. */
    __cs?: {
      store: typeof useProjectStore;
      service?: BuildService;
      /** Creates a separate worker service, e.g. with a short timeout. */
      createService?: (opts: ConstructorParameters<typeof WorkerBuildService>[0]) => BuildService;
      emulator?: WorkerEmulator;
      ready?: ReadyInfo;
      builds: BuildRecord[];
      last?: ProjectBuildResult;
    };
  }
}

function download(data: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([data as Uint8Array<ArrayBuffer>], { type: "application/octet-stream" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


function isTextField(t: EventTarget | null) {
  return t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && t.type !== "range" && t.type !== "checkbox");
}

export function App() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadSavedProject(TEMPLATES).then((saved) => {
      if (cancelled) return;
      useProjectStore.getState().load(saved ?? structuredClone(getTemplate("fixed-shooter").sample));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return loaded ? <Editor /> : <div className="page loading">Loading…</div>;
}

function Editor() {
  const project = useProjectStore((s) => s.project);
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const { edit, undo, redo, load } = useProjectStore.getState();
  const template = getTemplate(project.template.id);

  const [ready, setReady] = useState<ReadyInfo | null>(null);
  const [building, setBuilding] = useState(false);
  const [result, setResult] = useState<ProjectBuildResult | null>(null);
  const [lastGood, setLastGood] = useState<Built | null>(null);
  const [record, setRecord] = useState<BuildRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [selectedSprite, setSelectedSprite] = useState<string | null>(
    () => template.manifest.sprites.find((s) => s.editable)?.role ?? null,
  );

  const service = useRef<BuildService | null>(null);
  const emulator = useRef<WorkerEmulator | null>(null);
  const emuContainer = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const counter = useRef(0);

  // Build service and emulator, once.
  useEffect(() => {
    window.__cs = { store: useProjectStore, builds: [], createService: (opts) => new WorkerBuildService(opts) };
    const inline = new URLSearchParams(location.search).get("builder") === "inline";
    const s: BuildService = inline ? new InlineBuildService() : new WorkerBuildService();
    service.current = s;
    window.__cs.service = s;
    s.ready.then(
      (info) => {
        console.info(
          `[toolchain] ${info.toolchainVersion} ready in ${info.totalMs.toFixed(0)} ms ` +
            `(fetch ${info.fetchMs.toFixed(0)}, compile ${info.compileMs.toFixed(0)})`,
        );
        window.__cs!.ready = info;
        setReady(info);
      },
      (e: unknown) => setError(`The game builder couldn't start: ${String(e)}`),
    );
    // A canvas can hand its drawing to a worker only once, so each mount gets a fresh one.
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    canvas.className = "screen";
    canvas.setAttribute("aria-label", "Game preview");
    emuContainer.current!.replaceChildren(canvas);
    const emu = new WorkerEmulator(canvas);
    emulator.current = emu;
    window.__cs.emulator = emu;
    return () => {
      s.dispose();
      emu.dispose();
      emulator.current = null;
    };
  }, []);

  // Rebuild 300 ms after the last edit. A newer build cancels an older one.
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(async () => {
      setBuilding(true);
      const t0 = performance.now();
      // Previews skip signing: it's most of the build time and emulators don't check it.
      const r = await service.current!.build(project, { sign: false });
      if (r.kind === "cancelled") return;
      const rec: BuildRecord = {
        n: ++counter.current,
        kind: r.kind,
        cached: r.kind === "built" && r.cached,
        wallMs: performance.now() - t0,
        generateMs: r.generateMs,
        buildMs: r.buildMs,
      };
      console.info(
        `[build #${rec.n}] ${r.kind}${rec.cached ? " (cached)" : ""} in ${rec.wallMs.toFixed(1)} ms ` +
          `(generate ${r.generateMs.toFixed(1)}, toolchain ${r.buildMs.toFixed(1)})`,
      );
      if (r.kind === "built") {
        // Report "up to date" only once the preview is running the new ROM.
        try {
          await emulator.current?.load(r.a78, "a78");
        } catch (e) {
          setError(`The preview couldn't start this ROM: ${String(e)}`);
        }
        setLastGood(r);
      } else if (r.kind === "failed") {
        console.error(`[build] ${r.stage}: ${r.message}\n${r.log}`);
      }
      window.__cs!.builds.unshift(rec);
      window.__cs!.last = r;
      setRecord(rec);
      setResult(r);
      setBuilding(false);
    }, BUILD_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [project, ready]);

  // Downloads are always signed, so they boot on a real console. They run on a
  // separate worker so they don't cancel the preview build.
  /** A signed build of the current project, on its own worker so the preview isn't cancelled. */
  const buildSigned = async (): Promise<{ a78: Uint8Array; bin: Uint8Array }> => {
    const exporter = new WorkerBuildService();
    try {
      const r = await exporter.build(project, { sign: true });
      if (r.kind === "built" && r.signed) return { a78: r.a78, bin: r.bin };
      if (r.kind === "invalid") throw new Error(r.errors.join(" "));
      throw new Error("We couldn't build this game for download; your work is saved.");
    } finally {
      exporter.dispose();
    }
  };

  const exportRom = async (format: "a78" | "bin") => {
    setExporting(true);
    try {
      const rom = await buildSigned();
      download(format === "a78" ? rom.a78 : rom.bin, `${slug(project.title)}.${format}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  const screenshot = async (): Promise<Screenshot | undefined> => {
    const emu = emulator.current;
    if (!emu || !lastGood) return undefined;
    return { width: 320, height: 240, rgba: await emu.readPixels(0, 0, 320, 240) };
  };

  const cartridgeFile = async () => {
    const shot = await screenshot().catch(() => undefined);
    return writeCartridgeFile(project, shot && encodeRgbaPng(shot.width, shot.height, shot.rgba));
  };

  const fileInput = useRef<HTMLInputElement>(null);
  const openFile = async (file: File) => {
    const opened = readCartridgeFile(new Uint8Array(await file.arrayBuffer()), TEMPLATES);
    if (!opened.result.ok) {
      setError(`Couldn't open ${file.name}: ${opened.result.errors.join(" ")}`);
      return;
    }
    if (confirm(`Open "${opened.result.project.title}"? The game you're editing will be replaced.`)) {
      setError(null);
      load(opened.result.project);
    }
  };

  // Autosave.
  useEffect(() => {
    const timer = setTimeout(() => void saveProject(project), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [project]);

  // Undo / redo shortcuts (text fields keep their own undo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z" || isTextField(e.target)) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const status = !ready
    ? "Starting the game builder…"
    : building
      ? "Building…"
      : result?.kind === "built"
        ? `Up to date · ${record!.wallMs.toFixed(0)} ms${record!.cached ? " (cached)" : ""}`
        : result?.kind === "invalid"
          ? "Needs a fix"
          : result?.kind === "failed"
            ? "We couldn't build this game; your work is saved."
            : "";

  return (
    <div className="page">
      <header className="topbar">
        <h1>Cartridge Studio</h1>
        <input
          className="title-input"
          aria-label="Game title"
          value={project.title}
          maxLength={60}
          onChange={(e) => edit((d) => void (d.title = e.target.value), "title")}
        />
        <span className="muted small">{template.manifest.name}</span>
        <span className="spacer" />
        <button type="button" className="secondary" onClick={undo} disabled={!canUndo} title="Undo (⌘Z)">
          Undo
        </button>
        <button type="button" className="secondary" onClick={redo} disabled={!canRedo} title="Redo (⇧⌘Z)">
          Redo
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={CARTRIDGE_EXTENSION}
          hidden
          aria-label="Open game file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void openFile(file);
          }}
        />
        <button type="button" className="secondary" onClick={() => fileInput.current?.click()}>
          Open…
        </button>
        <button
          type="button"
          className="secondary"
          onClick={async () => download(await cartridgeFile(), `${slug(project.title)}${CARTRIDGE_EXTENSION}`)}
        >
          Save game file
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            if (confirm("Start over from the template's sample game? Your current game will be replaced.")) {
              load(structuredClone(template.sample));
            }
          }}
        >
          Start over
        </button>
      </header>

      <main className="editor-layout">
        <div className="column">
          <GraphicsPanel template={template} selected={selectedSprite} onSelect={setSelectedSprite} />
          <SettingsPanel template={template} />
          <SoundsPanel template={template} />
        </div>
        <div className="column">
          {selectedSprite && <SpriteEditor key={selectedSprite} template={template} role={selectedSprite} />}
          <RulesPanel template={template} />
        </div>
        <div className="column preview-column">
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
              <button
                type="button"
                className="secondary"
                disabled={!lastGood || exporting}
                onClick={() => void exportRom("a78")}
              >
                Download .a78
              </button>
              <button
                type="button"
                className="secondary"
                disabled={!lastGood || exporting}
                onClick={() => void exportRom("bin")}
              >
                Download .bin
              </button>
              <button
                type="button"
                className="secondary"
                title="game.bas and its graphics, for 7800basic"
                onClick={() => download(sourceZip(project, template), `${slug(project.title)}-source.zip`)}
                disabled={result?.kind === "invalid"}
              >
                Export source
              </button>
              {exporting && <span className="muted small">Preparing download…</span>}
            </div>
          </section>
          <PrintPanel
            template={template}
            screenshot={screenshot}
            buildSigned={buildSigned}
            cartridgeFile={cartridgeFile}
            onDownload={download}
          />
          <details className="panel code">
            <summary>View code</summary>
            <pre data-testid="game-bas">{lastGood?.source ?? ""}</pre>
          </details>
        </div>
      </main>
    </div>
  );
}
