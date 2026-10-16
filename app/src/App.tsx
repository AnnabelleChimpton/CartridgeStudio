// Cartridge Studio: pick what to make, then edit it while it runs. Kit games
// (things, rooms and rules on one runtime), template projects (the classic
// shooter) and code projects (game.bas by hand, usually ejected from one of
// the others) each have their own editor, laid out the same way: one job at a
// time in tabs on the left and the running game on the right. All rebuild
// the ROM 300 ms after every change and reload the preview.

import { useEffect, useId, useState } from "react";
import { CodeEditor } from "./code/CodeEditor.tsx";
import { EjectDialog } from "./code/EjectDialog.tsx";
import { blankCodeProject, ejectKit, ejectTemplate } from "./code/eject.ts";
import { CodeTier } from "./code/CodeTier.tsx";
import { useGeneratedDiff } from "./code/useGeneratedDiff.ts";
import { useCodeStore } from "./code/store.ts";
import { CARTRIDGE_EXTENSION, readCartridgeFile, writeCartridgeFile } from "./files/cartridge-file.ts";
import { folderZip, slugify, sourceFiles } from "./files/exports.ts";
import { encodeRgbaPng } from "./files/png.ts";
import { KitEditor } from "./kit/KitEditor.tsx";
import { KIT_PRESETS } from "./kit/presets.ts";
import { useKitStore } from "./kit/store.ts";
import { loadSession, saveMode, saveProject, type EditorMode } from "./project/persist.ts";
import { useProjectStore } from "./project/store.ts";
import { SOUND_LIBRARY, TEMPLATES, getTemplate } from "./project/templates.ts";
import { SpriteEditor } from "./sprite/SpriteEditor.tsx";
import { arrowKeys, tabProps } from "./ui/a11y.ts";
import { GraphicsPanel, RulesPanel, SettingsPanel, SoundsPanel } from "./ui/panels.tsx";
import { PreviewPanel } from "./ui/PreviewPanel.tsx";
import { PrintPanel } from "./ui/PrintPanel.tsx";
import { ShowItPanel } from "./ui/ShowItPanel.tsx";
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
  { id: "code", label: "Code" },
] as const;
type TemplateTab = (typeof TEMPLATE_TABS)[number]["id"];

export function App() {
  const [mode, setMode] = useState<EditorMode | null | "loading">("loading");
  const [choosing, setChoosing] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  /** Asking before ejecting the kit or template game into a code project. */
  const [ejecting, setEjecting] = useState<"kit" | "template" | null>(null);
  const [ejectedFrom, setEjectedFrom] = useState<"kit" | "template" | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadSession(TEMPLATES).then((s) => {
      if (cancelled) return;
      if (s.project) useProjectStore.getState().load(s.project);
      if (s.kit) useKitStore.getState().load(s.kit);
      if (s.code) useCodeStore.getState().load(s.code);
      setMode(
        s.mode === "kit" && s.kit ? "kit" : s.mode === "template" && s.project ? "template" : s.mode === "code" && s.code ? "code" : null,
      );
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
    } else if (c.kind === "code") {
      useCodeStore.getState().load(blankCodeProject());
      setEjectedFrom(null);
      switchTo("code");
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
    const title = "kit" in r ? r.kit.title : "code" in r ? r.code.title : r.project.title;
    if (!confirm(`Open "${title}"? The game you're editing will be replaced.`)) return;
    setOpenError(null);
    if ("kit" in r) {
      useKitStore.getState().load(r.kit);
      switchTo("kit");
    } else if ("code" in r) {
      useCodeStore.getState().load(r.code);
      setEjectedFrom(null);
      switchTo("code");
    } else {
      useProjectStore.getState().load(r.project);
      switchTo("template");
    }
  };

  const onNew = () => setChoosing(true);

  /** Ejects the kit or template game into a code project; the original is kept. */
  const eject = (from: "kit" | "template") => {
    setEjecting(null);
    const code =
      from === "kit"
        ? ejectKit(useKitStore.getState().project, SOUND_LIBRARY)
        : (() => {
            const p = useProjectStore.getState().project;
            return ejectTemplate(p, getTemplate(p.template.id));
          })();
    useCodeStore.getState().load(code);
    setEjectedFrom(from);
    switchTo("code");
  };

  /** The way back from a code project to the kit or template game it came from (or whichever is around). */
  const backFrom = (): { label: string; go: () => void } | undefined => {
    const kit = useKitStore.getState().project;
    const project = useProjectStore.getState().project;
    const to = ejectedFrom ?? (kit ? "kit" : project ? "template" : null);
    if (to === "kit" && kit) return { label: `the kit game “${kit.title || "Untitled"}”`, go: () => switchTo("kit") };
    if (to === "template" && project) return { label: `“${project.title || "Untitled"}”`, go: () => switchTo("template") };
    return undefined;
  };

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
        <KitEditor key="kit" onOpen={(f) => void open(f)} onNew={onNew} onEditAsCode={() => setEjecting("kit")} />
      ) : mode === "code" ? (
        <CodeEditor key="code" onOpen={(f) => void open(f)} onNew={onNew} back={backFrom()} />
      ) : (
        <TemplateEditor key="template" onOpen={(f) => void open(f)} onNew={onNew} onEditAsCode={() => setEjecting("template")} />
      )}
      {ejecting && (
        <EjectDialog
          title={(ejecting === "kit" ? useKitStore.getState().project : useProjectStore.getState().project).title}
          kind={ejecting === "kit" ? "kit game" : "game"}
          replaces={useCodeStore.getState().project?.title}
          onConfirm={() => eject(ejecting)}
          onClose={() => setEjecting(null)}
        />
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

function TemplateEditor({ onOpen, onNew, onEditAsCode }: { onOpen: (file: File) => void; onNew: () => void; onEditAsCode: () => void }) {
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
  const [codeKey, setCodeKey] = useState<string | null>(null);
  const changed = useGeneratedDiff(preview.lastGood?.source);

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
            {tab === "code" && (
              <CodeTier
                preview={preview}
                title={project.title}
                jumps={[
                  {
                    heading: "Rules",
                    items: project.rules.map((r, i) => ({ key: `rule:${i + 1}`, name: `Rule ${i + 1}`, detail: `${r.when} → ${r.then.join(", ")}`, ref: { rule: i + 1 } })),
                  },
                ]}
                selected={codeKey}
                onSelect={setCodeKey}
                changed={changed}
                onExportSource={async () => {
                  const files = sourceFiles(project, template, {
                    symbols: preview.lastGood?.symbols,
                    cartridge: { name: `${slugify(project.title)}${CARTRIDGE_EXTENSION}`, bytes: await cartridgeFile() },
                  });
                  download(folderZip(project.title, "source", files), `${slugify(project.title)}-source.zip`);
                }}
                onEject={onEditAsCode}
              />
            )}
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
          />
          <ShowItPanel preview={preview} title={project.title} print={() => setTab("print")} />
        </div>
      </main>
    </div>
  );
}
