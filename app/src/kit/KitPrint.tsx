// Printing for kit games: the shared print controls over a kit game, with a
// manual drafted from its rules.

import { KIT_TOOLCHAIN, kitChecklist, kitSourceFiles } from "../files/exports.ts";
import { packageZip } from "../files/package.ts";
import { useRecentClip } from "../files/recent-clip.ts";
import { APP_VERSION } from "../version.ts";
import { KIT_RUNTIME_VERSION } from "./generate.ts";
import { SOUND_LIBRARY } from "../project/templates.ts";
import { draftKitManual, kitPrintSubject } from "../print/subject.ts";
import type { Screenshot } from "../print/pdf.ts";
import { PrintControls, printPdf } from "../ui/PrintPanel.tsx";
import { useKitStore } from "./store.ts";

interface Props {
  screenshot: () => Promise<Screenshot | undefined>;
  buildSigned: () => Promise<{ a78: Uint8Array; bin: Uint8Array }>;
  cartridgeFile: () => Promise<Uint8Array>;
  onDownload: (bytes: Uint8Array, name: string) => void;
}

export function KitPrint({ screenshot, buildSigned, cartridgeFile, onDownload }: Props) {
  const game = useKitStore((s) => s.project);
  const edit = useKitStore((s) => s.edit);
  return (
    <PrintControls
      title={game.title}
      text={game.cartridge.manualText ?? draftKitManual(game)}
      edited={game.cartridge.manualText !== null}
      onText={(t) => edit((d) => void (d.cartridge.manualText = t), "manual")}
      onReset={() => edit((d) => void (d.cartridge.manualText = null))}
      makePdf={(paper) => printPdf(kitPrintSubject(game), paper, screenshot)}
      makePackage={async (pdf) => {
        const [rom, file, { buildPlayerHtml }] = await Promise.all([buildSigned(), cartridgeFile(), import("../player/player.ts")]);
        const pkg = await packageZip({
          kind: "submission",
          title: game.title,
          notes: { name: "CHECKLIST.txt", text: kitChecklist(game) },
          build: { app: APP_VERSION, runtime: `kit runtime ${KIT_RUNTIME_VERSION}`, toolchain: KIT_TOOLCHAIN },
          source: kitSourceFiles(game, SOUND_LIBRARY),
          ...rom,
          pdf,
          cartridgeFile: file,
          player: await buildPlayerHtml(game.title, rom.a78),
          clip: useRecentClip.getState().gif,
        });
        return pkg.zip;
      }}
      onDownload={onDownload}
    />
  );
}
