// The kit editor: things, the room, rules and settings on the left and in the
// middle; the running game, the CPU meter and downloads on the right.

import { useEffect, useState } from "react";
import { writeCartridgeFile } from "../files/cartridge-file.ts";
import { CARTRIDGE_EXTENSION } from "../files/cartridge-file.ts";
import { slugify } from "../files/exports.ts";
import { encodeRgbaPng } from "../files/png.ts";
import { saveKitGame } from "../project/persist.ts";
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

export function KitEditor({ onOpen, onNew }: { onOpen: (file: File) => void; onNew: () => void }) {
  const game = useKitStore((s) => s.project);
  const canUndo = useKitStore((s) => s.past.length > 0);
  const canRedo = useKitStore((s) => s.future.length > 0);
  const { edit, undo, redo } = useKitStore.getState();
  const preview = usePreview(game);
  const [selected, setSelected] = useState<string | null>(() => game.types[0]?.id ?? null);

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
      <main className="editor-layout">
        <div className="column">
          <ThingsPanel selected={selected} onSelect={setSelected} />
        </div>
        <div className="column">
          <RoomPainter />
          <KitRulesPanel />
        </div>
        <div className="column preview-column">
          <PreviewPanel preview={preview} title={game.title} />
          <section className="panel" aria-label="Console time">
            <CpuMeter />
          </section>
          <KitSettingsPanel />
          <details className="panel code">
            <summary>View code</summary>
            <pre data-testid="game-bas">{preview.lastGood?.source ?? ""}</pre>
          </details>
        </div>
      </main>
    </div>
  );
}
