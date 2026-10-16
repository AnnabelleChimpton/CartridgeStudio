// Turns a picture into a 160A sprite frame: crop it to the sprite's shape,
// take away the background, shrink it and reduce it to three colors plus
// transparent. Pure maths on RGBA pixel arrays, so it runs in Node tests; the
// dialog (ImportPicture.tsx) does the decoding and drawing.
//
// 160A pixels are twice as wide as they are tall, so a sprite W pixels wide
// shows 2W wide. Crops keep that shape (2W:H) and each sprite pixel averages a
// 2:1 patch of the picture.

import { ntscRgb, toColor } from "../ui/ntsc.ts";
import type { Frame, PixelValue } from "./pixels.ts";

export type RGB = readonly [number, number, number];

/** An image as straight (not premultiplied) RGBA bytes, row by row. */
export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function makePixels(width: number, height: number, data?: ArrayLike<number>): Pixels {
  const out = new Uint8ClampedArray(width * height * 4);
  if (data) out.set(data);
  return { width, height, data: out };
}

/** Width over height of a sprite as the console shows it. */
export const displayAspect = (width: number, height: number) => (width * 2) / height;

export type CropMode = "fill" | "fit";

/**
 * The part of the picture the sprite shows, in picture pixels. "fill" covers
 * the frame with the picture (cutting off edges); "fit" shows all of it (the
 * rest is transparent). `zoom` (1 or more) narrows it around the centre
 * (cx, cy), which is kept so the crop stays over the picture.
 */
export function cropRect(srcW: number, srcH: number, aspect: number, mode: CropMode, zoom = 1, cx = srcW / 2, cy = srcH / 2): Rect {
  const cover = mode === "fill" ? Math.min : Math.max;
  let w = cover(srcW, srcH * aspect);
  let h = w / aspect;
  w /= zoom;
  h /= zoom;
  // When the crop is smaller than the picture it stays inside it; when bigger
  // (fit), the picture stays inside the crop.
  const clamp = (c: number, size: number, src: number) => {
    const lo = Math.min(size / 2, src - size / 2);
    const hi = Math.max(size / 2, src - size / 2);
    return Math.min(hi, Math.max(lo, c));
  };
  const x = clamp(cx, w, srcW) - w / 2;
  const y = clamp(cy, h, srcH) - h / 2;
  return { x, y, w, h };
}

/**
 * Shrinks (or grows) the `rect` part of `src` to `outW` × `outH` by averaging
 * a grid of samples per output pixel. Samples outside the picture count as
 * transparent; colors are averaged weighted by alpha so edges don't go dark.
 */
export function resample(src: Pixels, rect: Rect, outW: number, outH: number): Pixels {
  const out = makePixels(outW, outH);
  const sx = rect.w / outW;
  const sy = rect.h / outH;
  const nx = Math.min(8, Math.max(1, Math.ceil(sx)));
  const ny = Math.min(8, Math.max(1, Math.ceil(sy)));
  const d = src.data;
  for (let oy = 0; oy < outH; oy++) {
    for (let ox = 0; ox < outW; ox++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let j = 0; j < ny; j++) {
        const py = Math.floor(rect.y + (oy + (j + 0.5) / ny) * sy);
        for (let i = 0; i < nx; i++) {
          const px = Math.floor(rect.x + (ox + (i + 0.5) / nx) * sx);
          if (px < 0 || py < 0 || px >= src.width || py >= src.height) continue;
          const k = (py * src.width + px) * 4;
          const alpha = d[k + 3]!;
          r += d[k]! * alpha;
          g += d[k + 1]! * alpha;
          b += d[k + 2]! * alpha;
          a += alpha;
        }
      }
      const o = (oy * outW + ox) * 4;
      if (a > 0) {
        out.data[o] = r / a;
        out.data[o + 1] = g / a;
        out.data[o + 2] = b / a;
      }
      out.data[o + 3] = a / (nx * ny);
    }
  }
  return out;
}

/** Squared color distance, weighted roughly for how eyes see red, green and blue. */
export function colorDistance(a: RGB, b: RGB): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return 2 * dr * dr + 4 * dg * dg + 3 * db * db;
}

/** Tolerance 0-100 as a squared distance: 100 allows each of red, green and blue to differ by 150. */
const toleranceDistance = (tolerance: number) => {
  const t = (Math.max(0, Math.min(100, tolerance)) / 100) * 150;
  return 9 * t * t;
};

const OPAQUE = 128;

const pixelAt = (p: Pixels, i: number): RGB => [p.data[i * 4]!, p.data[i * 4 + 1]!, p.data[i * 4 + 2]!];

/**
 * The background color, guessed from the four corners: the corner color most
 * other corners agree with. Null when the corners are already transparent.
 */
