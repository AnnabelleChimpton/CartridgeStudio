import { describe, expect, it } from "vitest";
import { SOUND_LIBRARY } from "../project/templates.ts";
import { addCounter, addThing, cellAt, makePlayer, moveRule, paintCell, placements, removeCounter, removeThing, resizeThing, setAnimated, setBehaviour, showCounter } from "./edit.ts";
import { validateKit } from "./generate.ts";
import { KIT_PRESETS } from "./presets.ts";

const preset = (id: string) => structuredClone(KIT_PRESETS.find((p) => p.id === id)!.game);

describe("kit presets", () => {
  it("are the spike genres and Ghost Panic, all valid", () => {
    expect(KIT_PRESETS.map((p) => p.id)).toEqual(["shooter", "maze", "ghost-panic", "dodger"]);
    for (const p of KIT_PRESETS) expect(validateKit(p.game, SOUND_LIBRARY).ok, p.id).toBe(true);
  });
});

describe("kit editing", () => {
  it("paints walls, things and empty cells", () => {
    const g = preset("maze");
    paintCell(g, 5, 5, "wall");
    expect(cellAt(g, 5, 5)).toBe("wall");
    paintCell(g, 5, 5, "yarn");
    expect(cellAt(g, 5, 5)).toBe("yarn");
    paintCell(g, 5, 5, "erase");
    expect(cellAt(g, 5, 5)).toBeNull();
    paintCell(g, 99, 5, "wall"); // outside the room: ignored
    expect(g.room.rows.every((r) => r.length === 20)).toBe(true);
  });

  it("keeps a single player: painting it moves it", () => {
    const g = preset("maze");
    paintCell(g, 10, 5, "cat");
    const cats = placements(g).filter((p) => g.types[p.type]!.id === "cat");
    expect(cats).toEqual([{ type: 0, col: 10, row: 5 }]);
  });

  it("adds a thing that can be painted and keeps the game valid", () => {
    const g = preset("dodger");
    const id = addThing(g, "bounce");
    paintCell(g, 3, 3, id);
    expect(cellAt(g, 3, 3)).toBe(id);
    expect(validateKit(g, SOUND_LIBRARY).ok).toBe(true);
  });

  it("removing a thing removes its cells, rules and links", () => {
    const g = preset("shooter");
    removeThing(g, "bomb");
    expect(g.types.some((t) => t.id === "bomb")).toBe(false);
    expect(g.types.find((t) => t.id === "invader")!.drops).toBeUndefined();
    expect(g.rules.some((r) => JSON.stringify(r).includes("bomb"))).toBe(false);
    expect(validateKit(g, SOUND_LIBRARY).ok).toBe(true);

    removeThing(g, "invader");
    expect(g.room.rows.join("")).not.toMatch(/V/);
    expect(validateKit(g, SOUND_LIBRARY).ok).toBe(true);
  });

  it("removing a thing drops the turns and tile rules that use it", () => {
    const g = preset("ghost-panic");
    removeThing(g, "fast-ghost");
    expect(JSON.stringify(g.rules)).not.toContain("fast-ghost");
    expect(g.rules.some((r) => r.then.some((a) => "turnAll" in a && a.turnAll.type === "ghost"))).toBe(true);
    expect(validateKit(g, SOUND_LIBRARY).ok).toBe(true);
    removeThing(g, "cat");
    expect(g.rules.some((r) => "onTile" in r.when)).toBe(false);
  });

  it("adds, shows and removes counters, and their rules go with them", () => {
    const g = preset("ghost-panic");
    const keys = addCounter(g)!;
    showCounter(g, keys);
    showCounter(g, "combo");
    expect(g.counters.filter((c) => c.show).map((c) => c.id)).toEqual(["combo"]);
    g.rules.push({ when: { reaches: [keys, 3] }, then: [{ win: true }] });
    // (Showing a counter costs frame time Ghost Panic doesn't have spare.)
    expect(validateKit(g, SOUND_LIBRARY, { ignoreBudget: true }).ok).toBe(true);
    removeCounter(g, keys);
    removeCounter(g, "combo");
    expect(g.counters).toEqual([]);
    expect(JSON.stringify(g.rules)).not.toMatch(/combo|counter-/);
    expect(g.rules.every((r) => r.then.length > 0 && r.if === undefined)).toBe(true);
    expect(validateKit(g, SOUND_LIBRARY).ok).toBe(true);
    while (addCounter(g));
    expect(g.counters).toHaveLength(4);
  });

  it("moves rules", () => {
    const g = preset("ghost-panic");
    const [a, b] = [g.rules[2], g.rules[3]];
    moveRule(g, 3, 2);
    expect(g.rules.slice(2, 4)).toEqual([b, a]);
    moveRule(g, 0, 99); // out of range: ignored
    expect(g.rules[3]).toBe(a);
  });

  it("resizes and animates a thing", () => {
    const g = preset("maze");
    resizeThing(g, "yarn", 8, 8);
    const yarn = g.types.find((t) => t.id === "yarn")!;
    expect(yarn.frames[0]).toHaveLength(8);
    expect(yarn.frames[0]!.every((r) => r.length === 8)).toBe(true);
    setAnimated(g, "yarn", true);
    expect(yarn.frames).toHaveLength(2);
    setAnimated(g, "yarn", false);
    expect(yarn.frames).toHaveLength(1);
    expect(validateKit(g, SOUND_LIBRARY).ok).toBe(true);
  });

  it("making a thing the player demotes the old player and stops it shooting", () => {
    const g = preset("shooter");
    setBehaviour(g, "invader", "player-lr");
    expect(g.types.find((t) => t.id === "ship")!.behaviour).toBe("still");
    expect(g.types.find((t) => t.id === "ship")!.shoots).toBeUndefined();
    expect(validateKit(g, SOUND_LIBRARY).ok).toBe(true);
    expect(placements(g).filter((p) => g.types[p.type]!.id === "invader")).toHaveLength(1);
    setBehaviour(g, "invader", "march");
    expect(g.types.find((t) => t.id === "invader")!.shoots).toBeUndefined();
  });
});

