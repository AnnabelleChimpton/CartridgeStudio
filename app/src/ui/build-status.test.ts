import { describe, expect, it } from "vitest";
import { buildStats } from "../code/build-log.ts";
import { builtStatus, cartFill, kb, romBytes } from "./build-status.ts";

// A kit game's report, as 7800basic 0.41 printed it for Teacup Rain.
const LOG = `*** INFO  GFX Block #0 starts @ $E000
*** INFO  GFX block #0 has 1576 bytes left (197 x 8 bytes)
   18107 bytes of ROM space left in the main area.
     2331 bytes left in the 7800basic reserved area.`;

describe("the status line's numbers", () => {
  it("come from the cart size game.bas asks for", () => {
    expect(romBytes(" set romsize 48k\n")).toBe(48 * 1024);
    expect(romBytes("")).toBe(32 * 1024);
  });

  it("count ROM and graphics space left against the cart", () => {
    const fill = cartFill(buildStats(LOG), " set romsize 32k\n")!;
    expect(fill.total).toBe(32768);
    expect(fill.used).toBe(32768 - 18107 - 1576);
    expect(fill.level).toBe("ok");
  });

  it("say when the game doesn't fit", () => {
    expect(cartFill(buildStats("   -12 bytes of ROM space left in the main area."), "")!.level).toBe("over");
    expect(cartFill(buildStats("   1000 bytes of ROM space left in the main area."), "")!.level).toBe("near");
  });

  it("are absent when the build reported no ROM space", () => {
    expect(cartFill(undefined, "")).toBeUndefined();
    expect(cartFill(buildStats(""), "")).toBeUndefined();
  });

  it("read as “Built in 412 ms · 13 of 32 KB”, in seconds from one second up", () => {
    const fill = cartFill(buildStats(LOG), "")!;
    expect(builtStatus(412.4, fill)).toBe("Built in 412 ms · 13 of 32 KB");
    expect(builtStatus(0.3, undefined)).toBe("Built in 0 ms");
    expect(builtStatus(999.7, undefined)).toBe("Built in 1.0 s");
    expect(builtStatus(1260, undefined)).toBe("Built in 1.3 s");
    expect(kb(48 * 1024)).toBe("48");
    expect(kb(2560)).toBe("2.5");
  });

  it("say when the cartridge is nearly full", () => {
    const near = cartFill(buildStats("   1000 bytes of ROM space left in the main area."), "")!;
    expect(builtStatus(300, near)).toBe("Built in 300 ms · 31 of 32 KB, nearly full");
  });
});
