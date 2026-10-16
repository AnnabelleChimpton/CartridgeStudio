import { describe, expect, it } from "vitest";
import { KIT_PRESETS } from "../kit/presets.ts";
import { controlsText, playerInfo } from "./game-info.ts";

const preset = (id: string) => KIT_PRESETS.find((p) => p.id === id)!.game;

describe("what the player learns from a game", () => {
  it("reads each starter's controls from its things", () => {
    expect(playerInfo(preset("dodger")).controls).toEqual({ move: "lr", button: "start" });
    expect(playerInfo(preset("shooter")).controls).toEqual({ move: "lr", button: "fire" });
    expect(playerInfo(preset("ghost-panic")).controls).toEqual({ move: "free", button: "start" });
    expect(playerInfo(preset("maze")).controls).toEqual({ move: "free", button: "start" });
  });

  it("says the controls in words, without promising a fire button that does nothing", () => {
    expect(controlsText(playerInfo(preset("dodger")).controls)).toEqual({
      keys: "Left and right arrows move. Space or Z starts the game. P pauses. Gamepads work too.",
      touch: "Tap Start to begin. The arrows move.",
    });
    expect(controlsText(playerInfo(preset("shooter")).controls).keys).toContain("Space or Z fires.");
  });

  it("reads hand-written code from its joystick reads", () => {
    const code = (source: string) => playerInfo({ code: 1, title: "x", source, palettes: [], graphics: [] }).controls;
    expect(code("if joy0left then x = x - 1\nif joy0right then x = x + 1")).toEqual({ move: "lr", button: "start" });
    expect(code("if joy0up then y = y - 1\nif joy0fire then gosub shoot")).toEqual({ move: "free", button: "button" });
    expect(code("drawscreen")).toEqual({ move: "free", button: "button" });
  });

  it("takes the hero and a few others for the box front", () => {
    const art = playerInfo(preset("shooter")).art!;
    expect(art.sprites.length).toBeGreaterThan(1);
    expect(art.sprites.length).toBeLessThanOrEqual(4);
    expect(art.background).toMatch(/^\$[0-9A-F]{2}$/i);
    // The hero comes first.
    const hero = preset("shooter").types.find((t) => t.control)!;
    expect(art.sprites[0]!.rows).toEqual(hero.frames[0]);
  });

  it("copes with anything", () => {
    for (const g of [null, 3, "x", [], {}, { kit: 1, types: "no" }, { graphics: [{ rows: ["9"] }] }]) {
      expect(() => playerInfo(g)).not.toThrow();
    }
    expect(playerInfo({}).art).toBeUndefined();
  });
});
