import { describe, expect, it } from "vitest";
import { colorName, toColor } from "./ntsc.ts";

describe("colorName", () => {
  it("names hue and lightness in plain words", () => {
    expect(colorName("$00")).toBe("black");
    expect(colorName("$0F")).toBe("white");
    expect(colorName("$08")).toBe("gray");
    expect(colorName("$C8")).toBe("sea green");
    expect(colorName("$D7")).toBe("green");
    expect(colorName("$1E")).toBe("pale yellow");
    expect(colorName("$42")).toBe("very dark red");
    expect(colorName("$8b")).toBe("light indigo");
  });

  it("gives every palette value a name", () => {
    const names = Array.from({ length: 256 }, (_, i) => colorName(toColor(i)));
    expect(names.every((n) => /^[a-z ]+$/.test(n))).toBe(true);
  });

  it("names 16 different hue families, from very dark to pale", () => {
    const families = new Set(Array.from({ length: 16 }, (_, h) => colorName(toColor(h * 16 + 8))));
    expect(families.size).toBe(16);
    const shades = Array.from({ length: 16 }, (_, l) => colorName(toColor(0x30 + l)).replace("orange", "").trim());
    expect([...new Set(shades)]).toEqual(["very dark", "dark", "", "light", "pale"]);
  });
});
