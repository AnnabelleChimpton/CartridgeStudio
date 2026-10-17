import { describe, expect, it } from "vitest";
import { SOUND_LIBRARY } from "../project/templates.ts";
import {
  addCounter,
  addThing,
  cellAt,
  dropsOf,
  makePlayer,
  moveRule,
  paintCell,
  placements,
  removeCounter,
  removeThing,
  resizeThing,
  setAnimated,
  setBehaviour,
  setDrops,
  setShoots,
  setSpeed,
  shootsOf,
  showCounter,
} from "./edit.ts";
import { validateKit } from "./generate.ts";
import { presetOf } from "./parts.ts";
import { KIT_PRESETS } from "./presets.ts";
import { MAX_COUNTERS } from "./schema.ts";

const preset = (id: string) => structuredClone(KIT_PRESETS.find((p) => p.id === id)!.game);

describe("kit presets", () => {
  it("are the spike genres, Ghost Panic and Key Quest, all valid", () => {
    expect(KIT_PRESETS.map((p) => p.id)).toEqual(["shooter", "maze", "ghost-panic", "dodger", "key-quest"]);
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
    expect(dropsOf(g, "invader")).toBeNull();
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
    expect(g.rules.some((r) => r.then.some((a) => "turn" in a && JSON.stringify(a.turn.who) === '{"every":"ghost"}'))).toBe(true);
    expect(validateKit(g, SOUND_LIBRARY).ok).toBe(true);
    removeThing(g, "cat");
    expect(g.rules.some((r) => "onTile" in r.when)).toBe(false);
  });

  it("adds, shows and removes counters, and their rules go with them", () => {
    const g = preset("ghost-panic");
    const keys = addCounter(g)!;
    showCounter(g, keys, true);
    showCounter(g, "combo", true);
    expect(g.hud.map((h) => h.show)).toEqual(["score", "lives", keys, "combo"]);
    g.rules.push({ id: "r-new", when: { test: { a: { counter: keys }, op: "gte", b: 3 } }, then: [{ id: "a-new", gameOver: "won" }] });
    expect(validateKit(g, SOUND_LIBRARY).ok).toBe(true);
    removeCounter(g, keys);
    removeCounter(g, "combo");
    expect(g.counters.map((c) => c.id)).toEqual(["lives", "level", "pace"]);
    expect(g.hud.map((h) => h.show)).toEqual(["score", "lives"]);
    expect(JSON.stringify(g.rules)).not.toMatch(/combo|counter-/);
    expect(g.rules.every((r) => r.then.length > 0)).toBe(true);
    expect(validateKit(g, SOUND_LIBRARY).ok).toBe(true);
    while (addCounter(g));
    expect(g.counters).toHaveLength(MAX_COUNTERS);
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
    expect(shootsOf(g, "basket")).toBe("shot");
    setBehaviour(g, "invader", "player-lr");
    expect(presetOf(g.types.find((t) => t.id === "basket")!)?.behaviour).toBe("still");
    expect(shootsOf(g, "basket")).toBeNull();
    // The march's turn went with the march.
    expect(g.rules.some((r) => "edge" in r.when && r.when.edge[1] === "sides")).toBe(false);
    expect(validateKit(g, SOUND_LIBRARY).ok).toBe(true);
    expect(placements(g).filter((p) => g.types[p.type]!.id === "invader")).toHaveLength(1);
    setBehaviour(g, "invader", "march");
    expect(shootsOf(g, "invader")).toBeNull();
    expect(g.rules.filter((r) => "edge" in r.when && r.when.edge[1] === "sides")).toHaveLength(1);
  });

  it("shooting and dropping are rules the Things tab edits in plain words", () => {
    const g = preset("shooter");
    setShoots(g, "basket", "bomb");
    expect(shootsOf(g, "basket")).toBe("bomb");
    setShoots(g, "basket", null);
    expect(shootsOf(g, "basket")).toBeNull();
    expect(dropsOf(g, "invader")).toEqual({ type: "bomb", chance: 4 });
    setDrops(g, "invader", { type: "bomb", chance: 20 });
    expect(dropsOf(g, "invader")).toEqual({ type: "bomb", chance: 20 });
    setSpeed(g, "invader", 4);
    expect(presetOf(g.types.find((t) => t.id === "invader")!)).toEqual({ behaviour: "march", speed: 4 });
    expect(validateKit(g, SOUND_LIBRARY).ok).toBe(true);
  });
});

describe("rule sentences", () => {
  it("reads Ghost Panic's rules as plain English, and every one can be edited", async () => {
    const { ruleSentence } = await import("./sentence.ts");
    const { editableRule } = await import("./KitRulesPanel.tsx");
    const g = preset("ghost-panic");
    const lines = g.rules.map((r) => ruleSentence(r, g));
    expect(lines).toContain("When Cat touches Scared ghost, only if Combo is at least 1: add 300 points and play Chime.");
    expect(lines).toContain("Every 15 seconds: turn every Dust ghost into a Fast ghost for 4 seconds and play Zap.");
    expect(lines).toContain("When Level is at least 4: win the game.");
    expect(lines).toContain("When the room starts, only if Level is at least 3: set Pace to 1.");
    expect(g.rules.every(editableRule)).toBe(true);
    // A shape the menus don't offer shows as a sentence instead.
    const fancy = { id: "r-x", when: { touch: ["cat", "ghost"] }, then: [{ id: "a-x", step: { who: { nearest: "ghost" }, dx: 8, dy: 0 } }] } as const;
    expect(editableRule(fancy as never)).toBe(false);
    expect(ruleSentence(fancy as never, g)).toBe("When Cat touches Dust ghost: step the nearest Dust ghost by (8, 0).");
  });

  it("every preset's rules can be edited, or read as a sentence", async () => {
    const { ruleSentence } = await import("./sentence.ts");
    const { editableRule } = await import("./KitRulesPanel.tsx");
    for (const p of KIT_PRESETS) {
      for (const r of p.game.rules) {
        expect(ruleSentence(r, p.game), `${p.id} ${r.id}`).toMatch(/^(When|While|Every) .+\.$/);
        // The presets only use words the editor offers, except the rules that come with things
        // (shooting, dropping, the march's turn, falling back to the top), which the Things tab edits.
        if (!editableRule(r)) expect(r.id, p.id).toMatch(/^r-p-(shoot|drop|march|fall)/);
      }
    }
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
    expect(presetOf(cat)?.behaviour).toBe("player-4way");
    expect(g.types.find((t) => t.id === "ghost")!.label).toBe("Cat");
    expect(g.rules).toEqual(before.rules);
    expect(g.room).toEqual(before.room);
    expect(validateKit(g, SOUND_LIBRARY).ok).toBe(true);
  });

  it("does nothing for the player itself", () => {
    expect(makePlayer(preset("maze"), "cat")).toBeNull();
  });
});

describe("what's in the room", () => {
  it("lists each thing with where it starts, then the tiles and exits", async () => {
    const { whatsInTheRoom } = await import("./room-list.ts");
    const lines = whatsInTheRoom(preset("ghost-panic"));
    expect(lines[0]).toBe("Cat, player: moves in 4 directions: row 2, column 2");
    expect(lines).toContain("Dust ghost, chases the player: row 2, column 19");
    expect(lines.some((l) => /^Wall: \d+ squares$/.test(l))).toBe(true);
    expect(lines).toContain("Spikes: row 6 column 10; row 8 column 14");
    expect(whatsInTheRoom(preset("key-quest"), 3).at(-1)).toBe("Exits: left to room 3, up to room 2");
  });
});
