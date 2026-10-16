// The kit editor: one job at a time on the left (things, the room, rules or
// game settings, each with room to work), and the running game on the right.

import { useEffect, useId, useState } from "react";
import { writeCartridgeFile } from "../files/cartridge-file.ts";
import { CARTRIDGE_EXTENSION } from "../files/cartridge-file.ts";
import { slugify } from "../files/exports.ts";
import { encodeRgbaPng } from "../files/png.ts";
import { saveKitGame } from "../project/persist.ts";
import { arrowKeys, tabProps } from "../ui/a11y.ts";
import { PreviewPanel } from "../ui/PreviewPanel.tsx";
import { TopBar } from "../ui/TopBar.tsx";
import { download, usePreview } from "../ui/usePreview.ts";
import { CpuMeter } from "./CpuMeter.tsx";
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

export function KitEditor({ onOpen, onNew }: { onOpen: (file: File) => void; onNew: () => void }) {
  const game = useKitStore((s) => s.project);
  const canUndo = useKitStore((s) => s.past.length > 0);
  const canRedo = useKitStore((s) => s.future.length > 0);
  const { edit, undo, redo } = useKitStore.getState();
  const preview = usePreview(game);
  const [selected, setSelected] = useState<string | null>(() => game.types[0]?.id ?? null);
  const [tab, setTab] = useState<Tab>("things");
  const ids = useId();

  useEffect(() => {
    window.__cs!.kitStore = useKitStore;
  }, []);

  // Autosave.
  useEffect(() => {
    const timer = setTimeout(() => void saveKitGame(game), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [game]);

  const save = async () => {
    const shot = await preview.screenshot().catch(() => undefined);
    download(writeCartridgeFile(game, shot && encodeRgbaPng(shot.width, shot.height, shot.rgba)), `${slugify(game.title)}${CARTRIDGE_EXTENSION}`);
  };

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
            {tab === "things" && <ThingsPanel selected={selected} onSelect={setSelected} />}
            {tab === "room" && <RoomPainter />}
            {tab === "rules" && <KitRulesPanel />}
            {tab === "game" && <KitSettingsPanel />}
          </div>
        </div>
        <div className="play-column">
          <PreviewPanel preview={preview} title={game.title} meter={<CpuMeter />} />
        </div>
      </main>
    </div>
  );
}
