// Clips: a few seconds of the running game as an animated GIF, for posting.
// Frames arrive as the console's palette indices, so there's no colour
// quantising: the GIF's palette is just the colours the clip uses. Pixels that
// didn't change since the last frame are left transparent, which keeps a
// mostly still screen small.

import { GIFEncoder } from "gifenc";

export const CLIP_WIDTH = 320;
export const CLIP_HEIGHT = 240;

export interface ClipOptions {
  /** RGB triples by console palette index. */
  palette: readonly number[];
  /** Milliseconds per frame. */
  delayMs: number;
  /** Whole-number upscale (2 gives 640×480). */
  scale?: number;
}

export function encodeClip(frames: Uint8Array[], { palette, delayMs, scale = 2 }: ClipOptions): Uint8Array {
  if (frames.length === 0) throw new Error("The clip has no frames.");
  // The colours this clip uses, after index 0 (kept for "unchanged").
  const used = new Set<number>();
  for (const f of frames) for (let i = 0; i < f.length; i++) used.add(f[i]!);
  if (used.size > 255) throw new Error("The clip uses too many colours.");
  const toLocal = new Uint8Array(256);
  const table: number[][] = [[0, 0, 0]];
  for (const c of [...used].sort((a, b) => a - b)) {
    toLocal[c] = table.length;
    table.push([palette[c * 3] ?? 0, palette[c * 3 + 1] ?? 0, palette[c * 3 + 2] ?? 0]);
  }
  // GIF colour tables have a power-of-two size.
  while (table.length & (table.length - 1) || table.length < 2) table.push([0, 0, 0]);

  const w = CLIP_WIDTH * scale;
  const h = CLIP_HEIGHT * scale;
  const gif = GIFEncoder();
  const out = new Uint8Array(w * h);
  let prev: Uint8Array | null = null;
  for (const f of frames) {
    for (let y = 0; y < h; y++) {
      const row = Math.floor(y / scale) * CLIP_WIDTH;
      for (let x = 0; x < w; x++) {
        const i = row + Math.floor(x / scale);
        out[y * w + x] = prev && prev[i] === f[i] ? 0 : toLocal[f[i]!]!;
      }
    }
    gif.writeFrame(out, w, h, prev ? { delay: delayMs, transparent: true, transparentIndex: 0, dispose: 1 } : { palette: table, delay: delayMs, repeat: 0 });
    prev = f;
  }
  gif.finish();
  return gif.bytes();
}
