// Pure operations on sprite frames in the project format: one string per row,
// `0` transparent and `1`-`3` the palette's colors. Every function returns a
// new frame and leaves its input alone.

export type Frame = string[];
export type PixelValue = 0 | 1 | 2 | 3;

export function getPixel(frame: Frame, x: number, y: number): PixelValue | undefined {
  const c = frame[y]?.charCodeAt(x);
  return c === undefined || Number.isNaN(c) ? undefined : ((c - 48) as PixelValue);
}

/** Sets several pixels at once; points outside the frame are ignored. */
export function setPixels(frame: Frame, points: Iterable<[number, number]>, v: PixelValue): Frame {
  const rows = frame.map((r) => r.split(""));
  for (const [x, y] of points) {
    const row = rows[y];
    if (row && x >= 0 && x < row.length) row[x] = String(v);
  }
  return rows.map((r) => r.join(""));
}

/** Integer points from (x0, y0) to (x1, y1) inclusive (Bresenham), so fast strokes have no gaps. */
export function linePoints(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const points: [number, number][] = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    points.push([x0, y0]);
    if (x0 === x1 && y0 === y1) return points;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/** Fills the 4-connected area of the color at (x, y) with `v`. */
export function floodFill(frame: Frame, x: number, y: number, v: PixelValue): Frame {
  const target = getPixel(frame, x, y);
  if (target === undefined || target === v) return frame;
  const h = frame.length;
  const w = frame[0]!.length;
  const seen = new Uint8Array(w * h);
  const fill: [number, number][] = [];
  const stack: [number, number][] = [[x, y]];
  while (stack.length) {
    const [px, py] = stack.pop()!;
    if (px < 0 || py < 0 || px >= w || py >= h || seen[py * w + px]) continue;
    seen[py * w + px] = 1;
    if (getPixel(frame, px, py) !== target) continue;
    fill.push([px, py]);
    stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
  }
  return setPixels(frame, fill, v);
}

export const flipHorizontal = (frame: Frame): Frame => frame.map((r) => r.split("").reverse().join(""));
export const flipVertical = (frame: Frame): Frame => [...frame].reverse();
export const clearFrame = (frame: Frame): Frame => frame.map((r) => "0".repeat(r.length));

/** Moves every pixel by (dx, dy), wrapping around the edges. */
export function shift(frame: Frame, dx: number, dy: number): Frame {
  const h = frame.length;
  const w = frame[0]?.length ?? 0;
  return frame.map((_, y) => {
    const src = frame[(((y - dy) % h) + h) % h]!;
    let row = "";
    for (let x = 0; x < w; x++) row += src[(((x - dx) % w) + w) % w];
    return row;
  });
}
