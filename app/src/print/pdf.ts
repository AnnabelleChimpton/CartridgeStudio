// Print PDF (SPEC.md, "Print PDF"): box front and back, cartridge labels and a
// manual, all generated from a game (a template project, a kit game or a code
// project, through print/subject.ts). Pixel art and titles are vector
// rectangles: sprites at 160A's 2:1 pixels, titles in the kit's 3×5 font
// (print/kit-font.ts). Body text is Atkinson Hyperlegible, embedded as a
// subset. Pure: fonts and the optional screenshot are passed in, so it runs in
// tests.
//
// The manual comes in two layouts: plain pages on the chosen paper, or a
// booklet of half-size pages imposed two to a sheet for double-sided printing,
// folded and stapled down the middle.

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { ntscRgb } from "../ui/ntsc.ts";
import { drawKitLines, fitKitText, kitFontCovers, kitHeight, kitLines, kitWidth } from "./kit-font.ts";
import { parseManual, type ManualBlock } from "./manual.ts";

export type Paper = "letter" | "a4";
export const PAPER_SIZES: Record<Paper, [number, number]> = { letter: [612, 792], a4: [595.28, 841.89] };

/** "plain": the manual on full pages. "booklet": half-size pages, two to a sheet, for folding. */
export type Layout = "plain" | "booklet";

