// Cartridge Studio: pick what to make, then edit it while it runs. Kit games
// (things, rooms and rules on one runtime) and template projects (the classic
// shooter) each have their own editor; both rebuild the ROM 300 ms after
// every change and reload the preview.

import { useEffect, useState } from "react";
import { CARTRIDGE_EXTENSION, readCartridgeFile, writeCartridgeFile } from "./files/cartridge-file.ts";
import { slugify, sourceZip } from "./files/exports.ts";
import { encodeRgbaPng } from "./files/png.ts";
import { KitEditor } from "./kit/KitEditor.tsx";
import { KIT_PRESETS } from "./kit/presets.ts";
import { useKitStore } from "./kit/store.ts";
import { loadSession, saveMode, saveProject, type EditorMode } from "./project/persist.ts";
import { useProjectStore } from "./project/store.ts";
import { TEMPLATES, getTemplate } from "./project/templates.ts";
import { SpriteEditor } from "./sprite/SpriteEditor.tsx";
import { GraphicsPanel, RulesPanel, SettingsPanel, SoundsPanel } from "./ui/panels.tsx";
import { PreviewPanel } from "./ui/PreviewPanel.tsx";
import { PrintPanel } from "./ui/PrintPanel.tsx";
import { StartChooser, type StartChoice } from "./ui/StartChooser.tsx";
import { TopBar } from "./ui/TopBar.tsx";
import { download, usePreview } from "./ui/usePreview.ts";

const SAVE_DEBOUNCE_MS = 500;

export function App() {
  const [mode, setMode] = useState<EditorMode | null | "loading">("loading");
  const [choosing, setChoosing] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadSession(TEMPLATES).then((s) => {
      if (cancelled) return;
      if (s.project) useProjectStore.getState().load(s.project);
      if (s.kit) useKitStore.getState().load(s.kit);
      setMode(s.mode === "kit" && s.kit ? "kit" : s.mode === "template" && s.project ? "template" : null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const switchTo = (m: EditorMode) => {
    setMode(m);
    void saveMode(m);
  };

  const choose = (c: StartChoice) => {
    setChoosing(false);
    if (c.kind === "kit") {
      useKitStore.getState().load(structuredClone(KIT_PRESETS.find((p) => p.id === c.preset)!.game));
      switchTo("kit");
    } else {
      useProjectStore.getState().load(structuredClone(getTemplate(c.template).sample));
      switchTo("template");
    }
  };

  const open = async (file: File) => {
    const opened = readCartridgeFile(new Uint8Array(await file.arrayBuffer()), TEMPLATES);
    const r = opened.result;
    if (!r.ok) {
      setOpenError(`Couldn't open ${file.name}: ${r.errors.join(" ")}`);
      return;
    }
    const title = "kit" in r ? r.kit.title : r.project.title;
    if (!confirm(`Open "${title}"? The game you're editing will be replaced.`)) return;
    setOpenError(null);
    if ("kit" in r) {
      useKitStore.getState().load(r.kit);
      switchTo("kit");
    } else {
      useProjectStore.getState().load(r.project);
      switchTo("template");
    }
  };

  const onNew = () => setChoosing(true);

  if (mode === "loading") return <div className="page loading">Loading…</div>;
  if (mode === null) return <StartChooser onChoose={choose} />;

  return (
    <>
      {openError && (
        <p className="error banner" role="alert">
          {openError}{" "}
          <button type="button" className="link" onClick={() => setOpenError(null)}>
            Dismiss
          </button>
        </p>
      )}
      {mode === "kit" ? (
        <KitEditor key="kit" onOpen={(f) => void open(f)} onNew={onNew} />
      ) : (
        <TemplateEditor key="template" onOpen={(f) => void open(f)} onNew={onNew} />
      )}
      {choosing && (
        <StartChooser
          onChoose={(c) => {
            if (confirm("Start a new game? The one you're editing will be replaced; save it first to keep it.")) choose(c);
          }}
          onCancel={() => setChoosing(false)}
        />
      )}
    </>
  );
}

function TemplateEditor({ onOpen, onNew }: { onOpen: (file: File) => void; onNew: () => void }) {
  const project = useProjectStore((s) => s.project);
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const { edit, undo, redo } = useProjectStore.getState();
  const template = getTemplate(project.template.id);
  const preview = usePreview(project);
  const [selectedSprite, setSelectedSprite] = useState<string | null>(
    () => template.manifest.sprites.find((s) => s.editable)?.role ?? null,
  );

  useEffect(() => {
    window.__cs!.store = useProjectStore;
  }, []);

  // Autosave.
  useEffect(() => {
    const timer = setTimeout(() => void saveProject(project), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [project]);

  const cartridgeFile = async () => {
    const shot = await preview.screenshot().catch(() => undefined);
    return writeCartridgeFile(project, shot && encodeRgbaPng(shot.width, shot.height, shot.rgba));
  };

  return (
    <div className="page">
      <TopBar
        title={project.title}
        onTitle={(t) => edit((d) => void (d.title = t), "title")}
        kind={template.manifest.name}
        canUndo={canUndo}
        canRedo={canRedo}
        undo={undo}
        redo={redo}
        onOpen={onOpen}
        onSave={async () => download(await cartridgeFile(), `${slugify(project.title)}${CARTRIDGE_EXTENSION}`)}
        onNew={onNew}
      />

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
          <PreviewPanel
            preview={preview}
            title={project.title}
            extraDownloads={
              <button
                type="button"
                className="secondary"
                title="game.bas and its graphics, for 7800basic"
                onClick={() => download(sourceZip(project, template), `${slugify(project.title)}-source.zip`)}
                disabled={preview.result?.kind === "invalid"}
              >
                Export source
              </button>
            }
          />
          <PrintPanel
            template={template}
            screenshot={preview.screenshot}
            buildSigned={preview.buildSigned}
            cartridgeFile={cartridgeFile}
            onDownload={download}
          />
          <details className="panel code">
            <summary>View code</summary>
            <pre data-testid="game-bas">{preview.lastGood?.source ?? ""}</pre>
          </details>
        </div>
      </main>
    </div>
  );
}
