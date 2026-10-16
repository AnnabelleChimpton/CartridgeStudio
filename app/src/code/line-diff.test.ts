import { describe, expect, it } from "vitest";
import { changedLines } from "./line-diff.ts";

describe("changedLines", () => {
  it("finds changed and inserted lines, but not removed ones", () => {
    expect(changedLines("a\nb\nc", "a\nb\nc")).toEqual([]);
    expect(changedLines("a\nb\nc", "a\nB\nc")).toEqual([{ from: 2, to: 2 }]);
    expect(changedLines("a\nb\nc", "a\nb\nx\ny\nc")).toEqual([{ from: 3, to: 4 }]);
    expect(changedLines("a\nb\nc", "a\nc")).toEqual([]);
    expect(changedLines("a\nb\nc\nd", "x\nb\nc\ny")).toEqual([
      { from: 1, to: 1 },
      { from: 4, to: 4 },
    ]);
  });
});
