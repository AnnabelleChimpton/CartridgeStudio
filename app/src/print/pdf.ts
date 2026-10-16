// Print PDF (SPEC.md, "Print PDF"): box front and back, cartridge labels and a
// manual, all generated from a game (a template project or a kit game, through
// print/subject.ts). Pixel art is drawn as vector rectangles (no smoothing at
// any size); fonts are OFL and embedded as subsets. Pure: fonts and the
// optional screenshot are passed in, so it runs in tests.

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { ntscRgb } from "../ui/ntsc.ts";
import { parseManual } from "./manual.ts";

export type Paper = "letter" | "a4";
export const PAPER_SIZES: Record<Paper, [number, number]> = { letter: [612, 792], a4: [595.28, 841.89] };

export interface PrintFonts {
  title: Uint8Array;
  body: Uint8Array;
  bold: Uint8Array;
}

/** RGBA pixels of the preview (320×240; each 160A pixel is two of these wide). */
export interface Screenshot {
  width: number;
  height: number;
  rgba: Uint8Array | Uint8ClampedArray;
}

/** A sprite as the PDF draws it: frames of `0`-`3` rows and its three palette colors (`$XX`). */
export interface PrintSprite {
  width: number;
  height: number;
  frames: string[][];
  colors: readonly string[];
}

/** Everything the print kit shows, whatever kind of game it comes from. */
export interface PrintSubject {
  title: string;
  /** The star: big on the box front and on the labels; its first color is the accent. */
  hero?: PrintSprite;
  /** Shown as a group above the hero on the box front. */
  crowd?: PrintSprite;
  /** A small thing between them (a shot, a coin). */
  extra?: PrintSprite;
  /** The manual's header row. */
  cast: PrintSprite[];
  /** The box back's paragraph. */
  intro: string;
  /** The box back's bullets. */
  facts: string[];
  /** The manual, in the light markup of manual.ts. */
  manual: string;
}

export interface PrintOptions {
  subject: PrintSubject;
  paper: Paper;
  fonts: PrintFonts;
  screenshot?: Screenshot;
}

const INCH = 72;
// Approximate sizes; the PDF tells creators to check them against their box and shell.
const BOX = { w: 5.25 * INCH, h: 7.25 * INCH };
const LABEL = { w: 3.25 * INCH, h: 2 * INCH };

/**
 * What the printed pieces say about hardware and trademarks. The box back
 * carries the compatibility line in small type, naming no particular console
 * (no hardware tests have run yet), and every printed piece carries the
 * trademark and non-affiliation line.
 */
export const PRINT_COMPAT = "Runs on 7800-compatible consoles via flash cart.";
export const PRINT_TRADEMARK = "Atari is a trademark of its owner; not affiliated with or endorsed by Atari.";

const INK = rgb(0.06, 0.07, 0.1);
const PAPER_WHITE = rgb(1, 1, 1);
const MUTED = rgb(0.45, 0.47, 0.52);
const CUT = rgb(0.55, 0.55, 0.55);

interface Fonts {
  title: PDFFont;
  body: PDFFont;
  bold: PDFFont;
}

const toRgb = (color: string): RGB => {
  const [r, g, b] = ntscRgb(parseInt(color.slice(1), 16));
  return rgb(r / 255, g / 255, b / 255);
};
const luminance = (c: RGB) => 0.2126 * c.red + 0.7152 * c.green + 0.0722 * c.blue;
const onColor = (c: RGB) => (luminance(c) > 0.55 ? INK : PAPER_WHITE);

/** Keeps text to characters the subset fonts can draw. */
const printable = (s: string) => s.replace(/[^ -ɏ‐-‧‰-⁞]/g, "?");

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of printable(text).split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Largest size (down to `min`) at which `text` wraps into at most `maxLines` lines within `maxWidth`. */
function fitText(text: string, font: PDFFont, maxWidth: number, maxLines: number, start: number, min: number) {
  for (let size = start; size > min; size -= 1) {
    const lines = wrap(text, font, size, maxWidth);
    if (lines.length <= maxLines && lines.every((l) => font.widthOfTextAtSize(l, size) <= maxWidth)) return { size, lines };
  }
  return { size: min, lines: wrap(text, font, min, maxWidth) };
}

function centeredLines(page: PDFPage, lines: string[], font: PDFFont, size: number, cx: number, top: number, color: RGB, leading = 1.35) {
  lines.forEach((l, i) => {
    const w = font.widthOfTextAtSize(l, size);
    page.drawText(l, { x: cx - w / 2, y: top - size - i * size * leading, size, font, color });
  });
  return top - lines.length * size * leading;
}

