// Printing for code projects: the shared print controls, with the box art
// taken from the project's first graphics and a manual the creator writes.

import { checklistText, packageZip } from "../files/exports.ts";
import type { PrintSprite, PrintSubject } from "../print/pdf.ts";
import { PrintControls, printPdf } from "../ui/PrintPanel.tsx";
import type { Preview } from "../ui/usePreview.ts";
import { download } from "../ui/usePreview.ts";
import { codeCredits, codeSourceFiles } from "./code-files.ts";
import type { CodeProject } from "./schema.ts";
import { useCodeStore } from "./store.ts";

const DRAFT = `# How to play
Say what the player does and how to win.

# Controls
- Move with the joystick (or the arrow keys).
- Press the fire button (or Space) to start.
`;

export function codePrintSubject(p: CodeProject): PrintSubject {
  // Sprite-sized graphics only; character sets and maps make poor box art.
  const sprites: PrintSprite[] = p.graphics
    .filter((g) => g.rows[0]!.length <= 16 && g.rows.length <= 32)
    .map((g) => ({
      width: g.rows[0]!.length,
      height: g.rows.length,
      frames: [g.rows],
      colors: p.palettes.find((x) => x.id === g.palette)?.colors ?? p.palettes[0]!.colors,
    }));
  return {
    title: p.title,
    hero: sprites[0],
    crowd: sprites[1],
    extra: sprites[2],
    cast: sprites.slice(0, 4),
    intro: "",
    facts: [],
    manual: p.manualText ?? DRAFT,
  };
}

export function CodePrint({ title, preview, cartridgeFile }: { title: string; preview: Preview; cartridgeFile: () => Promise<Uint8Array> }) {
  const project = useCodeStore((s) => s.project);
  const edit = useCodeStore((s) => s.edit);
  return (
    <PrintControls
      title={title}
      text={project.manualText ?? DRAFT}
      edited={project.manualText !== undefined}
      onText={(t) => edit((d) => void (d.manualText = t), "manual")}
      onReset={() => edit((d) => void delete d.manualText)}
      makePdf={(paper) => printPdf(codePrintSubject(project), paper, preview.screenshot)}
      makePackage={async (pdf) => {
        const [rom, file] = await Promise.all([preview.buildSigned(), cartridgeFile()]);
        return packageZip({ title: project.title, checklist: checklistText(project.title, codeCredits()), source: codeSourceFiles(project), ...rom, pdf, cartridgeFile: file });
      }}
      onDownload={download}
    />
  );
}
