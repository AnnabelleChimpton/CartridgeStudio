// The Cartridge Studio mark and the kit-font display text. Both are drawn
// from the kit's own 3×5 font (kit/font.ts), the letters every game's title
// screen uses. See design/DIRECTION.md, §2 and §8.

import { glyphRuns, MARK_GRID, markRects } from "./brand.ts";

/** The cartridge with "CS" on its label (ui/brand.ts). The icons and favicon are generated from the same rects. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox={`0 0 ${MARK_GRID} ${MARK_GRID}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {markRects().map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={`var(--${r.role})`} />
      ))}
    </svg>
  );
}

/** "CARTRIDGE STUDIO" in the kit's 3×5 font. */
export function Wordmark({ pixel = 3 }: { pixel?: number }) {
  return <KitText text="Cartridge Studio" scale={pixel} className="brand-name" maxChars={Infinity} />;
}

/** Characters the kit font draws. Anything else falls back to Atkinson bold. */
const KIT_CHARS = /^[A-Z0-9 .!?\-:']+$/;

export const canKitText = (text: string) => KIT_CHARS.test(text.toUpperCase());

/** Words packed into lines of at most `max` characters; a longer word gets a line to itself. */
function lines(text: string, max: number): string[] {
  const out: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = out[out.length - 1];
    if (last !== undefined && last.length + 1 + word.length <= max) out[out.length - 1] = `${last} ${word}`;
    else out.push(word);
  }
  return out;
}

/**
 * A short game-derived title (a preset or game name, the TV title, "BY …")
 * in the kit's 3×5 font, uppercase, as square pixels at an integer scale.
 * The words stay real text for screen readers, search and copying; a title
 * with a character the font lacks is plain Atkinson bold instead.
 */
export function KitText({
  text,
  scale = 3,
  maxChars = 12,
  className = "",
}: {
  text: string;
  /** Screen pixels per font pixel: a whole number, 3 or more. */
  scale?: number;
  /** Wrap at word breaks to keep each line this many characters or fewer. */
  maxChars?: number;
  className?: string;
}) {
  const cls = `kit-text ${className}`.trim();
  if (!canKitText(text) || !text.trim()) return <span className={`${cls} kit-fallback`}>{text}</span>;
  const rows = lines(text.toUpperCase(), maxChars);
  const width = Math.max(...rows.map((l) => l.length)) * 4 - 1;
  // Each line is 5 pixels tall with 3 between lines, as on the title screen.
  const height = rows.length * 8 - 3;
  const s = Math.max(3, Math.round(scale));
  return (
    <span className={cls}>
      <svg width={width * s} height={height * s} viewBox={`0 0 ${width} ${height}`} shapeRendering="crispEdges" aria-hidden="true" focusable="false">
        {rows.flatMap((line, li) =>
          glyphRuns(line).map((r) => <rect key={`${li}:${r.x},${r.y}`} x={r.x} y={li * 8 + r.y} width={r.w} height={1} />),
        )}
      </svg>
      <span className="visually-hidden">{text}</span>
    </span>
  );
}
