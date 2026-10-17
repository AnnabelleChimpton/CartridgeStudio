import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { markRects, MARK_GRID } from "./brand.ts";
import { canKitText } from "./BrandMark.tsx";
import { contrast, PAIRS, SEMANTIC, tokensCss } from "./tokens.ts";

describe("the token set", () => {
  it.each(PAIRS)("%s on %s reaches %d:1", (fg, bg, min) => {
    expect(contrast(SEMANTIC[fg], SEMANTIC[bg])).toBeGreaterThanOrEqual(min);
  });

  it("is what src/tokens.css holds (rerun app/scripts/make-identity.mjs if not)", () => {
    const css = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");
    expect(css).toContain(tokensCss());
  });

  it("has no pills and nothing that overshoots", () => {
    expect(tokensCss()).not.toMatch(/999px|1\.56/);
  });
});

describe("the mark", () => {
  it("stays on its 16 × 16 grid in whole pixels", () => {
    for (const r of markRects()) {
      for (const n of [r.x, r.y, r.w, r.h]) expect(Number.isInteger(n)).toBe(true);
      expect(r.x + r.w).toBeLessThanOrEqual(MARK_GRID);
      expect(r.y + r.h).toBeLessThanOrEqual(MARK_GRID);
    }
  });
});

describe("kit-font text", () => {
  it("draws what the 3×5 font has and falls back for the rest", () => {
    expect(canKitText("Ghost Panic")).toBe(true);
    expect(canKitText("Sam's game 2")).toBe(true);
    expect(canKitText("Cats & dogs")).toBe(false);
    expect(canKitText("Café")).toBe(false);
  });
});
