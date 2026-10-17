import fs from "node:fs";
import path from "node:path";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { beforeAll, describe, expect, it } from "vitest";
import { generate } from "../codegen/generate.ts";
import { nodeBuilder, nodeHost } from "../harness/node.ts";
import { getTemplate } from "../project/templates.ts";
import { PAPER_SIZES, PRINT_COMPAT, PRINT_TRADEMARK, bookletOrder, bookletPageSize, buildPrintPdf, creditLines, specRows, type PrintFonts, type Screenshot } from "./pdf.ts";
import { buildFirstBootCard, firstBootLine } from "./first-boot.ts";
import { printSpec } from "./spec.ts";
import { kitColorCount, kitControls, kitScoring, templatePrintSubject } from "./subject.ts";

const template = getTemplate("fixed-shooter");
const fontsDir = path.resolve(import.meta.dirname, "../../public/fonts");
const fonts: PrintFonts = {
  body: fs.readFileSync(path.join(fontsDir, "atkinson-hyperlegible-regular.ttf")),
  bold: fs.readFileSync(path.join(fontsDir, "atkinson-hyperlegible-bold.ttf")),
};

let screenshot: Screenshot;

const embeddedFonts = (doc: PDFDocument) =>
  doc.context.enumerateIndirectObjects().filter(([, obj]) => obj instanceof PDFDict && obj.has(PDFName.of("FontFile2")));

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
      // Both Atkinson fonts are embedded as TrueType programs; titles are vector shapes in the kit font.
      expect(embeddedFonts(doc)).toHaveLength(2);
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
    expect(subject.manual).toContain("You are the Cat. Clear every Yarn ball three times to win.");
    expect(subject.controls[0]![1]).toBe("Moves the Cat");
    const bytes = await buildPrintPdf({ subject, paper: "letter", fonts, screenshot });
    if (process.env.PRINT_PDF_OUT) fs.writeFileSync(path.join(process.env.PRINT_PDF_OUT, "print-kit.pdf"), bytes);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(4);
    expect(doc.getTitle()).toBe("Ghost Panic - print kit");
  });

  it("imposes a booklet: half-size pages, two to a landscape sheet, a multiple of four", async () => {
    const { KIT_PRESETS } = await import("../kit/presets.ts");
    const { kitPrintSubject } = await import("./subject.ts");
    const game = { ...KIT_PRESETS.find((p) => p.id === "ghost-panic")!.game, madeBy: "Sam and Robin" };
    for (const paper of ["letter", "a4"] as const) {
      const bytes = await buildPrintPdf({ subject: kitPrintSubject(game), paper, layout: "booklet", fonts, screenshot });
      if (process.env.PRINT_PDF_OUT) fs.writeFileSync(path.join(process.env.PRINT_PDF_OUT, `print-booklet-${paper}.pdf`), bytes);
      const doc = await PDFDocument.load(bytes);
      const pages = doc.getPages();
      const sheets = pages.slice(3);
      // Front, back and labels, then each booklet sheet's two sides.
      expect(sheets.length % 2).toBe(0);
      expect(sheets.length).toBeGreaterThanOrEqual(2);
      const [w, h] = PAPER_SIZES[paper];
      for (const p of sheets) expect([p.getWidth(), p.getHeight()].map(Math.round)).toEqual([Math.round(h), Math.round(w)]);
      expect(embeddedFonts(doc)).toHaveLength(2);
      expect(doc.getAuthor()).toBe("Sam and Robin");
    }
    const [tw, th] = bookletPageSize("letter");
    expect(tw).toBeLessThan(396);
    expect(th).toBeLessThan(612);
  });

  it("orders booklet pages for saddle stitching", () => {
    expect(bookletOrder(4)).toEqual([[3, 0, 1, 2]]);
    expect(bookletOrder(8)).toEqual([
      [7, 0, 1, 6],
      [5, 2, 3, 4],
    ]);
  });
});

describe("what the print kit says", () => {
  it("reads Ghost Panic's real inputs and scoring", async () => {
    const { KIT_PRESETS } = await import("../kit/presets.ts");
    const game = KIT_PRESETS.find((p) => p.id === "ghost-panic")!.game;
    const controls = kitControls(game);
    expect(controls[0]).toEqual(["Joystick, four ways", expect.stringContaining("Moves the Cat")]);
    expect(controls.map(([k]) => k)).toEqual(expect.arrayContaining(["Pause", "Reset"]));
    expect(kitScoring(game)).toContainEqual(["Yarn ball", "10 points"]);
    expect(kitColorCount(game)).toBeGreaterThan(2);
  });

  it("credits the maker and the scene's tools, and builds the spec plate from the build", () => {
    const spec = printSpec({
      bin: new Uint8Array(32768),
      stats: { areas: [{ name: "the main area", bytes: 20480 }], graphics: [{ block: 0, bytes: 2048 }], zoneObjects: 13 },
      colors: 9,
      toolchain: "7800basic 0.41",
      runtime: "kit runtime 0.4.0",
      built: new Date(2026, 9, 16),
    });
    expect(specRows(spec)).toEqual([
      ["ROM", "10 KB of a 32 KB cartridge"],
      ["Colors", "9 NTSC palette entries"],
      ["Objects per zone", "13"],
      ["Built", "16 Oct 2026"],
      ["Toolchain", "7800basic 0.41, kit runtime 0.4.0"],
    ]);
    const lines = creditLines({ ...templatePrintSubject(template.sample, template), madeBy: "Sam and Robin", spec }).map(([t]) => t);
    expect(lines[0]).toBe("Game by Sam and Robin");
    expect(lines.join(" ")).toMatch(/7800basic 0\.41 by Mike Saarna \(RevEng\)/);
    expect(lines.join(" ")).toMatch(/dasm/);
    expect(lines.join(" ")).toMatch(/js7800, the emulator by raz0red/);
    expect(creditLines(templatePrintSubject(template.sample, template))[0]![0]).not.toMatch(/^Game by/);
  });
});

describe("the First boot card", () => {
  it("is one page with the date and where it booted", async () => {
    const date = new Date(2026, 9, 16);
    expect(firstBootLine({ date, console: "7800+", cartridge: "flash cart" })).toBe("First booted 16 October 2026 on a 7800+ from a flash cart. Made with Cartridge Studio.");
    expect(firstBootLine({ date })).toBe("First booted 16 October 2026. Made with Cartridge Studio.");
    const { KIT_PRESETS } = await import("../kit/presets.ts");
    const { kitPrintSubject } = await import("./subject.ts");
    const subject = kitPrintSubject({ ...KIT_PRESETS.find((p) => p.id === "ghost-panic")!.game, madeBy: "Sam and Robin" });
    const bytes = await buildFirstBootCard({ subject, paper: "letter", fonts, date, console: "7800+" });
    if (process.env.PRINT_PDF_OUT) fs.writeFileSync(path.join(process.env.PRINT_PDF_OUT, "first-boot.pdf"), bytes);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Ghost Panic - first boot");
  });
});
