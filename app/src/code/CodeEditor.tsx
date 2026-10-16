// The code editor (Coder tier): game.bas in CodeMirror, its graphics and a
// 7800basic quick reference in tabs on the left, the running game on the
// right. Like the other editors it rebuilds when you pause; build errors are
// marked on their lines and listed below the code.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CARTRIDGE_EXTENSION, writeCartridgeFile } from "../files/cartridge-file.ts";
import { folderZip, slugify } from "../files/exports.ts";
import { encodeRgbaPng } from "../files/png.ts";
import { saveCodeProject } from "../project/persist.ts";
import { arrowKeys, tabProps } from "../ui/a11y.ts";
import { PreviewPanel } from "../ui/PreviewPanel.tsx";
import { ShowItPanel } from "../ui/ShowItPanel.tsx";
import { TopBar } from "../ui/TopBar.tsx";
import { download, usePreview } from "../ui/usePreview.ts";
import { AssetsPanel } from "./AssetsPanel.tsx";
import type { BasicEditorHandle, GraphicThumbs } from "./BasicEditor.tsx";
import { codeSourceFiles } from "./code-files.ts";
import { parseBuildLog, type BuildProblem } from "./build-log.ts";
import { CartridgeSpace } from "./CartridgeSpace.tsx";
import { RomDownloads } from "./RomDownloads.tsx";
import { CodePrint } from "./CodePrint.tsx";
import { LazyBasicEditor } from "./LazyBasicEditor.tsx";
import { ReferencePanel } from "./ReferencePanel.tsx";
import { insertAfterCursor } from "./source-edit.ts";
import { useCodeStore } from "./store.ts";
import "./code.css";

const SAVE_DEBOUNCE_MS = 500;

const TABS = [
  { id: "code", label: "Code" },
  { id: "assets", label: "Graphics" },
  { id: "reference", label: "Reference" },
] as const;
type Tab = (typeof TABS)[number]["id"];

interface Props {
  onOpen: (file: File) => void;
  onNew: () => void;
  /** The kit or template game this was ejected from, if it's still around. */
  back?: { label: string; go: () => void };
}