/** Draws sprite rows (`0` transparent, `1`-`3` palette colors) with 160A's 2:1 pixels; `unit` is the pixel height. */
function drawSprite(page: PDFPage, rows: string[], colors: RGB[], x: number, top: number, unit: number) {
  rows.forEach((row, y) => {
    let start = 0;
    for (let i = 1; i <= row.length; i++) {
      if (i < row.length && row[i] === row[start]) continue;
      const v = row.charCodeAt(start) - 48;
      if (v > 0) {
        page.drawRectangle({
          x: x + start * unit * 2,
          y: top - (y + 1) * unit,
          width: (i - start) * unit * 2,
          height: unit,
          color: colors[v - 1]!,
        });
      }
      start = i;
    }
  });
}

/** Draws RGBA pixels as merged horizontal runs of rectangles. */
function drawScreenshot(page: PDFPage, shot: Screenshot, x: number, y: number, w: number, h: number) {
  const pw = w / shot.width;
  const ph = h / shot.height;
  page.drawRectangle({ x, y, width: w, height: h, color: rgb(0, 0, 0) });
  for (let row = 0; row < shot.height; row++) {
    let start = 0;
    const at = (c: number) => (row * shot.width + c) * 4;
    const same = (a: number, b: number) =>
      shot.rgba[at(a)] === shot.rgba[at(b)] &&
      shot.rgba[at(a) + 1] === shot.rgba[at(b) + 1] &&
      shot.rgba[at(a) + 2] === shot.rgba[at(b) + 2];
    for (let c = 1; c <= shot.width; c++) {
      if (c < shot.width && same(c, start)) continue;
      const i = at(start);
      const r = shot.rgba[i]!, g = shot.rgba[i + 1]!, b = shot.rgba[i + 2]!;
      if (r + g + b > 0) {
        page.drawRectangle({
          x: x + start * pw,
          y: y + h - (row + 1) * ph,
          width: (c - start) * pw,
          height: ph,
          color: rgb(r / 255, g / 255, b / 255),
        });
      }
      start = c;
    }
  }
}

/** Crop marks outside each corner plus a light dashed outline to cut along. */
function cutMarks(page: PDFPage, x: number, y: number, w: number, h: number) {
  page.drawRectangle({ x, y, width: w, height: h, borderColor: CUT, borderWidth: 0.4, borderDashArray: [3, 3] });
  const len = 14;
  const gap = 6;
  for (const [cx, cy, dx, dy] of [
    [x, y, -1, -1],
    [x + w, y, 1, -1],
    [x, y + h, -1, 1],
    [x + w, y + h, 1, 1],
  ] as const) {
    page.drawLine({ start: { x: cx + dx * gap, y: cy }, end: { x: cx + dx * (gap + len), y: cy }, thickness: 0.5, color: INK });
    page.drawLine({ start: { x: cx, y: cy + dy * gap }, end: { x: cx, y: cy + dy * (gap + len) }, thickness: 0.5, color: INK });
  }
}

function caption(page: PDFPage, fonts: Fonts, text: string, y: number) {
  const size = 9;
  const w = fonts.body.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (page.getWidth() - w) / 2, y, size, font: fonts.body, color: MUTED });
}

