import { describe, expect, it } from "vitest";
import { paintCell, showCounter } from "./edit.ts";
import { CPU_BUDGET, cpuCost } from "./generate.ts";
import { busyFixes, errorAdvice, explainError } from "./help.ts";
import { KIT_PRESETS } from "./presets.ts";
import type { KitGame } from "./schema.ts";

const preset = (id: string): KitGame => structuredClone(KIT_PRESETS.find((p) => p.id === id)!.game);

describe("busyFixes", () => {
  it("suggests single changes that each make a too-busy game fit", () => {
    const g = preset("maze");
    for (const col of [10, 11, 12, 13, 14]) paintCell(g, col, 5, "ghost");
    expect(cpuCost(g)).toBeGreaterThan(CPU_BUDGET);
    const fixes = busyFixes(g);
    expect(fixes.length).toBeGreaterThan(0);
    expect(fixes[0]!.text).toMatch(/^Take (one Dust ghost|\d of the 7 Dust ghosts) out of the room$/);
    for (const f of fixes) {
      expect(f.enough).toBe(true);
      expect(f.after).toBeLessThanOrEqual(CPU_BUDGET);
    }
  });

  it("offers the costliest rules and an on-screen counter too", () => {
    const g = preset("ghost-panic");
    showCounter(g, "combo", true);
    // Yarn balls, one at a time, until the game is just too busy: then hiding Combo is enough.
    for (let col = 1; col < 19 && cpuCost(g) <= CPU_BUDGET; col++) paintCell(g, col, 9, "yarn");
    expect(cpuCost(g)).toBeGreaterThan(CPU_BUDGET);
    const texts = busyFixes(g, 99).map((f) => f.text);
    expect(texts.some((t) => t.startsWith("Stop showing Combo"))).toBe(true);
  });

  it("every preset fits as shipped", () => {
    for (const p of KIT_PRESETS) expect(cpuCost(p.game), p.id).toBeLessThanOrEqual(CPU_BUDGET);
  });
});

describe("errorAdvice", () => {
  it("says what to do next for the errors a creator can cause", () => {
    expect(errorAdvice("Put at least one thing in the room.")).toMatch(/Room/);
    expect(errorAdvice('"Hero" is moved by joystick 2: two players are coming soon (the "Player 2" part is reserved).')).toMatch(/for now/);
    expect(errorAdvice("Rule 3 mentions \"x\", which doesn't exist.")).toMatch(/Rules/);
    expect(errorAdvice("This room is too busy for the console to run smoothly")).toMatch(/meter/);
    expect(errorAdvice("Something unheard of")).toBeNull();
    expect(explainError("This room is too busy for the console to run smoothly (it needs 105% of each frame). Remove some things or rules.").text).toBe(
      "This room is too busy for the console to run smoothly. Remove some things or rules.",
    );
  });
});

describe("presets", () => {
  it("each has two or three ideas, and ideas name things the preset has", () => {
    for (const p of KIT_PRESETS) {
      expect(p.ideas.length, p.id).toBeGreaterThanOrEqual(2);
      expect(p.ideas.length, p.id).toBeLessThanOrEqual(3);
      for (const i of p.ideas) if (i.thing) expect(p.game.types.some((t) => t.id === i.thing), `${p.id}: ${i.thing}`).toBe(true);
    }
  });
});