export function CodeEditor({ onOpen, onNew, back }: Props) {
  const project = useCodeStore((s) => s.project);
  const canUndo = useCodeStore((s) => s.past.length > 0);
  const canRedo = useCodeStore((s) => s.future.length > 0);
  const { edit, undo, redo } = useCodeStore.getState();
  const preview = usePreview(project);
  const [tab, setTab] = useState<Tab>("code");
  const editor = useRef<BasicEditorHandle | null>(null);
  const ids = useId();

  useEffect(() => {
    window.__cs!.codeStore = useCodeStore;
  }, []);

  // Autosave.
  useEffect(() => {
    const timer = setTimeout(() => void saveCodeProject(project), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [project]);

  const result = preview.result;
  const problems = useMemo<BuildProblem[]>(() => {
    if (!result) return [];
    if (result.kind === "invalid") return result.errors.map((message) => ({ severity: "error", message, tool: "toolchain" }));
    if (result.kind === "failed") {
      const found = parseBuildLog(result.log);
      return found.length ? found : [{ severity: "error", message: `${result.stage}: ${result.message}`, tool: "toolchain" }];
    }
    if (result.kind === "built") return parseBuildLog(result.log ?? "");
    return [];
  }, [result]);
  const errors = problems.filter((p) => p.severity === "error").length;
  const thumbs = useMemo<GraphicThumbs>(
    () =>
      Object.fromEntries(
        project.graphics.map((g) => [g.name.toLowerCase(), { rows: g.rows, colors: project.palettes.find((p) => p.id === g.palette)?.colors ?? [] }]),
      ),
    [project.graphics, project.palettes],
  );
  // Said once per build, politely: what the toolchain thought of game.bas.
  const announcement =
    !result || result.kind === "cancelled"
      ? ""
      : errors === 0
        ? "game.bas builds."
        : `${errors === 1 ? "1 error" : `${errors} errors`} in game.bas${problems[0]?.line !== undefined ? `, first on line ${problems[0].line}` : ""}.`;

  const cartridgeFile = async () => {
    const shot = await preview.screenshot().catch(() => undefined);
    return writeCartridgeFile(project, shot && encodeRgbaPng(shot.width, shot.height, shot.rgba));
  };

  const exportSource = async () => {
    const files = codeSourceFiles(project, {
      symbols: preview.lastGood?.symbols,
      cartridge: { name: `${slugify(project.title)}${CARTRIDGE_EXTENSION}`, bytes: await cartridgeFile() },
    });
    download(folderZip(project.title, "source", files), `${slugify(project.title)}-source.zip`);
  };

  const goToLine = (line: number) => {
    setTab("code");
    // After the Code panel is shown again.
    requestAnimationFrame(() => editor.current?.goTo(line));
  };

  const insertSnippet = (snippet: string) => {
    const cursor = editor.current?.cursor() ?? project.source.length;
    const r = insertAfterCursor(project.source, cursor, snippet);
    edit((d) => void (d.source = r.source));
    goToLine(r.line);
  };

  return (
    <div className="page">
      <TopBar
        title={project.title}
        onTitle={(t) => edit((d) => void (d.title = t), "title")}
        kind="Code project"
        canUndo={canUndo}
        canRedo={canRedo}
        undo={undo}
        redo={redo}
        onOpen={onOpen}
        onSave={async () => download(await cartridgeFile(), `${slugify(project.title)}${CARTRIDGE_EXTENSION}`)}
        onNew={onNew}
      />
      {(project.origin || back) && (
        <p className="code-origin muted small">
          {project.origin && <>Made from {project.origin}. </>}
          {back && (
            <button type="button" className="link" onClick={back.go}>
              Back to {back.label}
            </button>
          )}
        </p>
      )}

      <main className="workspace-layout code-layout">
        <div className="workspace">
          <div className="workspace-tabs" role="tablist" aria-label="Edit" onKeyDown={arrowKeys("tab")}>
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                {...tabProps(tab === t.id)}
                id={`${ids}-${t.id}`}
                aria-controls={`${ids}-${t.id}-panel`}
                className={tab === t.id ? "active" : undefined}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {/* The Code panel stays mounted, so the editor keeps its cursor and undo history. */}
          <div className="workspace-panel code-panel" role="tabpanel" id={`${ids}-code-panel`} aria-labelledby={`${ids}-code`} hidden={tab !== "code"}>
            <div className="code-bar">
              <strong className="code-file">game.bas</strong>
              <span className="muted small code-keys" id={`${ids}-keys`}>
                Tab indents; press Esc then Tab to leave the editor. {isMac() ? "⌘F" : "Ctrl+F"} finds, F8 goes to the next error.
              </span>
            </div>
            <LazyBasicEditor
              value={project.source}
              onChange={(source) => edit((d) => void (d.source = source), "source")}
              label="game.bas"
              describedBy={`${ids}-keys`}
              problems={problems}
              graphics={thumbs}
              handle={editor}
              testId="code-editor"
            />
            <section className="code-problems" aria-labelledby={`${ids}-problems-h`} data-testid="code-problems">
              <h3 id={`${ids}-problems-h`} className="section-h">
                {problems.length === 0 ? "Problems" : `Problems (${problems.length})`}
              </h3>
              {problems.length === 0 ? (
                <p className="muted small">{result?.kind === "built" ? "None: it builds." : "None so far."}</p>
              ) : (
                <ul>
                  {problems.map((p, i) => (
                    <li key={i} className={p.severity}>
                      {p.line !== undefined ? (
                        <button type="button" className="link problem" onClick={() => goToLine(p.line!)}>
                          <span className="problem-kind">{p.severity === "error" ? "Error" : "Warning"}</span> line {p.line}:{" "}
                          {p.message}
                        </button>
                      ) : (
                        <span className="problem">
                          <span className="problem-kind">{p.severity === "error" ? "Error" : "Warning"}</span>: {p.message}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="visually-hidden" aria-live="polite">
                {announcement}
              </p>
            </section>
            <h3 className="section-h">Cartridge</h3>
            <CartridgeSpace stats={preview.lastGood?.stats} source={preview.lastGood?.source} />
            <div className="toolbar">
              <RomDownloads preview={preview} title={project.title} />
              <button type="button" className="secondary" title="game.bas, its graphics and build scripts, for 7800basic" onClick={() => void exportSource()}>
                Export source
              </button>
            </div>
            <details className="small code-log">
              <summary>Build log</summary>
              <p className="muted small" data-testid="build-timing">
                {preview.timing}
              </p>
              <pre className="log">{result?.kind === "failed" ? result.log : (preview.lastGood?.log ?? "")}</pre>
            </details>
          </div>
          {tab === "assets" && (
            <div className="workspace-panel" role="tabpanel" id={`${ids}-assets-panel`} aria-labelledby={`${ids}-assets`}>
              <AssetsPanel onShowLine={goToLine} />
            </div>
          )}
          {tab === "reference" && (
            <div className="workspace-panel" role="tabpanel" id={`${ids}-reference-panel`} aria-labelledby={`${ids}-reference`}>
              <ReferencePanel onInsert={insertSnippet} />
            </div>
          )}
        </div>
        <div className="play-column">
          <PreviewPanel
            preview={preview}
            title={project.title}
            failure={
              <p className="error">
                {errors === 1 ? "1 error" : `${errors} errors`} in game.bas.{" "}
                <button type="button" className="link" onClick={() => setTab("code")}>
                  See the problems
                </button>
              </p>
            }
          />
          <ShowItPanel preview={preview} title={project.title} print={<CodePrint title={project.title} preview={preview} cartridgeFile={cartridgeFile} />} />
        </div>
      </main>
    </div>
  );
}

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
