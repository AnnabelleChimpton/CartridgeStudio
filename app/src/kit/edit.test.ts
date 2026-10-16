import { describe, expect, it } from "vitest";
import { SOUND_LIBRARY } from "../project/templates.ts";
import { addThing, cellAt, paintCell, placements, removeThing, resizeThing, setAnimated, setBehaviour } from "./edit.ts";
import { validateKit } from "./generate.ts";
import { KIT_PRESETS } from "./presets.ts";

const preset = (id: string) => structuredClone(KIT_PRESETS.find((p) => p.id === id)!.game);

describe("kit presets", () => {
  it("are the three spike genres, all valid", () => {
    expect(KIT_PRESETS.map((p) => p.id)).toEqual(["shooter", "maze", "dodger"]);
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
