import { describe, expect, it } from "vitest";
import { toColor } from "../ui/ntsc.ts";
import { assistData, easierLives, easierOn, easierSpeed, setEasier } from "./assist.ts";
import { allContrast, clearerColor, contrastFix, contrastMessage, contrastRatio, gameContrast, luminance, SHAPE_RATIO, TEXT_RATIO, thingContrast } from "./contrast.ts";
import { loadKit } from "./migrations.ts";
import { KIT_PRESETS } from "./presets.ts";
import type { KitGame } from "./schema.ts";

const preset = (id: string): KitGame => structuredClone(KIT_PRESETS.find((p) => p.id === id)!.game);
const colors = (g: KitGame, id: string) => g.palettes.find((p) => p.id === id)!.colors;

describe("contrast maths", () => {
  it("follows the WCAG formula on the NTSC approximation", () => {
    // ntscRgb($00) is rgb(13 13 13); ntscRgb($0F) is rgb(242 242 242).
    expect(luminance("$00")).toBeCloseTo(0.004, 3);
    expect(luminance("$0F")).toBeCloseTo(0.888, 3);
    expect(contrastRatio("$00", "$0F")).toBeCloseTo(17.36, 2);
    expect(contrastRatio("$0F", "$00")).toBe(contrastRatio("$00", "$0F"));
    expect(contrastRatio("$46", "$46")).toBe(1);
  });

  it("gets lighter as luma goes up, in every hue", () => {
    for (let hue = 0; hue < 16; hue++) {
      const l = Array.from({ length: 16 }, (_, luma) => luminance(toColor(hue * 16 + luma)));
      for (let i = 1; i < 16; i++) expect(l[i]!, `${toColor(hue * 16 + i)}`).toBeGreaterThan(l[i - 1]!);
    }
  });

  it("suggests the nearest shade of the same hue that reads well", () => {
    // Dark blue on black: the suggestion is still blue, just lighter.
    const s = clearerColor("$92", "$00", TEXT_RATIO);
    expect(s.slice(0, 2)).toBe("$9");
    expect(contrastRatio(s, "$00")).toBeGreaterThanOrEqual(TEXT_RATIO);
    expect(contrastRatio(toColor(parseInt(s.slice(1), 16) - 1), "$00")).toBeLessThan(TEXT_RATIO);
    // On a light background it goes darker.
    const d = clearerColor("$3C", "$0E", SHAPE_RATIO);
    expect(parseInt(d.slice(1), 16)).toBeLessThan(0x3c);
    expect(contrastRatio(d, "$0E")).toBeGreaterThanOrEqual(SHAPE_RATIO);
  });

  it("always finds something clearer, for every background", () => {
    for (let bg = 0; bg < 256; bg++) {
      const b = toColor(bg);
      const s = clearerColor(b, b, SHAPE_RATIO);
      expect(contrastRatio(s, b), `${b} -> ${s}`).toBeGreaterThanOrEqual(SHAPE_RATIO);
    }
  });
});

describe("contrast warnings", () => {
  it("the starter games have none", () => {
    for (const p of KIT_PRESETS) expect(allContrast(p.game), p.id).toEqual([]);
  });

  it("warns about text, walls and spikes on the background, and the fix clears it", () => {
    const g = preset("ghost-panic");
    colors(g, g.textPalette)[0] = "$02";
    colors(g, g.wallPalette)[0] = "$01";
    colors(g, g.wallPalette)[2] = "$00";
    const ws = gameContrast(g);
    expect(ws.map((w) => w.id)).toEqual(["text", "walls", "spikes"]);
    expect(ws[0]!.target).toBe(TEXT_RATIO);
    expect(ws[1]!.target).toBe(SHAPE_RATIO);
    expect(contrastMessage(ws[2]!, g.background)).toBe("The spikes: $00 black on $00 black, 1.0 to 1. Aim for 2 to 1 or more.");
    expect(contrastFix(ws[2]!, g.background)).toMatch(/^Use \$0[0-9A-F] [a-z ]+ for the spikes: \d+\.\d to 1$/);
    for (const w of ws) colors(g, w.slot.palette)[w.slot.index] = w.suggestion;
    expect(gameContrast(g)).toEqual([]);
  });

  it("only checks tiles the room uses", () => {
    const g = preset("maze");
    // Maze has no spikes, so a black spike color on black is fine.
    expect(colors(g, g.wallPalette)[2]).toBe("$00");
    expect(gameContrast(g).map((w) => w.id)).not.toContain("spikes");
  });

  it("warns about a thing only when none of its colors stand out", () => {
    const g = preset("maze");
    const t = g.types[0]!;
    const c = colors(g, t.palette);
    c.splice(0, 3, "$00", "$00", "$00");
    expect(thingContrast(g, t)?.id).toBe(`thing:${t.id}`);
    // One bright color is enough: dark outlines are a fine choice.
    const used = new Set(t.frames.flat().join(""));
    const n = [1, 2, 3].find((i) => used.has(String(i)))!;
    c[n - 1] = "$0F";
    expect(thingContrast(g, t)).toBeNull();
  });
});

describe("the easier assist", () => {
  it("slows everything but the player and its shots by one step, down to a quarter pixel", () => {
    const g = preset("shooter");
    const player = g.types.find((t) => t.shoots)!;
    const shot = g.types.find((t) => t.id === player.shoots)!;
    const enemy = g.types.find((t) => t !== player && t !== shot)!;
    expect(easierSpeed(g, player)).toBe(player.speed);
    expect(easierSpeed(g, shot)).toBe(shot.speed);
    enemy.speed = 3;
    expect(easierSpeed(g, enemy)).toBe(2);
    enemy.speed = 1;
    expect(easierSpeed(g, enemy)).toBe(1);
    expect(assistData(g).typeslow).toEqual(g.types.map((t) => (t === player || t === shot ? 0 : 1)));
  });

  it("adds two lives, up to the nine the score line can show", () => {
    expect(easierLives(3)).toBe(5);
    expect(easierLives(8)).toBe(9);
  });

  it("is kept in the game and survives saving and loading", () => {
    const g = preset("maze");
    expect(easierOn(g)).toBe(false);
    setEasier(g, true);
    expect(assistData(g).hasEasier).toBe(true);
    const loaded = loadKit(JSON.parse(JSON.stringify(g)));
    expect(loaded.ok && easierOn(loaded.game)).toBe(true);
    setEasier(g, false);
    expect("assist" in g).toBe(false);
    const off = loadKit(JSON.parse(JSON.stringify({ ...g, assist: { easier: "yes" } })));
    expect(off.ok && easierOn(off.game)).toBe(false);
  });
});