export async function buildPrintPdf({ subject, paper, fonts: fontBytes, screenshot }: PrintOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts: Fonts = {
    title: await doc.embedFont(fontBytes.title, { subset: true }),
    body: await doc.embedFont(fontBytes.body, { subset: true }),
    bold: await doc.embedFont(fontBytes.bold, { subset: true }),
  };
  const [pw, ph] = PAPER_SIZES[paper];
  const title = printable(subject.title.trim() || "Untitled");
  doc.setTitle(`${title} - print kit`);
  doc.setCreator("Cartridge Studio");

  const colorsOf = (s: PrintSprite | undefined) => (s?.colors ?? ["$0F", "$0F", "$0F"]).map(toRgb);
  const background = rgb(0.06, 0.07, 0.1);
  const accent = colorsOf(subject.hero)[0]!;

  // ---- Page 1: box front ----
  {
    const page = doc.addPage([pw, ph]);
    const x = (pw - BOX.w) / 2;
    const y = (ph - BOX.h) / 2 + 20;
    caption(page, fonts, "Box front - cut along the marks", y + BOX.h + 28);
    page.drawRectangle({ x, y, width: BOX.w, height: BOX.h, color: background });

    // Title band.
    const band = 118;
    page.drawRectangle({ x, y: y + BOX.h - band, width: BOX.w, height: band, color: accent });
    const fit = fitText(title.toUpperCase(), fonts.title, BOX.w - 36, 3, 28, 9);
    const textH = fit.lines.length * fit.size * 1.35;
    centeredLines(page, fit.lines, fonts.title, fit.size, x + BOX.w / 2, y + BOX.h - (band - textH) / 2 + fit.size * 0.2, onColor(accent));

    // Scene: the crowd above, the hero below, the extra between.
    const enemy = subject.crowd;
    if (enemy) {
      const unit = 3;
      const ew = enemy.width * unit * 2;
      const cols = 4;
      const gapX = (BOX.w - 40 - cols * ew) / (cols - 1);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < cols; c++) {
          const frame = enemy.frames[(r + c) % enemy.frames.length]!;
          drawSprite(page, frame, colorsOf(enemy), x + 20 + c * (ew + gapX), y + BOX.h - band - 30 - r * (enemy.height * unit + 18), unit);
        }
      }
    }
    const shot = subject.extra;
    if (shot) drawSprite(page, shot.frames[0]!, colorsOf(shot), x + BOX.w / 2 - shot.width * 4, y + 230, 4);
    const player = subject.hero;
    if (player) {
      const unit = 7;
      drawSprite(page, player.frames[0]!, colorsOf(player), x + BOX.w / 2 - player.width * unit, y + 60 + player.height * unit, unit);
    }

    // Bottom strip: players and controller, and the trademark line.
    page.drawRectangle({ x, y, width: BOX.w, height: 34, color: rgb(0, 0, 0) });
    page.drawText("1 PLAYER  JOYSTICK", { x: x + 14, y: y + 18, size: 7, font: fonts.title, color: PAPER_WHITE });
    page.drawText(PRINT_TRADEMARK, { x: x + 14, y: y + 6, size: 6, font: fonts.body, color: MUTED });
    cutMarks(page, x, y, BOX.w, BOX.h);

    // Calibration square.
    const sq = INCH;
    const sx = 54;
    const sy = 40;
    page.drawRectangle({ x: sx, y: sy, width: sq, height: sq, borderColor: INK, borderWidth: 0.75 });
    const note = paper === "a4" ? "Print at actual size (100%). This square should measure 1 inch (2.54 cm)." : "Print at actual size (100%). This square should measure 1 inch.";
    page.drawText(note, { x: sx + sq + 10, y: sy + sq / 2 + 4, size: 8.5, font: fonts.body, color: MUTED });
    page.drawText("Sizes are approximate: check them against your box and cartridge shell.", {
      x: sx + sq + 10,
      y: sy + sq / 2 - 9,
      size: 8.5,
      font: fonts.body,
      color: MUTED,
    });
  }

  // ---- Page 2: box back ----
  {
    const page = doc.addPage([pw, ph]);
    const x = (pw - BOX.w) / 2;
    const y = (ph - BOX.h) / 2;
    caption(page, fonts, "Box back - cut along the marks", y + BOX.h + 28);
    page.drawRectangle({ x, y, width: BOX.w, height: BOX.h, color: background });
    const pad = 22;
    let cursor = y + BOX.h - pad;

    const fit = fitText(title.toUpperCase(), fonts.title, BOX.w - 2 * pad, 2, 15, 8);
    cursor = centeredLines(page, fit.lines, fonts.title, fit.size, x + BOX.w / 2, cursor, PAPER_WHITE) - 10;

    const shotW = BOX.w - 2 * pad;
    const shotH = (shotW * 3) / 4;
    if (screenshot) {
      drawScreenshot(page, screenshot, x + pad, cursor - shotH, shotW, shotH);
      page.drawRectangle({ x: x + pad, y: cursor - shotH, width: shotW, height: shotH, borderColor: accent, borderWidth: 2 });
      cursor -= shotH + 16;
    }

    for (const line of wrap(subject.intro, fonts.body, 10.5, BOX.w - 2 * pad)) {
      page.drawText(line, { x: x + pad, y: cursor - 10.5, size: 10.5, font: fonts.body, color: PAPER_WHITE });
      cursor -= 14.5;
    }
    cursor -= 6;
    for (const fact of subject.facts) {
      const lines = wrap(fact, fonts.body, 10, BOX.w - 2 * pad - 14);
      page.drawRectangle({ x: x + pad, y: cursor - 8.5, width: 5, height: 5, color: accent });
      for (const line of lines) {
        page.drawText(line, { x: x + pad + 14, y: cursor - 10, size: 10, font: fonts.body, color: PAPER_WHITE });
        cursor -= 13.5;
      }
      cursor -= 2;
    }

    const legal = wrap(`${PRINT_COMPAT} Made with Cartridge Studio. ${PRINT_TRADEMARK}`, fonts.body, 7, BOX.w - 2 * pad);
    legal.forEach((line, i) => {
      page.drawText(line, { x: x + pad, y: y + 14 + (legal.length - 1 - i) * 9, size: 7, font: fonts.body, color: MUTED });
    });
    cutMarks(page, x, y, BOX.w, BOX.h);
  }

  // ---- Page 3: cartridge labels (one spare) ----
  {
    const page = doc.addPage([pw, ph]);
    caption(page, fonts, "Cartridge labels - one spare. Cut along the marks.", ph - 60);
    const player = subject.hero;
    for (let i = 0; i < 2; i++) {
      const x = (pw - LABEL.w) / 2;
      const y = ph - 120 - LABEL.h - i * (LABEL.h + 60);
      page.drawRectangle({ x, y, width: LABEL.w, height: LABEL.h, color: background });
      // The art panel is black (the ship's own colors would vanish on an accent
      // panel), with an accent stripe between it and the title.
      const art = 104;
      page.drawRectangle({ x, y, width: art, height: LABEL.h, color: rgb(0, 0, 0) });
      page.drawRectangle({ x: x + art, y, width: 5, height: LABEL.h, color: accent });
      if (player) {
        const unit = Math.min((art - 16) / (player.width * 2), (LABEL.h - 24) / player.height);
        drawSprite(page, player.frames[0]!, colorsOf(player), x + (art - player.width * unit * 2) / 2, y + (LABEL.h + player.height * unit) / 2, unit);
      }
      const textW = LABEL.w - art - 5 - 16;
      const panelX = x + art + 5 + (LABEL.w - art - 5) / 2;
      // The trademark line along the bottom of the title panel; the title is centred above it.
      const legal = wrap(PRINT_TRADEMARK, fonts.body, 5, textW);
      legal.forEach((line, j) => {
        const w = fonts.body.widthOfTextAtSize(line, 5);
        page.drawText(line, { x: panelX - w / 2, y: y + 6 + (legal.length - 1 - j) * 6.5, size: 5, font: fonts.body, color: PAPER_WHITE, opacity: 0.75 });
      });
      const legalH = 6 + legal.length * 6.5;
      const fit = fitText(title.toUpperCase(), fonts.title, textW, 4, 13, 5);
      const textH = fit.lines.length * fit.size * 1.35;
      centeredLines(page, fit.lines, fonts.title, fit.size, panelX, y + legalH + (LABEL.h - legalH + textH) / 2 + 3, PAPER_WHITE);
      cutMarks(page, x, y, LABEL.w, LABEL.h);
    }
  }

  // ---- Manual pages ----
  {
    const margin = 60;
    const width = pw - 2 * margin;
    let page = doc.addPage([pw, ph]);
    let cursor = ph - margin;
    const pages = [page];
    const newPage = () => {
      page = doc.addPage([pw, ph]);
      pages.push(page);
      cursor = ph - margin;
    };
    const need = (h: number) => cursor - h < margin + 20 && newPage();

    // Header: title and the cast.
    const fit = fitText(title.toUpperCase(), fonts.title, width, 2, 22, 10);
    cursor = centeredLines(page, fit.lines, fonts.title, fit.size, pw / 2, cursor, INK) - 8;
    const cast = subject.cast;
    const unit = 3;
    const castW = cast.reduce((n, s) => n + s.width * unit * 2, 0) + (cast.length - 1) * 20;
    let cx = (pw - castW) / 2;
    const castH = Math.max(0, ...cast.map((s) => s.height * unit));
    for (const s of cast) {
      drawSprite(page, s.frames[0]!, colorsOf(s), cx, cursor - (castH - s.height * unit) / 2, unit);
      cx += s.width * unit * 2 + 20;
    }
    cursor -= castH + 20;
    page.drawLine({ start: { x: margin, y: cursor }, end: { x: pw - margin, y: cursor }, thickness: 1, color: accent });
    cursor -= 18;

    for (const block of parseManual(subject.manual)) {
      if (block.kind === "heading") {
        need(40);
        cursor -= 8;
        page.drawText(printable(block.text), { x: margin, y: cursor - 14, size: 14, font: fonts.bold, color: INK });
        cursor -= 22;
      } else {
        const indent = block.kind === "bullet" ? 16 : 0;
        const lines = wrap(block.text, fonts.body, 11, width - indent);
        need(lines.length * 15.5);
        if (block.kind === "bullet") {
          page.drawRectangle({ x: margin + 3, y: cursor - 9, width: 4.5, height: 4.5, color: INK });
        }
        for (const line of lines) {
          need(15.5);
          page.drawText(line, { x: margin + indent, y: cursor - 11, size: 11, font: fonts.body, color: INK });
          cursor -= 15.5;
        }
        cursor -= block.kind === "bullet" ? 3 : 8;
      }
    }
    pages.forEach((p, i) => {
      const label = `${title} - manual, page ${i + 1} of ${pages.length}`;
      p.drawText(label, { x: margin, y: 30, size: 8, font: fonts.body, color: MUTED });
    });
  }

  return doc.save();
}
