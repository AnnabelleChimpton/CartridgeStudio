// The one token set: every colour is an entry from the console's NTSC palette
// (ui/ntsc.ts), named by its $hue luma value. scripts/make-identity.mjs writes
// it out as src/tokens.css, the block in site/styles.css, the manifest and
// theme-color; the player page and the jam gallery inline tokensCss().
// To change a colour, pick another entry here and rerun the script.

import { ntscRgb } from "./ntsc.ts";

/** What each colour is for, as a palette entry. */
export const SEMANTIC = {
  sunken: "00",
  mat: "00",
  // Transparent pixels in the sprite editors: a two-grey checker.
  "checker-a": "01",
  "checker-b": "02",
  bg: "01",
  surface: "02",
  raised: "03",
  "raised-hover": "04",
  line: "04",
  "field-line": "08",
  text: "0F",
  muted: "0B",
  accent: "3B",
  "accent-hover": "3C",
  "accent-text": "3C",
  "accent-soft": "21",
  "on-accent": "20",
  edge: "37",
  focus: "2E",
  ok: "CB",
  "ok-soft": "C1",
  error: "4B",
  "error-soft": "41",
  "on-error": "40",
  teal: "BB",
  "teal-soft": "B1",
  // The bezel's power light: off before the first build, dim while paused, lit while the game runs.
  "power-off": "04",
  "power-paused": "C6",
  "power-on": "CB",
  // The brand mark: the cartridge, its keycap edge, its label and the kit-font letters on it.
  "brand-body": "3B",
  "brand-edge": "37",
  "brand-label": "0F",
  "brand-ink": "01",
  // The 7800basic editor (code/code.css).
  "code-bg": "00",
  "code-gutter-bg": "01",
  "code-active-line": "01",
  "code-text": "0F",
  "code-comment": "0B",
  "code-meta": "0B",
  "code-operator": "0D",
  "code-keyword": "3C",
  "code-number": "BB",
  "code-string": "CB",
  "code-label": "2E",
  "code-builtin": "4B",
  "code-selection": "03",
  "code-marked": "21",
  "code-search": "21",
  "code-search-strong": "22",
} as const;

export type Role = keyof typeof SEMANTIC;

/** Foreground on background pairs that carry text or a needed edge, and the contrast each must reach. */
export const PAIRS: [Role, Role, number][] = [
  ...(["sunken", "bg", "surface", "raised", "raised-hover"] as const).flatMap((s) => [
    ["text", s, 4.5] as [Role, Role, number],
  ]),
  ...(["sunken", "bg", "surface", "raised"] as const).flatMap((s) =>
    (["muted", "accent-text", "ok", "error", "teal"] as const).map((f) => [f, s, 4.5] as [Role, Role, number]),
  ),
  ["field-line", "sunken", 3],
  ["field-line", "surface", 3],
  ["focus", "bg", 3],
  ["focus", "surface", 3],
  ["on-accent", "accent", 4.5],
  ["on-accent", "accent-hover", 4.5],
  ["on-error", "error", 4.5],
  ["bg", "text", 4.5],
  ["bg", "teal", 4.5],
  ["bg", "ok", 4.5],
  ["text", "accent-soft", 4.5],
  ["accent-text", "accent-soft", 4.5],
  ["text", "error-soft", 4.5],
  ["error", "error-soft", 4.5],
  ["text", "teal-soft", 4.5],
  ["teal", "teal-soft", 4.5],
  ["text", "ok-soft", 4.5],
  ["ok", "ok-soft", 4.5],
  ["power-on", "raised", 3],
  ["brand-ink", "brand-label", 4.5],
  ["brand-body", "bg", 3],
  ...(
    ["code-text", "code-comment", "code-meta", "code-operator", "code-keyword", "code-number", "code-string", "code-label", "code-builtin"] as const
  ).flatMap((f) =>
    (["code-bg", "code-gutter-bg", "code-selection", "code-search-strong"] as const).map((b) => [f, b, 4.5] as [Role, Role, number]),
  ),
];

const value = (entry: string) => parseInt(entry, 16);

export function hex(entry: string): string {
  return "#" + ntscRgb(value(entry)).map((c) => c.toString(16).padStart(2, "0")).join("");
}

function luminance(entry: string): number {
  const [r, g, b] = ntscRgb(value(entry)).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG contrast ratio between two palette entries. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Every palette entry the token set uses, in order. */
export const ENTRIES = [...new Set(Object.values(SEMANTIC))].sort((a, b) => value(a) - value(b));

/** A role's colour, for drawing on a canvas. */
export const paint = (role: Role) => hex(SEMANTIC[role]);

/** The page colour, for theme-color and the manifest. */
export const PAGE = hex(SEMANTIC.bg);

/**
 * Shape and motion, shared by the app, the site and the player page.
 * Panels and cards get 4 px, chips and keycaps 2 px. No pills.
 * Ease-out only, 120 to 200 ms: nothing overshoots.
 */
const SHAPE_AND_MOTION = `  --r-sm: 2px;
  --r-md: 2px;
  --r-lg: 4px;
  --scrim: color-mix(in srgb, var(--ntsc-00) 80%, transparent);
  --shadow-2: 0 8px 24px color-mix(in srgb, var(--ntsc-00) 70%, transparent);
  --dur-fast: 120ms;
  --dur: 160ms;
  --dur-slow: 200ms;
  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --font-ui: "Atkinson Hyperlegible", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;`;

/** The :root block: palette entries, then what each is for, then shape and motion. */
export function tokensCss(): string {
  const palette = ENTRIES.map((e) => `  --ntsc-${e.toLowerCase()}: ${hex(e)};`).join("\n");
  const roles = Object.entries(SEMANTIC)
    .map(([role, e]) => `  --${role}: var(--ntsc-${e.toLowerCase()});`)
    .join("\n");
  return `:root {\n${palette}\n\n${roles}\n  --panel: var(--surface);\n\n${SHAPE_AND_MOTION}\n  color-scheme: dark;\n}\n`;
}
