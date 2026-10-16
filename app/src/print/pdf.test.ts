import fs from "node:fs";
import path from "node:path";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { beforeAll, describe, expect, it } from "vitest";
import { generate } from "../codegen/generate.ts";
import { nodeBuilder, nodeHost } from "../harness/node.ts";
import { getTemplate } from "../project/templates.ts";
import { PAPER_SIZES, PRINT_COMPAT, PRINT_TRADEMARK, buildPrintPdf, type PrintFonts, type Screenshot } from "./pdf.ts";
import { templatePrintSubject } from "./subject.ts";

const template = getTemplate("fixed-shooter");
const fontsDir = path.resolve(import.meta.dirname, "../../public/fonts");
const fonts: PrintFonts = {
  title: fs.readFileSync(path.join(fontsDir, "press-start-2p.ttf")),
  body: fs.readFileSync(path.join(fontsDir, "atkinson-hyperlegible-regular.ttf")),
  bold: fs.readFileSync(path.join(fontsDir, "atkinson-hyperlegible-bold.ttf")),
};

let screenshot: Screenshot;

beforeAll(async () => {
  // A real frame of the sample game, from the headless emulator.
  const gen = generate(template.sample, template);
  if (!gen.ok) throw new Error(gen.errors.join("\n"));
  const built = await (await nodeBuilder()).build({ ...gen.input, sign: false });
  if (!built.ok) throw new Error(built.message);
  const host = await nodeHost();
  await host.load(built.a78);
  host.step(90);
  screenshot = { width: 320, height: 240, rgba: host.rgba() };
});

describe("print wording", () => {
  it("names no particular console, and carries the trademark line", () => {
    expect(PRINT_COMPAT).toBe("Runs on 7800-compatible consoles via flash cart.");
    expect(PRINT_COMPAT).not.toMatch(/Atari|2600|\+/);
    expect(PRINT_TRADEMARK).toBe("Atari is a trademark of its owner; not affiliated with or endorsed by Atari.");
  });
});

describe("buildPrintPdf", () => {
  for (const paper of ["letter", "a4"] as const) {
    it(`lays out box, label and manual pages on ${paper}`, async () => {
      const bytes = await buildPrintPdf({ subject: templatePrintSubject(template.sample, template), paper, fonts, screenshot });
      // Set PRINT_PDF_OUT to a folder to inspect the result.
      if (process.env.PRINT_PDF_OUT) fs.writeFileSync(path.join(process.env.PRINT_PDF_OUT, `print-${paper}.pdf`), bytes);

      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBeGreaterThanOrEqual(4); // front, back, labels, manual
      for (const page of doc.getPages()) {
        expect([page.getWidth(), page.getHeight()].map(Math.round)).toEqual(PAPER_SIZES[paper].map(Math.round));
      }
      expect(doc.getTitle()).toBe("Cat vs. Vacuums - print kit");
      // All three fonts are embedded as TrueType programs, not just referenced.
      const embedded = doc.context
        .enumerateIndirectObjects()
        .filter(([, obj]) => obj instanceof PDFDict && obj.has(PDFName.of("FontFile2")));
      expect(embedded).toHaveLength(3);
      expect(bytes.length).toBeLessThan(1_500_000);
    });
  }

  it("works without a screenshot and with a long manual", async () => {
    const p = structuredClone(template.sample);
    p.title = "A Very Long Title For A Very Small Cartridge Label";
    p.cartridge.manualText = Array.from({ length: 12 }, (_, i) => `# Part ${i + 1}\n${"Lorem ipsum dolor sit amet. ".repeat(12)}`).join("\n\n");
    const doc = await PDFDocument.load(await buildPrintPdf({ subject: templatePrintSubject(p, template), paper: "letter", fonts }));
    expect(doc.getPageCount()).toBeGreaterThan(4); // the manual spilled onto more pages
  });

  it("replaces characters the fonts can't draw instead of failing", async () => {
    const p = structuredClone(template.sample);
    p.title = "Cat 🐱 vs. Vacuums";
    p.cartridge.manualText = "# 日本語\nEmoji 🎮 here.";
    await expect(buildPrintPdf({ subject: templatePrintSubject(p, template), paper: "a4", fonts })).resolves.toBeInstanceOf(Uint8Array);
  });

  it("prints a kit game: Ghost Panic's box, labels and a manual written from its rules", async () => {
    const { KIT_PRESETS } = await import("../kit/presets.ts");
    const { kitPrintSubject } = await import("./subject.ts");
    const game = KIT_PRESETS.find((p) => p.id === "ghost-panic")!.game;
    const subject = kitPrintSubject(game);
    expect(subject.hero?.width).toBe(8);
    expect(subject.manual).toContain("- When Cat touches Yarn ball: remove the Yarn ball, add 10 points and play Blip.");
    expect(subject.manual).toContain("- Move the Cat around with the joystick (or the arrow keys).");
    const bytes = await buildPrintPdf({ subject, paper: "letter", fonts, screenshot });
    if (process.env.PRINT_PDF_OUT) fs.writeFileSync(path.join(process.env.PRINT_PDF_OUT, "print-kit.pdf"), bytes);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(4);
    expect(doc.getTitle()).toBe("Ghost Panic - print kit");
  });
});
