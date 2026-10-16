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
});
