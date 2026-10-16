import fs from "node:fs";
import path from "node:path";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { beforeAll, describe, expect, it } from "vitest";
import { generate } from "../codegen/generate.ts";
import { nodeBuilder, nodeHost } from "../harness/node.ts";
import { getTemplate } from "../project/templates.ts";
import { PAPER_SIZES, buildPrintPdf, type PrintFonts, type Screenshot } from "./pdf.ts";

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

describe("buildPrintPdf", () => {
  for (const paper of ["letter", "a4"] as const) {
    it(`lays out box, label and manual pages on ${paper}`, async () => {
      const bytes = await buildPrintPdf({ project: template.sample, template, paper, fonts, screenshot });
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
    const doc = await PDFDocument.load(await buildPrintPdf({ project: p, template, paper: "letter", fonts }));
    expect(doc.getPageCount()).toBeGreaterThan(4); // the manual spilled onto more pages
  });

  it("replaces characters the fonts can't draw instead of failing", async () => {
    const p = structuredClone(template.sample);
    p.title = "Cat 🐱 vs. Vacuums";
    p.cartridge.manualText = "# 日本語\nEmoji 🎮 here.";
    await expect(buildPrintPdf({ project: p, template, paper: "a4", fonts })).resolves.toBeInstanceOf(Uint8Array);
  });
});
