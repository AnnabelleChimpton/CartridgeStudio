import { describe, expect, it } from "vitest";
import { clearFrame, floodFill, flipHorizontal, flipVertical, getPixel, linePoints, setPixels, shift } from "./pixels.ts";

const frame = ["0000", "0110", "0110", "0000"];

describe("pixels", () => {
  it("reads and sets pixels without mutating the input", () => {
    const out = setPixels(frame, [[0, 0], [3, 3], [9, 9]], 3);
    expect(out).toEqual(["3000", "0110", "0110", "0003"]);
    expect(frame[0]).toBe("0000");
    expect(getPixel(out, 0, 0)).toBe(3);
    expect(getPixel(out, 4, 0)).toBeUndefined();
  });

  it("draws gap-free lines in every direction", () => {
    expect(linePoints(0, 0, 3, 0)).toEqual([[0, 0], [1, 0], [2, 0], [3, 0]]);
    expect(linePoints(3, 3, 0, 0)).toEqual([[3, 3], [2, 2], [1, 1], [0, 0]]);
    const steep = linePoints(0, 0, 1, 5);
    expect(steep).toHaveLength(6);
    expect(steep.at(-1)).toEqual([1, 5]);
  });

  it("flood-fills only the connected area", () => {
    expect(floodFill(frame, 0, 0, 2)).toEqual(["2222", "2112", "2112", "2222"]);
    expect(floodFill(frame, 1, 1, 3)).toEqual(["0000", "0330", "0330", "0000"]);
    expect(floodFill(frame, 1, 1, 1)).toBe(frame);
    expect(floodFill(["0100", "0100"], 0, 0, 2)).toEqual(["2100", "2100"]);
  });

  it("flips, clears and shifts", () => {
    expect(flipHorizontal(["0123"])).toEqual(["3210"]);
    expect(flipVertical(["01", "23"])).toEqual(["23", "01"]);
    expect(clearFrame(frame)).toEqual(["0000", "0000", "0000", "0000"]);
    expect(shift(["1000", "0000"], 1, 0)).toEqual(["0100", "0000"]);
    expect(shift(["1000", "0000"], -1, 1)).toEqual(["0000", "0001"]);
  });
});
