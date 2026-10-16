import { describe, expect, it } from "vitest";
import { toColor } from "../ui/ntsc.ts";
import {
  NTSC,
  bestColors,
  colorDistance,
  convert,
  cropRect,
  detectBackground,
  displayAspect,
  makePixels,
  quantize,
  removeBackground,
  resample,
  toSpriteSize,
  type Pixels,
  type RGB,
} from "./import.ts";

const RED: RGB = [220, 30, 30];
const BLUE: RGB = [30, 40, 220];
const WHITE: RGB = [250, 250, 250];
const BLACK: RGB = [5, 5, 5];

/** An image from rows of letters, each a color in `key` ('.' is transparent). */
function image(rows: string[], key: Record<string, RGB>): Pixels {
  const p = makePixels(rows[0]!.length, rows.length);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const k = (y * p.width + x) * 4;
      if (ch === ".") return;
      p.data.set([...key[ch]!, 255], k);
    }),
  );
  return p;
}

const at = (p: Pixels, x: number, y: number) => [...p.data.slice((y * p.width + x) * 4, (y * p.width + x) * 4 + 4)];

describe("crop and 2:1 resampling", () => {
  it("crops to the sprite's on-screen shape, which is twice as wide", () => {
    expect(displayAspect(16, 16)).toBe(2);
    expect(displayAspect(8, 16)).toBe(1);
    // A square picture into a 16×16 sprite (shown 32×16): full width, half height.
    expect(cropRect(100, 100, 2, "fill")).toEqual({ x: 0, y: 25, w: 100, h: 50 });
    // Fit shows everything: the crop grows to cover the picture.
    expect(cropRect(100, 100, 2, "fit")).toEqual({ x: -50, y: 0, w: 200, h: 100 });
    // A tall 4×16 sprite (shown 8×16) on a wide picture.
    expect(cropRect(200, 100, 0.5, "fill")).toEqual({ x: 75, y: 0, w: 50, h: 100 });
  });

  it("zooms around a centre and keeps the crop on the picture", () => {
    expect(cropRect(100, 100, 2, "fill", 2, 50, 50)).toEqual({ x: 25, y: 37.5, w: 50, h: 25 });
    expect(cropRect(100, 100, 2, "fill", 2, 0, 0)).toEqual({ x: 0, y: 0, w: 50, h: 25 });
    expect(cropRect(100, 100, 2, "fill", 2, 999, 999)).toEqual({ x: 50, y: 75, w: 50, h: 25 });
  });

  it("averages each sprite pixel from a patch twice as wide as tall", () => {
    // 4×2 picture, shown shape of a 2×2 sprite: each sprite pixel is a 2×1 patch.
    const src = image(["RRBB", "RBRB"], { R: RED, B: BLUE });
    const small = toSpriteSize(src, 2, 2);
    expect(small.width).toBe(2);
    expect(at(small, 0, 0)).toEqual([...RED, 255]);
    expect(at(small, 1, 0)).toEqual([...BLUE, 255]);
    // A red/blue patch averages to the colour in between.
    expect(at(small, 0, 1)).toEqual([125, 35, 125, 255]);
  });

  it("treats outside the picture as transparent and keeps edge colours true", () => {
    const src = image(["W"], { W: WHITE });
    const out = resample(src, { x: -1, y: 0, w: 2, h: 1 }, 1, 1);
    // Half covered: half alpha, but the colour stays white rather than greying.
    expect(at(out, 0, 0)).toEqual([250, 250, 250, 128]);
  });
});

