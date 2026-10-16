import { describe, expect, it } from "vitest";
import { CLIP_HEIGHT, CLIP_WIDTH, encodeClip } from "./clip.ts";

const palette = Array.from({ length: 256 * 3 }, (_, i) => i % 256);
const frame = (fill: number, dot?: number) => {
  const f = new Uint8Array(CLIP_WIDTH * CLIP_HEIGHT).fill(fill);
  if (dot !== undefined) f[dot] = 0x46;
  return f;
};

describe("encodeClip", () => {
  it("writes an animated GIF89a at twice the size", () => {
    const gif = encodeClip([frame(0), frame(0, 100)], { palette, delayMs: 50 });
    expect(new TextDecoder().decode(gif.subarray(0, 6))).toBe("GIF89a");
    const dv = new DataView(gif.buffer, gif.byteOffset);
    expect([dv.getUint16(6, true), dv.getUint16(8, true)]).toEqual([640, 480]);
    expect(new TextDecoder().decode(gif.subarray(0, 200))).toContain("NETSCAPE2.0"); // loops forever
  });

  it("keeps a still screen small: unchanged pixels are transparent", () => {
    let seed = 1;
    const noise = () => {
      const f = new Uint8Array(CLIP_WIDTH * CLIP_HEIGHT);
      for (let i = 0; i < f.length; i++) f[i] = ((seed = (seed * 1103515245 + 12345) >>> 0) >>> 24) & 15;
      return f;
    };
    const picture = noise();
    const still = encodeClip(Array.from({ length: 10 }, () => picture), { palette, delayMs: 50 });
    const busy = encodeClip(Array.from({ length: 10 }, noise), { palette, delayMs: 50 });
    expect(still.length).toBeLessThan(busy.length / 3);
  });
});