export function detectBackground(p: Pixels): RGB | null {
  const { width: w, height: h } = p;
  // A small patch in each corner, averaged, so one stray pixel doesn't decide.
  const size = Math.max(1, Math.floor(Math.min(w, h) / 12));
  const corners: { rgb: RGB; opaque: boolean }[] = [];
  for (const [x0, y0] of [
    [0, 0],
    [w - size, 0],
    [0, h - size],
    [w - size, h - size],
  ] as const) {
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    let n = 0;
    for (let y = y0; y < y0 + size; y++) {
      for (let x = x0; x < x0 + size; x++) {
        const k = (y * w + x) * 4;
        r += p.data[k]!;
        g += p.data[k + 1]!;
        b += p.data[k + 2]!;
        a += p.data[k + 3]!;
        n++;
      }
    }
    corners.push({ rgb: [r / n, g / n, b / n], opaque: a / n >= OPAQUE });
  }
  const opaque = corners.filter((c) => c.opaque);
  if (opaque.length < 2) return null;
  const near = toleranceDistance(25);
  let best: RGB[] = [];
  for (const c of opaque) {
    const agree = opaque.filter((o) => colorDistance(o.rgb, c.rgb) <= near).map((o) => o.rgb);
    if (agree.length > best.length) best = agree;
  }
  const avg = (i: number) => Math.round(best.reduce((s, c) => s + c[i]!, 0) / best.length);
  return [avg(0), avg(1), avg(2)];
}

/**
 * Makes the background transparent: pixels close to `background` (within
 * `tolerance`, 0-100) that connect to the picture's edge. Enclosed areas of
 * the same color, like the white of an eye, stay.
 */
export function removeBackground(p: Pixels, background: RGB, tolerance: number): Pixels {
  const { width: w, height: h } = p;
  const out = makePixels(w, h, p.data);
  const limit = toleranceDistance(tolerance);
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const isBackground = (i: number) => p.data[i * 4 + 3]! < OPAQUE || colorDistance(pixelAt(p, i), background) <= limit;
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop()!;
    if (seen[i]) continue;
    seen[i] = 1;
    if (!isBackground(i)) continue;
    out.data[i * 4 + 3] = 0;
    const x = i % w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < w * (h - 1)) stack.push(i + w);
  }
  return out;
}

/** The console's 256 colors as RGB, indexed by palette value. */
export const NTSC: readonly RGB[] = Array.from({ length: 256 }, (_, v) => ntscRgb(v));

/** Distinct opaque colors with how often each appears. */
function histogram(p: Pixels): { rgb: RGB; count: number }[] {
  const counts = new Map<number, number>();
  for (let i = 0; i < p.width * p.height; i++) {
    if (p.data[i * 4 + 3]! < OPAQUE) continue;
    const key = (p.data[i * 4]! << 16) | (p.data[i * 4 + 1]! << 8) | p.data[i * 4 + 2]!;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([k, count]) => ({ rgb: [(k >> 16) & 255, (k >> 8) & 255, k & 255] as RGB, count }));
}