describe("background", () => {
  const picture = image(
    [
      "WWWWWWWW",
      "WWBBBBWW",
      "WWBWWBWW",
      "WWBBBBWW",
      "WWWWWWWW",
    ],
    { W: WHITE, B: BLACK },
  );

  it("is detected from the corners", () => {
    expect(detectBackground(picture)).toEqual(WHITE);
    // Three corners agree; the odd one out loses.
    const odd = image(["BWWW", "WWWW", "WWWW", "WWWW"], { W: WHITE, B: BLACK });
    expect(detectBackground(odd)).toEqual(WHITE);
    // Already transparent: nothing to take away.
    expect(detectBackground(image(["..", ".."], {}))).toBeNull();
  });

  it("is removed where it touches the edge, keeping enclosed areas", () => {
    const out = removeBackground(picture, WHITE, 20);
    const alpha = (x: number, y: number) => at(out, x, y)[3];
    expect(alpha(0, 0)).toBe(0);
    expect(alpha(7, 4)).toBe(0);
    expect(alpha(2, 1)).toBe(255); // outline
    expect(alpha(3, 2)).toBe(255); // enclosed white
  });

  it("uses the tolerance for near colours", () => {
    const shaded = image(["WG", "GW"], { W: WHITE, G: [215, 215, 215] });
    expect(at(removeBackground(shaded, WHITE, 0), 1, 0)[3]).toBe(255);
    expect(at(removeBackground(shaded, WHITE, 30), 1, 0)[3]).toBe(0);
  });
});

describe("colours", () => {
  it("maps onto an existing palette, with transparent kept", () => {
    const p = image(["RB.", "BRW"], { R: RED, B: BLUE, W: WHITE });
    // Colors 1-3: a red, a blue and white from the console's palette.
    const red = toColor(NTSC.findIndex((c) => colorDistance(c, RED) === Math.min(...NTSC.map((n) => colorDistance(n, RED)))));
    const blue = toColor(NTSC.findIndex((c) => colorDistance(c, BLUE) === Math.min(...NTSC.map((n) => colorDistance(n, BLUE)))));
    expect(quantize(p, [red, blue, "$0F"])).toEqual(["120", "213"]);
  });

  it("picks the best three console colours", () => {
    const p = image(["RRBB", "RRBB", "WWWW"], { R: RED, B: BLUE, W: WHITE });
    const colors = bestColors(p);
    expect(colors).toHaveLength(3);
    expect(new Set(colors).size).toBe(3);
    const frame = quantize(p, colors);
    // Red, blue and white each get their own colour.
    expect(frame[0]![0]).not.toBe(frame[0]![2]);
    expect(frame[2]![0]).not.toBe(frame[0]![0]);
    expect(frame[2]![0]).not.toBe(frame[0]![2]);
    expect(frame[0]).toMatch(/^(.)\1(.)\2$/);
  });

  it("keeps slots near the current palette so shared things change least", () => {
    const p = image(["RB"], { R: RED, B: BLUE });
    const [red] = bestColors(image(["R"], { R: RED }));
    const [blue] = bestColors(image(["B"], { B: BLUE }));
    // Fewer colours than slots: the unused slot keeps its colour.
    expect(bestColors(p, [blue!, "$0F", red!])).toEqual([blue, "$0F", red]);
  });

  it("dithers in-between shades only when asked", () => {
    const grey: RGB = [128, 128, 128];
    const p = image(["GGGGGG", "GGGGGG"], { G: grey });
    const plain = quantize(p, ["$00", "$0F", "$0F"]);
    expect(new Set(plain.join(""))).toHaveProperty("size", 1);
    const mixed = quantize(p, ["$00", "$0F", "$0F"], true);
    expect(mixed.join("")).toMatch(/1/);
    expect(mixed.join("")).toMatch(/[23]/);
  });
});

describe("convert", () => {
  it("turns a picture on paper into a sprite frame", () => {
    // 16×8 picture: a black block on white paper, into a 4×4 sprite (shown 8×4).
    const rows = Array.from({ length: 8 }, (_, y) =>
      Array.from({ length: 16 }, (_, x) => (x >= 4 && x < 12 && y >= 2 && y < 6 ? "B" : "W")).join(""),
    );
    const src = image(rows, { W: WHITE, B: BLACK });
    const { frame } = convert(src, {
      width: 4,
      height: 4,
      crop: cropRect(16, 8, displayAspect(4, 4), "fill"),
      background: detectBackground(src),
      tolerance: 30,
      colors: ["$00", "$08", "$0F"],
      dither: false,
    });
    expect(frame).toEqual(["0000", "0110", "0110", "0000"]);
  });
});
