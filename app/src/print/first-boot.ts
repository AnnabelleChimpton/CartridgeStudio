// The "First boot" card: a postcard-sized print for the day a game first
// boots on a console, offered when the creator answers "Did it boot?" with
// Yes. It is drawn with the cartridge label's renderer (pdf.ts drawLabel)
// under a "FIRST BOOT" strip, with the date and, when given, the console and
// cartridge it booted on. One page, with crop marks.

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import { loadPrintFonts } from "./fonts.ts";
import { PAPER_SIZES, PRINT_TRADEMARK, cutMarks, drawKitLines, drawLabel, printable, toRgb, wrap, type Paper, type PrintFonts, type PrintLook, type PrintSprite, type PrintSubject } from "./pdf.ts";

export interface FirstBootInput {
  /** The game, as the print kit sees it (kitPrintSubject, codePrintSubject…): title, maker, background and hero. */
  subject: Pick<PrintSubject, "title" | "madeBy" | "background" | "hero">;
  paper: Paper;
  /** When it booted; defaults to now. */
  date?: Date;
  /** What the creator says it booted on, e.g. "7800+ (firmware 1.2)". */
  console?: string;
  /** The flash cartridge, e.g. "Concerto". */
  cartridge?: string;
}

const CARD = { w: 6 * 72, h: 4 * 72 };
const STRIP = 30;

/** "16 October 2026". */
const longDate = (d: Date) =>
  `${d.getDate()} ${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][d.getMonth()]} ${d.getFullYear()}`;

/** The card's small print: where and when it booted. */
export function firstBootLine({ date = new Date(), console: on, cartridge }: Pick<FirstBootInput, "date" | "console" | "cartridge">): string {
  const where = [on?.trim() && `on a ${on.trim()}`, cartridge?.trim() && `from a ${cartridge.trim()}`].filter(Boolean).join(" ");
  return `First booted ${longDate(date)}${where ? ` ${where}` : ""}. Made with Cartridge Studio.`;
}

/** Builds the card with the fonts given (pure; for tests and callers that already have the fonts). */
export async function buildFirstBootCard(input: FirstBootInput & { fonts: PrintFonts }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts = {
    body: await doc.embedFont(input.fonts.body, { subset: true }),
    bold: await doc.embedFont(input.fonts.bold, { subset: true }),
  };
  const { subject } = input;
  const title = printable(subject.title.trim() || "Untitled");
  doc.setTitle(`${title} - first boot`);
  doc.setCreator("Cartridge Studio");
  if (subject.madeBy) doc.setAuthor(printable(subject.madeBy));

  const [pw, ph] = PAPER_SIZES[input.paper];
  const page = doc.addPage([pw, ph]);
  const x = (pw - CARD.w) / 2;
  const y = ph - 110 - CARD.h;
  const colorsOf = (s: PrintSprite | undefined) => (s?.colors ?? ["$0F", "$0F", "$0F"]).map(toRgb);
  const look: PrintLook = {
    title,
    madeBy: subject.madeBy?.trim() ?? "",
    background: toRgb(subject.background ?? "$00"),
    accent: colorsOf(subject.hero)[0]!,
    colorsOf,
  };

  const caption = "First boot card - cut along the marks.";
  page.drawText(caption, { x: (pw - fonts.body.widthOfTextAtSize(caption, 9)) / 2, y: y + CARD.h + 40, size: 9, font: fonts.body, color: rgb(0.4, 0.42, 0.46) });
  drawLabel(page, fonts, x, y, CARD.w, CARD.h - STRIP, look, subject.hero, `${firstBootLine(input)} ${PRINT_TRADEMARK}`, 5);
  // The strip across the top: "FIRST BOOT" in the kit font and the date.
  page.drawRectangle({ x, y: y + CARD.h - STRIP, width: CARD.w, height: STRIP, color: rgb(0, 0, 0) });
  drawKitLines(page, ["FIRST BOOT"], { x: x + 14, top: y + CARD.h - 8, unit: 2.8, color: rgb(1, 1, 1), font: fonts.bold, align: "left" });
  const date = longDate(input.date ?? new Date());
  const dw = fonts.bold.widthOfTextAtSize(date, 10);
  page.drawText(date, { x: x + CARD.w - 14 - dw, y: y + CARD.h - STRIP / 2 - 3.5, size: 10, font: fonts.bold, color: rgb(1, 1, 1) });
  cutMarks(page, x, y, CARD.w, CARD.h);

  const note = wrap("Print at actual size (100%). The card is 6 × 4 inches, a postcard; glue it to card stock if you want it to stand up.", fonts.body, 8.5, CARD.w);
  note.forEach((l, i) => page.drawText(l, { x, y: y - 40 - i * 12, size: 8.5, font: fonts.body, color: rgb(0.4, 0.42, 0.46) }));
  return doc.save();
}

/** Builds the card in the app, fetching the fonts on first use. */
export async function firstBootCardPdf(input: FirstBootInput): Promise<Uint8Array> {
  return buildFirstBootCard({ ...input, fonts: await loadPrintFonts() });
}