export interface PrintFonts {
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

/** The box back's spec plate, measured from the build (print/spec.ts). */
export interface PrintSpec {
  /** The cartridge image, in bytes (32768 for `set romsize 32k`). */
  cartBytes: number;
  /** Bytes the game takes, when the build log says how much was left. */
  romBytes?: number;
  /** Distinct NTSC palette entries the game uses. */
  colors: number;
  /** Display objects per zone, from 7800basic's report. */
  zoneObjects?: number;
  built: Date;
  /** "7800basic 0.41". */
  toolchain: string;
  /** "kit runtime 0.4.0", for kit games. */
  runtime?: string;
  /** Cartridge Studio's version. */
  app?: string;
}

/** Everything the print kit shows, whatever kind of game it comes from. */
export interface PrintSubject {
  title: string;
  /** "Made by", as typed; shown only when set. */
  madeBy?: string;
  /** The game's background palette entry (`$XX`): the box and label color. */
  background?: string;
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
  /** The controls table: [input, what it does]. An empty input prints the row as a plain line. */
  controls: [string, string][];
  /** The scoring table: [what, points]. */
  scoring: [string, string][];
  spec?: PrintSpec;
}

export interface PrintOptions {
  subject: PrintSubject;
  paper: Paper;
  /** Defaults to "plain". */
  layout?: Layout;
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
export const PRINT_UNTESTED = "Nobody has tested Cartridge Studio games on console hardware yet.";

const INK = rgb(0.06, 0.07, 0.1);
const PAPER_WHITE = rgb(1, 1, 1);
const MUTED = rgb(0.4, 0.42, 0.46);
const RULE = rgb(0.75, 0.76, 0.78);
const CUT = rgb(0.55, 0.55, 0.55);

interface Fonts {
  body: PDFFont;
  bold: PDFFont;
}

export const toRgb = (color: string): RGB => {
  const [r, g, b] = ntscRgb(parseInt(color.slice(1), 16));
  return rgb(r / 255, g / 255, b / 255);
};
const luminance = (c: RGB) => 0.2126 * c.red + 0.7152 * c.green + 0.0722 * c.blue;
const isLight = (c: RGB) => luminance(c) > 0.5;
const onColor = (c: RGB) => (isLight(c) ? INK : PAPER_WHITE);
/** Small print on a colored panel: a softer version of the text color that keeps its contrast. */
const softOn = (c: RGB) => (isLight(c) ? rgb(0.2, 0.21, 0.24) : rgb(0.82, 0.83, 0.85));

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

function centeredLines(page: PDFPage, lines: string[], font: PDFFont, size: number, cx: number, top: number, color: RGB, leading = 1.3) {
  lines.forEach((l, i) => {
    const w = font.widthOfTextAtSize(l, size);
    page.drawText(l, { x: cx - w / 2, y: top - size - i * size * leading, size, font, color });
  });
  return top - lines.length * size * leading;
}

interface TitleBox {
  cx: number;
  top: number;
  width: number;
  height: number;
  maxLines: number;
  /** Kit-font pixel sizes to try, in points. */
  maxUnit: number;
  minUnit: number;
}

/** The title in the kit font, or in Atkinson bold when the font can't draw it. Returns the y below it. */
function drawTitle(page: PDFPage, text: string, fonts: Fonts, box: TitleBox, color: RGB): number {
  const t = printable(text);
  if (kitFontCovers(t)) {
    const fit = fitKitText(t, box);
    return drawKitLines(page, fit.lines, { x: box.cx, top: box.top, unit: fit.unit, color, font: fonts.bold });
  }
  const start = Math.round(box.maxUnit * 5);
  const fit = fitText(t.toUpperCase(), fonts.bold, box.width, box.maxLines, start, Math.max(6, Math.round(box.minUnit * 5)));
  return centeredLines(page, fit.lines, fonts.bold, fit.size, box.cx, box.top, color, 1.1);
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

/** Crop marks outside each corner; with `outline`, a light dashed line to cut along too. */
function cutMarks(page: PDFPage, x: number, y: number, w: number, h: number, { outline = true, gap = 6, len = 14 } = {}) {
  if (outline) page.drawRectangle({ x, y, width: w, height: h, borderColor: CUT, borderWidth: 0.4, borderDashArray: [3, 3] });
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

/** A registration target: a ring with a cross through it. */
function registration(page: PDFPage, cx: number, cy: number, r = 6) {
  page.drawCircle({ x: cx, y: cy, size: r * 0.6, borderColor: INK, borderWidth: 0.5 });
  page.drawLine({ start: { x: cx - r, y: cy }, end: { x: cx + r, y: cy }, thickness: 0.5, color: INK });
  page.drawLine({ start: { x: cx, y: cy - r }, end: { x: cx, y: cy + r }, thickness: 0.5, color: INK });
}

/** Registration targets centred on each side of a piece, just outside its crop marks. */
function registrationMarks(page: PDFPage, x: number, y: number, w: number, h: number, off = 16) {
  registration(page, x + w / 2, y + h + off);
  registration(page, x + w / 2, y - off);
  registration(page, x - off, y + h / 2);
  registration(page, x + w + off, y + h / 2);
}

function caption(page: PDFPage, fonts: Fonts, text: string, y: number) {
  const size = 9;
  const w = fonts.body.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (page.getWidth() - w) / 2, y, size, font: fonts.body, color: MUTED });
}

const kb = (bytes: number) => {
  const k = bytes / 1024;
  return `${Number.isInteger(k) ? k : k.toFixed(1)} KB`;
};
const formatDate = (d: Date) => `${d.getDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]} ${d.getFullYear()}`;

/** The spec plate's rows, in order. */
export function specRows(spec: PrintSpec): [string, string][] {
  return [
    ["ROM", spec.romBytes !== undefined ? `${kb(spec.romBytes)} of a ${kb(spec.cartBytes)} cartridge` : `${kb(spec.cartBytes)} cartridge`],
    ["Colors", `${spec.colors} NTSC palette entries`],
    ...(spec.zoneObjects ? [["Objects per zone", String(spec.zoneObjects)] as [string, string]] : []),
    ["Built", formatDate(spec.built)],
    ["Toolchain", [spec.toolchain, spec.runtime].filter(Boolean).join(", ")],
  ];
}

/** The pieces every page of the kit shares. */
interface Look {
  title: string;
  madeBy: string;
  background: RGB;
  accent: RGB;
  colorsOf: (s: PrintSprite | undefined) => RGB[];
}

function boxFront(doc: PDFDocument, size: [number, number], paper: Paper, fonts: Fonts, s: PrintSubject, look: Look) {
  const [pw, ph] = size;
  const page = doc.addPage([pw, ph]);
  const x = (pw - BOX.w) / 2;
  const y = (ph - BOX.h) / 2 + 20;
  const ink = onColor(look.background);
  caption(page, fonts, "Box front - cut along the marks", y + BOX.h + 34);
  page.drawRectangle({ x, y, width: BOX.w, height: BOX.h, color: look.background });

  // Title in the kit font, the maker under it, then an accent rule.
  const pad = 20;
  let cursor = drawTitle(page, look.title, fonts, { cx: x + BOX.w / 2, top: y + BOX.h - 26, width: BOX.w - 2 * pad, height: 86, maxLines: 3, maxUnit: 7, minUnit: 2 }, ink);
  if (look.madeBy) {
    cursor = centeredLines(page, wrap(`Game by ${look.madeBy}`, fonts.bold, 11, BOX.w - 2 * pad).slice(0, 1), fonts.bold, 11, x + BOX.w / 2, cursor - 10, ink);
  }
  cursor -= 12;
  page.drawRectangle({ x: x + pad, y: cursor - 3, width: BOX.w - 2 * pad, height: 3, color: look.accent });
  cursor -= 3;

  // Scene: the crowd above, the hero below, the extra between.
  const player = s.hero;
  const heroUnit = 7;
  const heroTop = y + 52 + (player ? player.height * heroUnit : 0);
  const enemy = s.crowd;
  if (enemy) {
    const unit = 3;
    const ew = enemy.width * unit * 2;
    const cols = 4;
    const gapX = (BOX.w - 40 - cols * ew) / (cols - 1);
    // As many rows (up to three) as fit above the hero, centred in the space between.
    const rowH = enemy.height * unit + 18;
    const space = cursor - (heroTop + 54);
    const rows = Math.max(0, Math.min(3, Math.floor((space + 18) / rowH)));
    const first = cursor - (space - (rows * rowH - 18)) / 2;
    for (let r = 0; r < rows; r++) {
      const top = first - r * rowH;
      for (let c = 0; c < cols; c++) {
        const frame = enemy.frames[(r + c) % enemy.frames.length]!;
        drawSprite(page, frame, look.colorsOf(enemy), x + 20 + c * (ew + gapX), top, unit);
      }
    }
  }
  const shot = s.extra;
  if (shot) drawSprite(page, shot.frames[0]!, look.colorsOf(shot), x + BOX.w / 2 - shot.width * 4, heroTop + 14 + shot.height * 4, 4);
  if (player) drawSprite(page, player.frames[0]!, look.colorsOf(player), x + BOX.w / 2 - player.width * heroUnit, heroTop, heroUnit);

  // Bottom strip: players and controller, and the trademark line.
  page.drawRectangle({ x, y, width: BOX.w, height: 34, color: rgb(0, 0, 0) });
  drawKitLines(page, ["1 PLAYER  JOYSTICK"], { x: x + 14, top: y + 25, unit: 1.4, color: PAPER_WHITE, font: fonts.bold, align: "left" });
  page.drawText(PRINT_TRADEMARK, { x: x + 14, y: y + 7, size: 6, font: fonts.body, color: rgb(0.75, 0.76, 0.78) });
  cutMarks(page, x, y, BOX.w, BOX.h);
  registrationMarks(page, x, y, BOX.w, BOX.h, 24);

  // Calibration square.
  const sq = INCH;
  const sx = 54;
  const sy = 36;
  page.drawRectangle({ x: sx, y: sy, width: sq, height: sq, borderColor: INK, borderWidth: 0.75 });
  const note = paper === "a4" ? "Print at actual size (100%). This square should measure 1 inch (2.54 cm)." : "Print at actual size (100%). This square should measure 1 inch.";
  page.drawText(note, { x: sx + sq + 10, y: sy + sq / 2 + 4, size: 8.5, font: fonts.body, color: MUTED });
  page.drawText("Sizes are approximate: check them against your box and cartridge shell.", { x: sx + sq + 10, y: sy + sq / 2 - 9, size: 8.5, font: fonts.body, color: MUTED });
}

function boxBack(doc: PDFDocument, size: [number, number], fonts: Fonts, s: PrintSubject, look: Look, screenshot?: Screenshot) {
  const [pw, ph] = size;
  const page = doc.addPage([pw, ph]);
  const x = (pw - BOX.w) / 2;
  const y = (ph - BOX.h) / 2;
  const ink = onColor(look.background);
  const soft = softOn(look.background);
  caption(page, fonts, "Box back - cut along the marks", y + BOX.h + 34);
  page.drawRectangle({ x, y, width: BOX.w, height: BOX.h, color: look.background });
  const pad = 20;
  const inner = BOX.w - 2 * pad;
  let cursor = y + BOX.h - pad;

  cursor = drawTitle(page, look.title, fonts, { cx: x + BOX.w / 2, top: cursor, width: inner, height: 34, maxLines: 2, maxUnit: 3, minUnit: 1.5 }, ink);
  if (look.madeBy) cursor = centeredLines(page, [printable(`Game by ${look.madeBy}`)], fonts.body, 9, x + BOX.w / 2, cursor - 6, ink);
  cursor -= 10;

  if (screenshot) {
    const shotW = inner - 64;
    const shotH = (shotW * 3) / 4;
    const sx = x + (BOX.w - shotW) / 2;
    drawScreenshot(page, screenshot, sx, cursor - shotH, shotW, shotH);
    page.drawRectangle({ x: sx, y: cursor - shotH, width: shotW, height: shotH, borderColor: look.accent, borderWidth: 2 });
    cursor -= shotH + 14;
  }

  // From the bottom up: the legal small print, then the spec plate.
  const legal = wrap(`${PRINT_COMPAT} ${PRINT_UNTESTED} Made with Cartridge Studio. ${PRINT_TRADEMARK}`, fonts.body, 6.5, inner);
  legal.forEach((line, i) => page.drawText(line, { x: x + pad, y: y + 12 + (legal.length - 1 - i) * 8.5, size: 6.5, font: fonts.body, color: soft }));
  let floor = y + 12 + legal.length * 8.5 + 8;
  if (s.spec) floor = specPlate(page, fonts, specRows(s.spec), x + pad, floor, inner, ink, look.background) + 10;

  const intro = wrap(s.intro, fonts.body, 10, inner);
  for (const line of intro) {
    if (cursor - 14 < floor) break;
    page.drawText(line, { x: x + pad, y: cursor - 10, size: 10, font: fonts.body, color: ink });
    cursor -= 14;
  }
  cursor -= 4;
  for (const fact of s.facts) {
    const lines = wrap(fact, fonts.body, 9.5, inner - 14);
    if (cursor - lines.length * 13 < floor) break;
    page.drawRectangle({ x: x + pad, y: cursor - 8, width: 5, height: 5, color: look.accent });
    for (const line of lines) {
      page.drawText(line, { x: x + pad + 14, y: cursor - 9.5, size: 9.5, font: fonts.body, color: ink });
      cursor -= 13;
    }
    cursor -= 2;
  }
  cutMarks(page, x, y, BOX.w, BOX.h);
  registrationMarks(page, x, y, BOX.w, BOX.h, 24);
}

/** The spec plate: a ruled panel with a kit-font header. Returns its top. */
function specPlate(page: PDFPage, fonts: Fonts, rows: [string, string][], x: number, bottom: number, width: number, ink: RGB, bg: RGB): number {
  const rowH = 11;
  const head = 14;
  const h = head + rows.length * rowH + 6;
  page.drawRectangle({ x, y: bottom, width, height: h, borderColor: ink, borderWidth: 0.75 });
  page.drawRectangle({ x, y: bottom + h - head, width, height: head, color: ink });
  drawKitLines(page, ["CARTRIDGE"], { x: x + 6, top: bottom + h - 4, unit: 1.2, color: bg, font: fonts.bold, align: "left" });
  rows.forEach(([k, v], i) => {
    const ty = bottom + h - head - (i + 1) * rowH + 2;
    page.drawText(k, { x: x + 6, y: ty, size: 7.5, font: fonts.bold, color: ink });
    const value = wrap(v, fonts.body, 7.5, width - 96)[0] ?? "";
    page.drawText(value, { x: x + 90, y: ty, size: 7.5, font: fonts.body, color: ink });
    if (i < rows.length - 1) page.drawLine({ start: { x: x + 6, y: ty - 3 }, end: { x: x + width - 6, y: ty - 3 }, thickness: 0.3, color: ink, opacity: 0.5 });
  });
  return bottom + h;
}

/** A cartridge end-label: the hero on black, an accent stripe, the title on the game's background. */
export function drawLabel(page: PDFPage, fonts: Fonts, x: number, y: number, w: number, h: number, look: Look, hero: PrintSprite | undefined, footer: string, maxUnit = 3) {
  const ink = onColor(look.background);
  page.drawRectangle({ x, y, width: w, height: h, color: look.background });
  const art = Math.round(w * 0.32);
  page.drawRectangle({ x, y, width: art, height: h, color: rgb(0, 0, 0) });
  page.drawRectangle({ x: x + art, y, width: 5, height: h, color: look.accent });
  if (hero) {
    const unit = Math.min((art - 16) / (hero.width * 2), (h - 24) / hero.height);
    drawSprite(page, hero.frames[0]!, look.colorsOf(hero), x + (art - hero.width * unit * 2) / 2, y + (h + hero.height * unit) / 2, unit);
  }
  const textW = w - art - 5 - 16;
  const cx = x + art + 5 + (w - art - 5) / 2;
  const legal = wrap(footer, fonts.body, 5, textW);
  legal.forEach((line, j) => {
    const lw = fonts.body.widthOfTextAtSize(line, 5);
    page.drawText(line, { x: cx - lw / 2, y: y + 6 + (legal.length - 1 - j) * 6.5, size: 5, font: fonts.body, color: softOn(look.background) });
  });
  const floor = y + 6 + legal.length * 6.5 + 6;
  const byH = look.madeBy ? 12 : 0;
  const room = h - (floor - y) - byH - 14;
  // Measure first, then centre the title and credit in the space above the small print.
  const t = printable(look.title);
  const kit = kitFontCovers(t);
  const fit = kit ? fitKitText(t, { width: textW, height: room, maxLines: 4, maxUnit, minUnit: 1 }) : null;
  const titleH = fit ? kitHeight(fit.lines.length, fit.unit) : Math.min(room, 40);
  const top = floor + byH + (room + titleH) / 2 + 4;
  let below = fit
    ? drawKitLines(page, fit.lines, { x: cx, top, unit: fit.unit, color: ink, font: fonts.bold })
    : drawTitle(page, t, fonts, { cx, top, width: textW, height: room, maxLines: 3, maxUnit: 2.6, minUnit: 1.2 }, ink);
  if (look.madeBy) below = centeredLines(page, wrap(`by ${look.madeBy}`, fonts.body, 7, textW).slice(0, 1), fonts.body, 7, cx, below - 4, ink);
  return below;
}

function labels(doc: PDFDocument, size: [number, number], fonts: Fonts, s: PrintSubject, look: Look) {
  const [pw, ph] = size;
  const page = doc.addPage([pw, ph]);
  caption(page, fonts, "Cartridge labels - one spare. Cut along the marks.", ph - 60);
  for (let i = 0; i < 2; i++) {
    const x = (pw - LABEL.w) / 2;
    const y = ph - 130 - LABEL.h - i * (LABEL.h + 80);
    drawLabel(page, fonts, x, y, LABEL.w, LABEL.h, look, s.hero, PRINT_TRADEMARK);
    cutMarks(page, x, y, LABEL.w, LABEL.h);
    registrationMarks(page, x, y, LABEL.w, LABEL.h, 26);
  }
}

// ---- The manual ----

type Block = ManualBlock | { kind: "table"; head: [string, string]; rows: [string, string][] } | { kind: "credits" };

/** The manual's content in order: the controls and scoring tables, the creator's text, then the credits page. */
function manualBlocks(s: PrintSubject): Block[] {
  const out: Block[] = [];
  const keyed = s.controls.filter(([k]) => k);
  if (keyed.length) out.push({ kind: "heading", text: "Controls and scoring" }, { kind: "table", head: ["Control", "What it does"], rows: keyed });
  else if (s.controls.length) out.push({ kind: "heading", text: "Controls" }, ...s.controls.map(([, v]): Block => ({ kind: "bullet", text: v })));
  if (s.scoring.length) out.push(...(keyed.length ? [] : [{ kind: "heading", text: "Scoring" } as Block]), { kind: "table", head: ["Scores", "Points"], rows: s.scoring });
  out.push(...parseManual(s.manual), { kind: "credits" });
  return out;
}

/** The credits page's lines: [text, bold]. */
export function creditLines(s: PrintSubject): [string, boolean][] {
  const basic = s.spec?.toolchain.startsWith("7800basic") ? s.spec.toolchain : "7800basic";
  return [
    ...(s.madeBy ? [[`Game by ${s.madeBy}`, true] as [string, boolean]] : []),
    [`Made with Cartridge Studio${s.spec?.app ? ` ${s.spec.app}` : ""}.`, false],
    [`Compiled with ${basic} by Mike Saarna (RevEng), under the GNU GPL v2. Its 6502 runtime is CC0, so the game itself is yours.`, false],
    ["Assembled with dasm, under the GNU GPL v2.", false],
    ["Tried out in js7800, the emulator by raz0red, under the GNU GPL v2 or later.", false],
    ["", false],
    [`${PRINT_COMPAT} ${PRINT_UNTESTED}`, false],
    [PRINT_TRADEMARK, false],
  ];
}

interface ManualLook {
  margin: number;
  /** Body size; headings and tables scale from it. */
  body: number;
  /** Page footers: "plain" names the game and counts pages, "booklet" prints the folio only. */
  footer: "plain" | "booklet";
  /** Booklets end on the credits as the back cover, after blank pages that make the count a multiple of 4. */
  multipleOf?: number;
}

/** Lays the manual out on pages of `size`, added to `doc`, and returns them in order. */
function manualPages(doc: PDFDocument, size: [number, number], fonts: Fonts, s: PrintSubject, look: Look, m: ManualLook): PDFPage[] {
  const [pw, ph] = size;
  const { margin, body } = m;
  const width = pw - 2 * margin;
  const lead = body * 1.4;
  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let cursor = 0;
  const newPage = () => {
    page = doc.addPage([pw, ph]);
    pages.push(page);
    cursor = ph - margin;
  };
  const bottom = margin + 18;
  const need = (h: number) => cursor - h < bottom && newPage();
  newPage();

  // Cover: the title, the maker and the cast.
  cursor = drawTitle(page, look.title, fonts, { cx: pw / 2, top: cursor, width, height: body * 6, maxLines: 2, maxUnit: body * 0.5, minUnit: 1.5 }, INK) - body * 0.6;
  if (look.madeBy) cursor = centeredLines(page, [printable(`by ${look.madeBy}`)], fonts.body, body, pw / 2, cursor, INK) - body * 0.4;
  const cast = s.cast;
  const unit = body / 3.7;
  const gap = body * 1.8;
  const castW = cast.reduce((n, c) => n + c.width * unit * 2, 0) + Math.max(0, cast.length - 1) * gap;
  let cx = (pw - castW) / 2;
  const castH = Math.max(0, ...cast.map((c) => c.height * unit));
  for (const c of cast) {
    drawSprite(page, c.frames[0]!, look.colorsOf(c), cx, cursor - (castH - c.height * unit) / 2, unit);
    cx += c.width * unit * 2 + gap;
  }
  cursor -= castH + body * 1.6;
  page.drawLine({ start: { x: margin, y: cursor }, end: { x: pw - margin, y: cursor }, thickness: 1, color: look.accent });
  cursor -= body * 1.6;

  const heading = (text: string) => {
    need(body * 4);
    cursor -= body * 0.6;
    page.drawText(printable(text), { x: margin, y: cursor - body * 1.25, size: body * 1.25, font: fonts.bold, color: INK });
    cursor -= body * 2;
  };
  const credits = () => {
    // The credits start a page of their own (the back cover, in a booklet).
    if (m.multipleOf) {
      const total = pages.length + 1;
      const pad = (m.multipleOf - (total % m.multipleOf)) % m.multipleOf;
      for (let i = 0; i < pad; i++) newPage();
    }
    newPage();
    heading("Credits");
    for (const [text, bold] of creditLines(s)) {
      if (!text) {
        cursor -= lead;
        continue;
      }
      const font = bold ? fonts.bold : fonts.body;
      const size = bold ? body * 1.15 : body * 0.9;
      for (const line of wrap(text, font, size, width)) {
        need(size * 1.4);
        page.drawText(line, { x: margin, y: cursor - size, size, font, color: INK });
        cursor -= size * 1.4;
      }
      cursor -= size * 0.5;
    }
  };

  for (const block of manualBlocks(s)) {
    if (block.kind === "heading") heading(block.text);
    else if (block.kind === "credits") credits();
    else if (block.kind === "table") {
      const size = body * 0.92;
      const col = Math.round(width * 0.42);
      const rowLead = size * 1.35;
      need(rowLead * 3);
      page.drawText(block.head[0], { x: margin, y: cursor - size, size, font: fonts.bold, color: MUTED });
      page.drawText(block.head[1], { x: margin + col, y: cursor - size, size, font: fonts.bold, color: MUTED });
      cursor -= rowLead + 3;
      page.drawLine({ start: { x: margin, y: cursor + 1 }, end: { x: pw - margin, y: cursor + 1 }, thickness: 0.75, color: INK });
      for (const [k, v] of block.rows) {
        const left = wrap(k, fonts.bold, size, col - 10);
        const right = wrap(v, fonts.body, size, width - col);
        const n = Math.max(left.length, right.length);
        need(n * rowLead + 6);
        cursor -= 4;
        for (let i = 0; i < n; i++) {
          if (left[i]) page.drawText(left[i]!, { x: margin, y: cursor - size, size, font: fonts.bold, color: INK });
          if (right[i]) page.drawText(right[i]!, { x: margin + col, y: cursor - size, size, font: fonts.body, color: INK });
          cursor -= rowLead;
        }
        cursor -= 2;
        page.drawLine({ start: { x: margin, y: cursor }, end: { x: pw - margin, y: cursor }, thickness: 0.4, color: RULE });
      }
      cursor -= body;
    } else {
      const indent = block.kind === "bullet" ? body * 1.45 : 0;
      const lines = wrap(block.text, fonts.body, body, width - indent);
      need(Math.min(lines.length, 3) * lead);
      if (block.kind === "bullet") page.drawRectangle({ x: margin + body * 0.25, y: cursor - body * 0.8, width: body * 0.4, height: body * 0.4, color: INK });
      for (const line of lines) {
        need(lead);
        page.drawText(line, { x: margin + indent, y: cursor - body, size: body, font: fonts.body, color: INK });
        cursor -= lead;
      }
      cursor -= block.kind === "bullet" ? body * 0.25 : body * 0.7;
    }
  }

  pages.forEach((p, i) => {
    if (m.footer === "plain") {
      p.drawText(`${look.title} - manual, page ${i + 1} of ${pages.length}`, { x: margin, y: margin / 2, size: 8, font: fonts.body, color: MUTED });
    } else if (i > 0 && i < pages.length - 1) {
      const folio = String(i + 1);
      const w = fonts.body.widthOfTextAtSize(folio, 8);
      p.drawText(folio, { x: (pw - w) / 2, y: margin / 2, size: 8, font: fonts.body, color: MUTED });
    }
  });
  return pages;
}

/** Booklet page order for saddle stitching: per sheet, [front left, front right, back left, back right] (0-based). */
export function bookletOrder(pages: number): [number, number, number, number][] {
  const sheets: [number, number, number, number][] = [];
  for (let s = 0; s < pages / 4; s++) sheets.push([pages - 1 - 2 * s, 2 * s, 2 * s + 1, pages - 2 - 2 * s]);
  return sheets;
}

/** The trim size of a booklet page on `paper`: half the sheet, less room for the marks. */
export function bookletPageSize(paper: Paper): [number, number] {
  const [w, h] = PAPER_SIZES[paper];
  const bleed = 18;
  return [h / 2 - 2 * bleed, w - 2 * bleed];
}

async function booklet(doc: PDFDocument, paper: Paper, fonts: Fonts, s: PrintSubject, look: Look) {
  const [w, h] = PAPER_SIZES[paper];
  const sheet: [number, number] = [h, w]; // landscape
  const [tw, th] = bookletPageSize(paper);
  const first = doc.getPageCount();
  const pages = manualPages(doc, [tw, th], fonts, s, look, { margin: 30, body: 9.5, footer: "booklet", multipleOf: 4 });
  const embedded = await doc.embedPages(pages);
  for (let i = pages.length - 1; i >= 0; i--) doc.removePage(first + i);

  const order = bookletOrder(pages.length);
  const sheets = order.length;
  order.forEach((sides, n) => {
    for (const side of [0, 1] as const) {
      const page = doc.addPage(sheet);
      const [left, right] = side === 0 ? [sides[0], sides[1]] : [sides[2], sides[3]];
      const y = (sheet[1] - th) / 2;
      [left, right].forEach((p, k) => {
        const x = k * (sheet[0] / 2) + (sheet[0] / 2 - tw) / 2;
        page.drawPage(embedded[p]!, { x, y });
        cutMarks(page, x, y, tw, th, { outline: false, gap: 3, len: 10 });
      });
      // The fold: short dashes in the top and bottom margins, down the middle.
      for (const [y0, y1] of [
        [sheet[1], sheet[1] - y + 4],
        [0, y - 4],
      ] as const) {
        page.drawLine({ start: { x: sheet[0] / 2, y: y0 }, end: { x: sheet[0] / 2, y: y1 }, thickness: 0.5, color: INK, dashArray: [2, 2] });
      }
      const hint =
        side === 0
          ? `Manual, sheet ${n + 1} of ${sheets}, front. Print double-sided, flipping on the short edge, then fold down the dashed line.`
          : `Manual, sheet ${n + 1} of ${sheets}, back.`;
      page.drawText(hint, { x: 40, y: sheet[1] - 12, size: 6.5, font: fonts.body, color: MUTED });
    }
  });
}

export async function buildPrintPdf({ subject, paper, layout = "plain", fonts: fontBytes, screenshot }: PrintOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts: Fonts = {
    body: await doc.embedFont(fontBytes.body, { subset: true }),
    bold: await doc.embedFont(fontBytes.bold, { subset: true }),
  };
  const size = PAPER_SIZES[paper];
  const title = printable(subject.title.trim() || "Untitled");
  doc.setTitle(`${title} - print kit`);
  doc.setCreator("Cartridge Studio");
  if (subject.madeBy) doc.setAuthor(printable(subject.madeBy));

  const colorsOf = (s: PrintSprite | undefined) => (s?.colors ?? ["$0F", "$0F", "$0F"]).map(toRgb);
  const look: Look = {
    title,
    madeBy: subject.madeBy?.trim() ?? "",
    background: toRgb(subject.background ?? "$00"),
    accent: colorsOf(subject.hero)[0]!,
    colorsOf,
  };

  boxFront(doc, size, paper, fonts, subject, look);
  boxBack(doc, size, fonts, subject, look, screenshot);
  labels(doc, size, fonts, subject, look);
  if (layout === "booklet") await booklet(doc, paper, fonts, subject, look);
  else manualPages(doc, size, fonts, subject, look, { margin: 60, body: 11, footer: "plain" });
  return doc.save();
}

/** Re-exported for the First boot card, which shares the label's look. */
export { onColor, wrap, printable, drawKitLines, kitLines, kitWidth, cutMarks, drawSprite };
export type { Fonts as EmbeddedFonts, Look as PrintLook };
