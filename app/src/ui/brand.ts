// The Cartridge Studio mark as square pixels on a 16 × 16 grid: a cartridge
// with a keycap edge, a square grip bar and "CS" on its label in the kit's
// own 3×5 font. BrandMark.tsx draws it in the app; scripts/make-identity.mjs
// draws the same rects into icon.svg, the PNGs, the favicon and the site mark.

import { fontRows } from "../kit/font.ts";
import type { Role } from "./tokens.ts";

export const MARK_GRID = 16;

export interface MarkRect {
  x: number;
  y: number;
  w: number;
  h: number;
  role: Role;
}

/** Horizontal runs of lit pixels in `text`, from fontRows, with `gap` empty columns between glyphs. */
export function glyphRuns(text: string, gap = 1): { x: number; y: number; w: number }[] {
  const runs: { x: number; y: number; w: number }[] = [];
  let left = 0;
  for (const ch of text) {
    const rows = fontRows(ch).slice(1, 6);
    rows.forEach((row, y) => {
      for (let x = 0; x < 3; x++) {
        if (row[x] === "0") continue;
        const start = x;
        while (x + 1 < 3 && row[x + 1] !== "0") x++;
        runs.push({ x: left + start, y, w: x - start + 1 });
      }
    });
    left += 3 + gap;
  }
  return runs;
}

/** The mark, back to front. */
export function markRects(): MarkRect[] {
  const shape = (dy: number, role: Role): MarkRect[] => [
    { x: 1, y: 1 + dy, w: 14, h: 11, role },
    { x: 3, y: 12 + dy, w: 10, h: 2, role },
  ];
  return [
    // The keycap edge: the same silhouette, one pixel lower.
    ...shape(1, "brand-edge"),
    ...shape(0, "brand-body"),
    { x: 3, y: 2, w: 10, h: 7, role: "brand-label" },
    // "CS", two pixels apart so it sits centred on the label.
    ...glyphRuns("CS", 2).map((r) => ({ x: 4 + r.x, y: 3 + r.y, w: r.w, h: 1, role: "brand-ink" as Role })),
    // The grip bar, square-cornered.
    { x: 3, y: 10, w: 10, h: 1, role: "brand-edge" },
  ];
}
