// The Cartridge Studio mark: a chunky cartridge with a four-pixel spark on
// its label. Original artwork; see design/DIRECTION.md.

import { fontRows } from "../kit/font.ts";

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {/* Shell, with a keycap-style shadow edge. */}
      <path d="M6 5.5A2.5 2.5 0 0 1 8.5 3h15A2.5 2.5 0 0 1 26 5.5V22l-3 3v3.5H9V25l-3-3Z" fill="var(--brand-edge)" transform="translate(0 1.5)" />
      <path d="M6 5.5A2.5 2.5 0 0 1 8.5 3h15A2.5 2.5 0 0 1 26 5.5V22l-3 3v3.5H9V25l-3-3Z" fill="var(--brand-body)" />
      {/* Label. */}
      <rect x="9" y="6" width="14" height="11" rx="1.5" fill="var(--brand-label)" />
      {/* The spark: four square pixels. */}
      <rect x="15" y="7.5" width="2" height="2" fill="var(--brand-body)" />
      <rect x="12.5" y="10.5" width="2" height="2" fill="var(--brand-body)" />
      <rect x="17.5" y="10.5" width="2" height="2" fill="var(--brand-body)" />
      <rect x="15" y="13.5" width="2" height="2" fill="var(--brand-body)" />
      {/* Contacts. */}
      <path d="M11 25.5v2M14 25.5v2M18 25.5v2M21 25.5v2" stroke="var(--brand-edge)" strokeWidth="1.5" />
    </svg>
  );
}

/** "CARTRIDGE STUDIO" in the kit's own 3×5 font: the letters every game's title screen uses. */
export function Wordmark({ pixel = 3 }: { pixel?: number }) {
  const rows = fontRows("CARTRIDGE STUDIO").slice(1, 6);
  const runs: { x: number; y: number; w: number }[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "0") continue;
      const start = x;
      while (x + 1 < row.length && row[x + 1] !== "0") x++;
      runs.push({ x: start, y, w: x - start + 1 });
    }
  });
  const width = rows[0]!.length - 1;
  return (
    <svg
      className="brand-name"
      width={width * pixel}
      height={5 * pixel}
      viewBox={`0 0 ${width} 5`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="Cartridge Studio"
    >
      {runs.map((r) => (
        <rect key={`${r.x},${r.y}`} x={r.x} y={r.y} width={r.w} height={1} />
      ))}
    </svg>
  );
}
