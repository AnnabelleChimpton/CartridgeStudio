// Printing for kit games: the shared print controls over a kit game, with a
// manual drafted from its rules.

import { kitChecklist, kitSourceFiles, packageZip } from "../files/exports.ts";
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
        const [rom, file] = await Promise.all([buildSigned(), cartridgeFile()]);
        return packageZip({ title: game.title, checklist: kitChecklist(game), source: kitSourceFiles(game, SOUND_LIBRARY), ...rom, pdf, cartridgeFile: file });
      }}
      onDownload={onDownload}
    />
  );
}