describe("rule sentences", () => {
  it("reads Ghost Panic's rules as plain English", async () => {
    const { ruleSentence, editableRule } = await import("./sentence.ts");
    const { KitGameSchema } = await import("./schema.ts");
    const raw = (await import("../../../templates/kit/games/ghost-panic.json")).default;
    const g = KitGameSchema.parse(raw);
    const lines = g.rules.map((r) => ruleSentence(r, g));
    expect(lines).toContain("When Cat touches Scared ghost, only if Combo is at least 1: add 300 points and play Chime.");
    expect(lines).toContain("Every 15 seconds: turn every Dust ghost into a Fast ghost for 4 seconds and play Zap.");
    expect(lines).toContain("When the level reaches 4: win the game.");
    expect(g.rules.every(editableRule)).toBe(true);
    expect(editableRule({ when: { someday: 1 }, then: [{ win: true }] } as never)).toBe(false);
  });
});

describe("makePlayer", () => {
  it("gives the player the thing's look, and keeps rules, room and movement as they were", () => {
    const g = preset("maze");
    const before = structuredClone(g);
    const ghost = g.types.find((t) => t.id === "ghost")!;
    const look = { label: ghost.label, frames: ghost.frames, palette: ghost.palette };
    expect(makePlayer(g, "ghost")).toBe("cat");
    const cat = g.types.find((t) => t.id === "cat")!;
    expect({ label: cat.label, frames: cat.frames, palette: cat.palette }).toEqual(look);
    expect(cat.behaviour).toBe("player-4way");
    expect(g.types.find((t) => t.id === "ghost")!.label).toBe("Cat");
    expect(g.rules).toEqual(before.rules);
    expect(g.room).toEqual(before.room);
    expect(validateKit(g, SOUND_LIBRARY).ok).toBe(true);
  });

  it("does nothing for the player itself", () => {
    expect(makePlayer(preset("maze"), "cat")).toBeNull();
  });
});
