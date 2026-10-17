// Titles on the printed pieces in the kit's own 3×5 font (kit/font.ts), the
// letters the ROM draws on the title screen. Each glyph pixel is a square
// vector rectangle; the real words go underneath as invisible text, so the
// PDF stays searchable and the title can be selected and copied. A title with
// a character the font lacks (lowercase is fine, "&" or accents are not) is
// set in Atkinson Hyperlegible bold instead.

import { rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { fontRows } from "../kit/font.ts";

/** Characters the 3×5 font draws, after uppercasing. */
const KIT_CHARS = /^[A-Z0-9 .!?\-:']*$/;

export const kitFontCovers = (text: string) => KIT_CHARS.test(text.toUpperCase());

/** Width in font pixels: 4 per character, less the last character's spacing column. */
export const kitWidth = (text: string) => Math.max(0, text.length * 4 - 1);

/** Splits into lines of at most `cols` characters, at spaces where it can. */
export function kitLines(text: string, cols: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.toUpperCase().split(/\s+/).filter(Boolean)) {
    for (let w = word; w; ) {
      const next = line ? `${line} ${w}` : w;
      if (next.length <= cols) {
        line = next;
        w = "";
      } else if (line) {
        lines.push(line);
        line = "";
      } else {
        lines.push(w.slice(0, cols));
        w = w.slice(cols);
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

export interface KitTextOptions {
  /** Centre of the block, or its left edge when `align` is "left". */
  x: number;
  /** Top of the first line. */
  top: number;
  /** One font pixel, in points. */
  unit: number;
  color: RGB;
  /** For the hidden text layer (and the fallback). */
  font: PDFFont;
  align?: "center" | "left";
  /** Space between lines, in font pixels (each line is 5 tall). */
  leading?: number;
}

/** Draws lines of kit-font text; returns the y below the last line. */
export function drawKitLines(page: PDFPage, lines: string[], o: KitTextOptions): number {
  const leading = o.leading ?? 3;
  lines.forEach((line, i) => {
    const w = kitWidth(line) * o.unit;
    const left = o.align === "left" ? o.x : o.x - w / 2;
    const top = o.top - i * (5 + leading) * o.unit;
    // The words, invisible but selectable, sized to the same width.
    const size = Math.max(1, (5 * o.unit) / 0.7);
    const textW = o.font.widthOfTextAtSize(line, size);
    const fitted = textW > 0 ? size * Math.min(1, w / textW) : size;
    page.drawText(line, { x: left, y: top - 5 * o.unit, size: fitted, font: o.font, color: rgb(0, 0, 0), opacity: 0 });
    const rows = fontRows(line).slice(1, 6);
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === "0") continue;
        const start = x;
        while (x + 1 < row.length && row[x + 1] !== "0") x++;
        page.drawRectangle({ x: left + start * o.unit, y: top - (y + 1) * o.unit, width: (x - start + 1) * o.unit, height: o.unit, color: o.color });
      }
    });
  });
  return o.top - lines.length * (5 + leading) * o.unit + leading * o.unit;
}

export interface FitBox {
  width: number;
  height: number;
  maxLines: number;
  /** The largest and smallest pixel size to try, in points. */
  maxUnit: number;
  minUnit: number;
}

/** The largest pixel size (in half-point steps) at which `text` fits the box, and its lines. */
export function fitKitText(text: string, box: FitBox, leading = 3): { unit: number; lines: string[] } {
  for (let unit = box.maxUnit; unit >= box.minUnit; unit -= 0.5) {
    const lines = kitLines(text, Math.floor((box.width / unit + 1) / 4));
    const h = (lines.length * (5 + leading) - leading) * unit;
    if (lines.length && lines.length <= box.maxLines && h <= box.height) return { unit, lines };
  }
  const unit = box.minUnit;
  return { unit, lines: kitLines(text, Math.floor((box.width / unit + 1) / 4)).slice(0, box.maxLines) };
}

/** Height of `n` lines at `unit`. */
export const kitHeight = (n: number, unit: number, leading = 3) => Math.max(0, (n * (5 + leading) - leading) * unit);
