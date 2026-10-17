// Cartridge Studio's icons: filled square pixels on a 10 × 10 grid, drawn at
// 2× (20 px) with crisp edges, in the text colour. A small set for controls
// whose label is a word too many (the emulator's buttons, undo and redo,
// copy, close, a menu's chevron) and one mark for errors. Always decorative:
// the button's label or aria-label says what it does (design/DIRECTION.md §8).

const GLYPHS = {
  play: ["..#.......", "..##......", "..###.....", "..####....", "..#####...", "..#####...", "..####....", "..###.....", "..##......", "..#......."],
  pause: ["..........", ".###..###.", ".###..###.", ".###..###.", ".###..###.", ".###..###.", ".###..###.", ".###..###.", ".###..###.", ".........."],
  restart: ["..........", ".##....##.", ".##...###.", ".##..####.", ".##.#####.", ".##.#####.", ".##..####.", ".##...###.", ".##....##.", ".........."],
  sound: ["...##.....", "..###...#.", "#####.#..#", "#####..#.#", "#####..#.#", "#####..#.#", "#####..#.#", "#####.#..#", "..###...#.", "...##....."],
  mute: ["...##.....", "..###.....", "#####.....", "#####.#..#", "#####..##.", "#####..##.", "#####.#..#", "#####.....", "..###.....", "...##....."],
  undo: ["..#.......", ".##.......", "#######...", "########..", ".##...###.", "..#....##.", ".......##.", "......###.", "..#####...", "..####...."],
  redo: [".......#..", ".......##.", "...#######", "..########", ".###...##.", ".##....#..", ".##.......", ".###......", "...#####..", "....####.."],
  copy: ["..........", ".######...", ".#....#...", ".#..######", ".#..#....#", ".#..#....#", ".####....#", "....#....#", "....######", ".........."],
  close: ["..........", ".##....##.", ".###..###.", "..######..", "...####...", "...####...", "..######..", ".###..###.", ".##....##.", ".........."],
  chevron: ["..........", "..........", "..........", ".##....##.", ".###..###.", "..######..", "...####...", "....##....", "..........", ".........."],
  error: ["##########", "####..####", "####..####", "####..####", "####..####", "####..####", "##########", "####..####", "####..####", "##########"],
} as const;

/**
 * Names that no longer draw anything: the brief removed icons from the Show
 * it buttons and the TV button, whose labels say everything. They stay
 * typed until ShowItPanel and PreviewPanel stop passing them.
 */
type Retired = "cartridge" | "print" | "send" | "clip" | "tv";

export type IconName = keyof typeof GLYPHS | Retired;

/** Horizontal runs of lit pixels, so each glyph is a handful of rects. */
function runs(rows: readonly string[]): { x: number; y: number; w: number }[] {
  const out: { x: number; y: number; w: number }[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== "#") continue;
      const start = x;
      while (row[x + 1] === "#") x++;
      out.push({ x: start, y, w: x - start + 1 });
    }
  });
  return out;
}

/** `size` is 10, 20 or 30: whole screen pixels per glyph pixel. */
export function Icon({ name, size = 20 }: { name: IconName; size?: 10 | 20 | 30 }) {
  if (!(name in GLYPHS)) return null;
  return (
    <svg
      className="ico"
      width={size}
      height={size}
      viewBox="0 0 10 10"
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {runs(GLYPHS[name as keyof typeof GLYPHS]).map((r) => (
        <rect key={`${r.x},${r.y}`} x={r.x} y={r.y} width={r.w} height={1} />
      ))}
    </svg>
  );
}
