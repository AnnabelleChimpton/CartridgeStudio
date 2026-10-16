// The kit editor: one job at a time on the left (things, the room, rules or
// game settings, each with room to work), and the running game on the right
// with every way to show it off.

import { useEffect, useId, useMemo, useState } from "react";
import { SeeTheCode } from "../code/SeeTheCode.tsx";
import { writeCartridgeFile } from "../files/cartridge-file.ts";
import { CARTRIDGE_EXTENSION } from "../files/cartridge-file.ts";
import { folderZip, kitSourceFiles, slugify } from "../files/exports.ts";
import { encodeRgbaPng } from "../files/png.ts";
import { saveKitGame } from "../project/persist.ts";
import { SOUND_LIBRARY } from "../project/templates.ts";
import { arrowKeys, tabProps } from "../ui/a11y.ts";
import { PreviewPanel } from "../ui/PreviewPanel.tsx";
import { ShowItPanel } from "../ui/ShowItPanel.tsx";
import { TopBar } from "../ui/TopBar.tsx";
import { download, usePreview } from "../ui/usePreview.ts";
import { CpuMeter } from "./CpuMeter.tsx";
import { KitPrint } from "./KitPrint.tsx";
import { KitRulesPanel } from "./KitRulesPanel.tsx";
import { KitSettingsPanel } from "./KitSettingsPanel.tsx";
import { RoomPainter } from "./RoomPainter.tsx";
import { ThingsPanel } from "./ThingsPanel.tsx";
import { useKitStore } from "./store.ts";

const SAVE_DEBOUNCE_MS = 500;

const TABS = [
  { id: "things", label: "Things" },
  { id: "room", label: "Room" },
  { id: "rules", label: "Rules" },
  { id: "game", label: "Game" },
] as const;
type Tab = (typeof TABS)[number]["id"];

interface Props {
  onOpen: (file: File) => void;
  onNew: () => void;
  /** Makes a code project from this game (after asking). */
  onEditAsCode?: () => void;
}

export function KitEditor({ onOpen, onNew, onEditAsCode }: Props) {
  const game = useKitStore((s) => s.project);
  const canUndo = useKitStore((s) => s.past.length > 0);
  const canRedo = useKitStore((s) => s.future.length > 0);
  const { edit, undo, redo } = useKitStore.getState();
  const preview = usePreview(game);
  const [selected, setSelected] = useState<string | null>(() => game.types[0]?.id ?? null);
  const [tab, setTab] = useState<Tab>("things");
  const ids = useId();
  /** What "See the code" marks: the chosen thing, or the rule last clicked or focused. */
  const [codeFocus, setCodeFocus] = useState<{ rule: number } | "thing">("thing");
  const codeSelection = useMemo(() => {
    if (codeFocus !== "thing") return game.rules[codeFocus.rule - 1] ? { ref: codeFocus, name: `Rule ${codeFocus.rule}` } : null;
    const t = game.types.find((x) => x.id === selected);
    return t ? { ref: { thing: t.label, palette: t.palette }, name: t.label } : null;
  }, [codeFocus, selected, game]);
  const selectThing = (id: string | null) => {
    setSelected(id);
    setCodeFocus("thing");
  };
  /** Rules are cards in a list; whichever one is clicked or focused is the selected rule. */
  const noticeRule = (e: React.SyntheticEvent) => {
    const li = (e.target as Element).closest?.("ol.rules > li");
    if (!li?.parentElement) return;
    setCodeFocus({ rule: [...li.parentElement.children].indexOf(li) + 1 });
  };

  useEffect(() => {
    window.__cs!.kitStore = useKitStore;
  }, []);

  // Autosave.
  useEffect(() => {
    const timer = setTimeout(() => void saveKitGame(game), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [game]);

  const cartridgeFile = async () => {
    const shot = await preview.screenshot().catch(() => undefined);
    return writeCartridgeFile(game, shot && encodeRgbaPng(shot.width, shot.height, shot.rgba));
  };
  const save = async () => download(await cartridgeFile(), `${slugify(game.title)}${CARTRIDGE_EXTENSION}`);

  return (
    <div className="page">
      <TopBar
        title={game.title}
        onTitle={(t) => edit((d) => void (d.title = t), "title")}
        kind="Game kit"
        canUndo={canUndo}
        canRedo={canRedo}
        undo={undo}
        redo={redo}
        onOpen={onOpen}
        onSave={() => void save()}
        onNew={onNew}
      />
      <main className="workspace-layout">
        <div className="workspace">
          <div className="workspace-tabs" role="tablist" aria-label="Edit" onKeyDown={arrowKeys("tab")}>
            {TABS.map((t) => (
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
            {tab === "things" && <ThingsPanel selected={selected} onSelect={selectThing} />}
            {tab === "room" && <RoomPainter />}
            {tab === "rules" && (
              <div onFocusCapture={noticeRule} onClickCapture={noticeRule}>
                <KitRulesPanel />
              </div>
            )}
            {tab === "game" && <KitSettingsPanel />}
          </div>
        </div>
        <div className="play-column">
          <PreviewPanel
            preview={preview}
            title={game.title}
            meter={<CpuMeter />}
            code={<SeeTheCode source={preview.lastGood?.source} selection={codeSelection} onEject={onEditAsCode} />}
            extraDownloads={
              <button
                type="button"
                className="secondary"
                title="game.bas and its graphics, for 7800basic"
                disabled={preview.result?.kind === "invalid"}
                onClick={() => download(folderZip(game.title, "source", kitSourceFiles(game, SOUND_LIBRARY)), `${slugify(game.title)}-source.zip`)}
              >
                Export source
              </button>
            }
          />
          <ShowItPanel
            preview={preview}
            title={game.title}
            print={<KitPrint screenshot={preview.screenshot} buildSigned={preview.buildSigned} cartridgeFile={cartridgeFile} onDownload={download} />}
          />
        </div>
      </main>
    </div>
  );
}
