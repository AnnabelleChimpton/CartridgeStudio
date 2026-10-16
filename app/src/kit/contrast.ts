// Contrast checks for what a kit game puts on screen. Each check compares a
// color with the background using the WCAG contrast ratio, computed from the
// editor's NTSC approximation (ui/ntsc.ts). These are advice, never build
// errors: a dim color can be a deliberate choice.

import { colorName, ntscRgb, toColor } from "../ui/ntsc.ts";
import type { KitGame, KitType } from "./schema.ts";

/** Score and title text: WCAG's ratio for large text and graphics. */
export const TEXT_RATIO = 3;
/** Walls, spikes, goals and things: big blocks of color, so a lower bar. */
export const SHAPE_RATIO = 2;

const linear = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance of a palette value such as `$3A`. */
export function luminance(color: string): number {
  const [r, g, b] = ntscRgb(parseInt(color.slice(1), 16));
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio between two palette values, from 1 (the same) to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The nearest color that reaches `ratio` against `background`: same hue,
 * changing only how light it is, so a creator's choice keeps its character.
 * If no shade of that hue gets there, the gray with the most contrast.
 */
export function clearerColor(color: string, background: string, ratio: number): string {
  const value = parseInt(color.slice(1), 16);
  const hue = value & 0xf0;
  const luma = value & 15;
  let best: string | null = null;
  let bestDistance = Infinity;
  for (let l = 0; l < 16; l++) {
    const c = toColor(hue | l);
    if (contrastRatio(c, background) < ratio) continue;
    const d = Math.abs(l - luma);
    if (d < bestDistance) {
      best = c;
      bestDistance = d;
    }
  }
  if (best) return best;
  return contrastRatio("$0F", background) >= contrastRatio("$00", background) ? "$0F" : "$00";
}

/** Where a color is set, so the editor can change it. */
export type ColorSlot = { palette: string; index: number };

export interface ContrastWarning {
  /** Stable id for tests and keys, e.g. `text`, `spikes`, `thing:cat:2`. */
  id: string;
  /** What is hard to see, in plain words: "The score and title text". */
  what: string;
  /** The same, mid-sentence: "the score and title text", or a thing's name as written. */
  object: string;
  color: string;
  slot: ColorSlot;
  ratio: number;
  /** The ratio it should reach. */
  target: number;
  suggestion: string;
}

const warn = (g: KitGame, id: string, what: string, object: string, slot: ColorSlot, target: number): ContrastWarning | null => {
  const color = g.palettes.find((p) => p.id === slot.palette)?.colors[slot.index];
  if (!color) return null;
  const ratio = contrastRatio(color, g.background);
  if (ratio >= target) return null;
  return { id, what, object, color, slot, ratio, target, suggestion: clearerColor(color, g.background, target) };
};

const roomHas = (g: KitGame, tile: string) => g.room.rows.some((r) => [...r].some((ch) => g.room.legend[ch] === tile));

/** The game-wide colors: text, walls, spikes and goals (only those the room uses). */
export function gameContrast(g: KitGame): ContrastWarning[] {
  const wall = g.wallPalette;
  return [
    warn(g, "text", "The score and title text", "the score and title text", { palette: g.textPalette, index: 0 }, TEXT_RATIO),
    roomHas(g, "wall") ? warn(g, "walls", "The walls", "the walls", { palette: wall, index: 0 }, SHAPE_RATIO) : null,
    roomHas(g, "hazard") ? warn(g, "spikes", "The spikes", "the spikes", { palette: wall, index: 2 }, SHAPE_RATIO) : null,
    roomHas(g, "goal") ? warn(g, "goals", "The goals (drawn in the wall shade)", "the goals", { palette: wall, index: 1 }, SHAPE_RATIO) : null,
  ].filter((w): w is ContrastWarning => w !== null);
}

/** Color numbers (1-3) a thing's pictures actually use. */
function usedColors(t: KitType): number[] {
  const used = new Set<number>();
  for (const f of t.frames) for (const row of f) for (const ch of row) if (ch >= "1" && ch <= "3") used.add(Number(ch));
  return [...used].sort();
}

/**
 * A thing is hard to see when none of the colors in its picture stands out
 * from the background. Outlines in a dark color are fine as long as some
 * other part shows, so only the thing's clearest color is checked.
 */
export function thingContrast(g: KitGame, t: KitType): ContrastWarning | null {
  const palette = g.palettes.find((p) => p.id === t.palette);
  const used = usedColors(t).filter((n) => palette?.colors[n - 1]);
  if (!palette || used.length === 0) return null;
  const clearest = used.reduce((a, b) => (contrastRatio(palette.colors[b - 1]!, g.background) > contrastRatio(palette.colors[a - 1]!, g.background) ? b : a));
  return warn(g, `thing:${t.id}`, t.label, t.label, { palette: t.palette, index: clearest - 1 }, SHAPE_RATIO);
}

/** Every warning in the game, game-wide colors first. */
export function allContrast(g: KitGame): ContrastWarning[] {
  return [...gameContrast(g), ...g.types.map((t) => thingContrast(g, t)).filter((w): w is ContrastWarning => w !== null)];
}

const ratioText = (r: number) => `${r.toFixed(1)} to 1`;
const named = (c: string) => `${c} ${colorName(c)}`;

/** The note: both colors and the measured ratio, e.g. "The spikes: $00 black on $00 black, 1.0 to 1. Aim for 2 to 1 or more." */
export function contrastMessage(w: ContrastWarning, background: string): string {
  return `${w.what}: ${named(w.color)} on ${named(background)}, ${ratioText(w.ratio)}. Aim for ${w.target} to 1 or more.`;
}

/** The fix, saying exactly what it changes: "Use $0F white for the score and title text: 17.4 to 1". */
export function contrastFix(w: ContrastWarning, background: string): string {
  return `Use ${named(w.suggestion)} for ${w.object}: ${ratioText(contrastRatio(w.suggestion, background))}`;
}