const nearestIn = (rgb: RGB, choices: readonly RGB[]) => {
  let best = 0;
  let bestD = Infinity;
  choices.forEach((c, i) => {
    const d = colorDistance(rgb, c);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return { index: best, distance: bestD };
};

/**
 * The (up to) three console colors that best show the picture's opaque
 * pixels, as palette values such as `$3A`. Fewer than three come back when
 * the picture has fewer distinct colors. When `current` (the palette now) is
 * given, colors keep the slot of the current color they're nearest to, so
 * things sharing the palette change as little as possible.
 */
export function bestColors(p: Pixels, current: readonly string[] = []): string[] {
  const hist = histogram(p);
  if (!hist.length) return [];
  const cost = (set: number[]) =>
    hist.reduce((s, { rgb, count }) => s + count * Math.min(...set.map((v) => colorDistance(rgb, NTSC[v]!))), 0);

  // Start from the most common color, then repeatedly add the color that's
  // furthest from what's chosen (weighted by how much of it there is).
  const start: RGB[] = [hist.reduce((a, b) => (b.count > a.count ? b : a)).rgb];
  while (start.length < 3) {
    let far: RGB | null = null;
    let farD = 0;
    for (const { rgb, count } of hist) {
      const d = count * nearestIn(rgb, start).distance;
      if (d > farD) {
        farD = d;
        far = rgb;
      }
    }
    if (!far) break;
    start.push(far);
  }
  let chosen = [...new Set(start.map((rgb) => nearestIn(rgb, NTSC).index))];

  // Then improve: swap any one color for any console color while that helps.
  let best = cost(chosen);
  for (let pass = 0; pass < 4; pass++) {
    let improved = false;
    for (let slot = 0; slot < chosen.length; slot++) {
      for (let v = 0; v < 256; v++) {
        if (chosen.includes(v)) continue;
        const trial = chosen.map((c, i) => (i === slot ? v : c));
        const c = cost(trial);
        if (c < best) {
          best = c;
          chosen = trial;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  // Drop colors nothing uses (a two-color picture gets two).
  const used = new Set(hist.map(({ rgb }) => chosen[nearestIn(rgb, chosen.map((v) => NTSC[v]!)).index]!));
  chosen = chosen.filter((v) => used.has(v));
  return arrangeLike(chosen.map(toColor), current);
}

/** Orders `colors` into three slots so each lands nearest the current color in that slot. */
function arrangeLike(colors: string[], current: readonly string[]): string[] {
  const rgb = (c: string) => NTSC[parseInt(c.slice(1), 16)]!;
  const slots = [0, 1, 2];
  let bestOrder = slots;
  let bestD = Infinity;
  for (const order of [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ]) {
    let d = 0;
    colors.forEach((c, i) => {
      const cur = current[order[i]!];
      if (cur) d += colorDistance(rgb(c), rgb(cur));
    });
    if (d < bestD) {
      bestD = d;
      bestOrder = order;
    }
  }
  const out = slots.map((s) => current[s] ?? colors[0]!);
  colors.forEach((c, i) => (out[bestOrder[i]!] = c));
  return out;
}

/**
 * Reduces `p` to a frame: transparent where alpha is under half, otherwise
 * the nearest of `colors` (palette values for colors 1-3). With `dither`,
 * leftover error spreads to neighbours (Floyd-Steinberg, softened) so
 * in-between shades come out as a mix.
 */
export function quantize(p: Pixels, colors: readonly string[], dither = false): Frame {
  const palette = colors.slice(0, 3).map((c) => NTSC[parseInt(c.slice(1), 16)]!);
  const { width: w, height: h } = p;
  const work = Float32Array.from(p.data);
  const rows: string[] = [];
  const spread = (x: number, y: number, err: number[], f: number) => {
    if (x < 0 || x >= w || y >= h) return;
    const k = (y * w + x) * 4;
    if (work[k + 3]! < OPAQUE) return;
    for (let c = 0; c < 3; c++) work[k + c]! += err[c]! * f * 0.75;
  };
  for (let y = 0; y < h; y++) {
    let row = "";
    for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4;
      if (work[k + 3]! < OPAQUE || !palette.length) {
        row += "0";
        continue;
      }
      const rgb: RGB = [work[k]!, work[k + 1]!, work[k + 2]!];
      const { index } = nearestIn(rgb, palette);
      row += String((index + 1) as PixelValue);
      if (dither) {
        const err = [0, 1, 2].map((c) => rgb[c]! - palette[index]![c]!);
        spread(x + 1, y, err, 7 / 16);
        spread(x - 1, y + 1, err, 3 / 16);
        spread(x, y + 1, err, 5 / 16);
        spread(x + 1, y + 1, err, 1 / 16);
      }
    }
    rows.push(row);
  }
  return rows;
}

export interface ConvertOptions {
  /** Sprite size in its own pixels. */
  width: number;
  height: number;
  crop: Rect;
  /** Null keeps the background. */
  background: RGB | null;
  tolerance: number;
  /** Palette values for colors 1-3 to map onto. */
  colors: readonly string[];
  dither: boolean;
}

/** Picture pixels per displayed sprite pixel height while removing the background. */
const WORK_SCALE = 6;

/**
 * The cropped picture at a working size with the background taken away, in
 * square pixels shaped like the sprite on screen (2W:H). `toSprite` shrinks it
 * to the sprite.
 */
export function prepare(src: Pixels, o: Pick<ConvertOptions, "width" | "height" | "crop" | "background" | "tolerance">): Pixels {
  const work = resample(src, o.crop, o.width * 2 * WORK_SCALE, o.height * WORK_SCALE);
  return o.background ? removeBackground(work, o.background, o.tolerance) : work;
}

/** Shrinks a picture shaped 2W:H to W × H sprite pixels, each from a 2:1 patch. */
export const toSpriteSize = (p: Pixels, width: number, height: number) =>
  resample(p, { x: 0, y: 0, w: p.width, h: p.height }, width, height);

/** The whole conversion: crop, background, shrink, colors. */
export function convert(src: Pixels, o: ConvertOptions): { frame: Frame; small: Pixels } {
  const small = toSpriteSize(prepare(src, o), o.width, o.height);
  return { frame: quantize(small, o.colors, o.dither), small };
}
