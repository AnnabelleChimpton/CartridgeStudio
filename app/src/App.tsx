// Cartridge Studio: pick what to make, then edit it while it runs. Kit games
// (things, rooms and rules on one runtime) and template projects (the classic
// shooter) each have their own editor, laid out the same way: one job at a
// time in tabs on the left and the running game on the right. Both rebuild
// the ROM 300 ms after every change and reload the preview.

import { useEffect, useId, useState } from "react";
import { CARTRIDGE_EXTENSION, readCartridgeFile, writeCartridgeFile } from "./files/cartridge-file.ts";
import { slugify, sourceZip } from "./files/exports.ts";
import { encodeRgbaPng } from "./files/png.ts";
import { useGuide } from "./kit/guide.ts";
import { KitEditor } from "./kit/KitEditor.tsx";
import { KIT_PRESETS } from "./kit/presets.ts";
import { useKitStore } from "./kit/store.ts";
import { loadSession, saveMode, saveProject, type EditorMode } from "./project/persist.ts";
import { useProjectStore } from "./project/store.ts";
import { TEMPLATES, getTemplate } from "./project/templates.ts";
import { SpriteEditor } from "./sprite/SpriteEditor.tsx";
import { arrowKeys, tabProps } from "./ui/a11y.ts";
import { GraphicsPanel, RulesPanel, SettingsPanel, SoundsPanel } from "./ui/panels.tsx";
import { PreviewPanel } from "./ui/PreviewPanel.tsx";
import { PrintPanel } from "./ui/PrintPanel.tsx";
import { ShowItPanel } from "./ui/ShowItPanel.tsx";
import { ConfirmDialog } from "./ui/Dialog.tsx";
import { StartChooser, type StartChoice } from "./ui/StartChooser.tsx";
import { TopBar } from "./ui/TopBar.tsx";
import { download, usePreview } from "./ui/usePreview.ts";

const SAVE_DEBOUNCE_MS = 500;

const TEMPLATE_TABS = [
  { id: "graphics", label: "Graphics" },
  { id: "rules", label: "Rules" },
  { id: "sounds", label: "Sounds" },
  { id: "settings", label: "Settings" },
  { id: "print", label: "Print" },
] as const;
type TemplateTab = (typeof TEMPLATE_TABS)[number]["id"];

export function App() {
  const [mode, setMode] = useState<EditorMode | null | "loading">("loading");
  const [choosing, setChoosing] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  /** An "are you sure?" waiting for an answer. */
  const [ask, setAsk] = useState<{ title: string; message: string; yes: string; onYes: () => void } | null>(null);

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
      // A new game from a starter opens with its getting-started guide.
      useGuide.getState().start(c.preset);
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
      setOpenError(`Couldn't open ${file.name}: ${r.errors.join(" ")} Pick a file you made with Save game file.`);
      return;
    }
    const title = "kit" in r ? r.kit.title : r.project.title;
    setOpenError(null);
    setAsk({
      title: `Open “${title}”?`,
      message: "The game you're editing now will be replaced. Save it first if you want to keep it.",
      yes: `Open “${title}”`,
      onYes: () => {
        if ("kit" in r) {
          useKitStore.getState().load(r.kit);
          useGuide.getState().start(null, false);
          switchTo("kit");
        } else {
          useProjectStore.getState().load(r.project);
          switchTo("template");
        }
      },
    });
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
            setChoosing(false);
            setAsk({
              title: "Start a new game?",
              message: "The game you're editing now will be replaced. Save it first (Save game file) if you want to keep it.",
              yes: "Start the new game",
              onYes: () => choose(c),
            });
          }}
          onCancel={() => setChoosing(false)}
        />
      )}
      {ask && <ConfirmDialog title={ask.title} message={ask.message} yes={ask.yes} onYes={ask.onYes} onClose={() => setAsk(null)} />}
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
  const [tab, setTab] = useState<TemplateTab>("graphics");
  const ids = useId();

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

      <main className="workspace-layout">
        <div className="workspace">
          <div className="workspace-tabs" role="tablist" aria-label="Edit" onKeyDown={arrowKeys("tab")}>
            {TEMPLATE_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                {...tabProps(tab === t.id)}
                id={`${ids}-${t.id}`}
                aria-controls={`${ids}-panel`}
                className={tab === t.id ? "active" : undefined}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="workspace-panel" role="tabpanel" id={`${ids}-panel`} aria-labelledby={`${ids}-${tab}`}>
            {tab === "graphics" && (
              <div className="graphics-layout">
                <GraphicsPanel template={template} selected={selectedSprite} onSelect={setSelectedSprite} />
                {selectedSprite && <SpriteEditor key={selectedSprite} template={template} role={selectedSprite} />}
              </div>
            )}
            {tab === "rules" && <RulesPanel template={template} />}
            {tab === "sounds" && <SoundsPanel template={template} />}
            {tab === "settings" && <SettingsPanel template={template} />}
            {tab === "print" && (
              <PrintPanel
                template={template}
                screenshot={preview.screenshot}
                buildSigned={preview.buildSigned}
                cartridgeFile={cartridgeFile}
                onDownload={download}
              />
            )}
          </div>
        </div>
        <div className="play-column">
          <PreviewPanel
            preview={preview}
            title={project.title}
            extraDownloads={
              <button
                type="button"
                className="secondary"
                title="Your game as 7800basic code, with its pictures, to keep working on by hand"
                onClick={() => download(sourceZip(project, template), `${slugify(project.title)}-source.zip`)}
                disabled={preview.result?.kind === "invalid"}
              >
                Download the code
              </button>
            }
          />
          <ShowItPanel preview={preview} title={project.title} print={() => setTab("print")} />
        </div>
      </main>
    </div>
  );
}
