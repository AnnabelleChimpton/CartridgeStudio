// Printing for code projects: the shared print controls, with the box art
// taken from the project's first graphics and a manual the creator writes.

import { KIT_TOOLCHAIN, checklistText } from "../files/exports.ts";
import { packageZip } from "../files/package.ts";
import { useRecentClip } from "../files/recent-clip.ts";
import { APP_VERSION } from "../version.ts";
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
        const [rom, file, { buildPlayerHtml }] = await Promise.all([preview.buildSigned(), cartridgeFile(), import("../player/player.ts")]);
        const pkg = await packageZip({
          kind: "submission",
          title: project.title,
          notes: { name: "CHECKLIST.txt", text: checklistText(project.title, codeCredits()) },
          build: { app: APP_VERSION, runtime: "hand-written 7800basic", toolchain: KIT_TOOLCHAIN },
          source: codeSourceFiles(project),
          ...rom,
          pdf,
          cartridgeFile: file,
          player: await buildPlayerHtml(project.title, rom.a78),
          clip: useRecentClip.getState().gif,
        });
        return pkg.zip;
      }}
      onDownload={download}
    />
  );
}
