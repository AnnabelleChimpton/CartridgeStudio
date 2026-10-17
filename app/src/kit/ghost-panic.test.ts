// Ghost Panic, the starter game that uses the most at once: counters, "only if", timed "turn
// into", every N seconds, flee, the level loop and hazard tiles, together in
// one game. Each test uses the real game with a small change to the room, so
// the moments under test happen next to the cat.

import { beforeAll, describe, expect, it } from "vitest";
import type { WasiBuilder } from "@cartridge-studio/toolchain";
import type { CoreHost } from "../emulator/core-host.ts";
import { runRomOnHost, type Step, type WatchMap } from "../harness/behaviour.ts";
import { nodeBuilder, nodeHost } from "../harness/node.ts";
import { SOUND_LIBRARY } from "../project/templates.ts";
import raw from "../../../templates/kit/games/ghost-panic.json";
import { parseSymbols } from "../emulator/core-host.ts";
import { KitGameSchema, type KitGame } from "./schema.ts";
import { KIT_WATCH, buildKitRom } from "./tests.ts";

const base = KitGameSchema.parse(raw);
const START: Step[] = [{ frames: 5 }, { hold: ["fire"], frames: 2 }, { frames: 2 }];
/** Slots: placed things are sorted by type (cat, ghost, scared, fast ghost, yarn, catnip). */
const WATCH: WatchMap = {
  ...KIT_WATCH,
  level: { symbol: "levelnum" },
  combo: { symbol: "c_combo" },
  ghostA: { symbol: "otype", offset: 1 },
  ghostB: { symbol: "otype", offset: 2 },
  ghostAx: { symbol: "ox", offset: 1 },
};

/** The game with some room cells replaced: [row, col, char]. */
function withCells(...cells: [number, number, string][]): KitGame {
  const g = structuredClone(base);
  const rows = g.room.rows.map((r) => [...r]);
  for (const [r, c, ch] of cells) rows[r]![c] = ch;
  g.room.rows = rows.map((r) => r.join(""));
  return g;
}

let builder: WasiBuilder;
let host: CoreHost;
beforeAll(async () => {
  builder = await nodeBuilder();
  host = await nodeHost();
});

async function run(g: KitGame, steps: Step[]) {
  const rom = await buildKitRom(g, SOUND_LIBRARY, builder);
  if (!rom.ok) throw new Error(rom.failure);
  const r = await runRomOnHost(host, rom.a78, rom.symbols, WATCH, [...START, ...steps]);
  expect(r.failure ?? null).toBeNull();
}

describe("Ghost Panic", () => {
  it("catnip scares every ghost for about 6 seconds, then they turn back", async () => {
    // The top catnip moves right next to the cat.
    const g = withCells([1, 8, " "], [1, 2, "N"]);
    await run(g, [
      { hold: ["right"], frames: 8 },
      { expect: { ghostA: 2, ghostB: 2 } },
      { frames: 300 },
      { expect: { ghostA: 2 } },
      { until: { ghostA: 1, ghostB: 1 }, maxFrames: 120, steps: [{ frames: 1 }] },
    ]);
  });

  it("catching scared ghosts scores 200 each; the bonus is checked before the catch", async () => {
    // A closed corridor on row 9: cat, catnip, then both ghosts against a wall, so fleeing can't save them.
    // (The cat, the top catnip and both ghosts move there.) The cat eats the catnip and waits while
    // the scared ghosts flee into the corner, on top of each other. Both are caught in the same frame,
    // so neither gets the combo bonus: the bonus rule comes first and sees combo 0.
    const g = withCells([1, 1, " "], [1, 8, " "], [1, 18, " "], [9, 18, " "], [9, 1, "P"], [9, 2, "N"], [9, 5, "G"], [9, 6, "G"], [9, 7, "#"]);
    await run(g, [
      { hold: ["right"], frames: 8 },
      { frames: 60 },
      { until: { combo: 2 }, maxFrames: 200, steps: [{ hold: ["right"], frames: 1 }] },
      { expect: { score: 400 } },
    ]);
  });

  it("with a combo going, a catch pays the 300 bonus too", async () => {
    // One ghost starts scared, next to the cat, and the combo is already 1.
    const g = withCells([1, 18, " "], [1, 3, "S"]);
    g.room.legend.S = "scared";
    g.counters.find((c) => c.id === "combo")!.start = 1;
    await run(g, [
      { until: { combo: 2 }, maxFrames: 60, steps: [{ hold: ["right"], frames: 1 }] },
      { expect: { score: 500 } },
    ]);
  });

  it("spikes cost a life", async () => {
    const g = withCells([1, 3, "~"]);
    await run(g, [{ hold: ["right"], frames: 20 }, { expect: { lives: 2 } }]);
  });

  it("clearing the yarn goes up a level; clearing three mazes wins", async () => {
    // One yarn ball, next to the cat. It comes back with each new level.
    const g = withCells(
      ...g0Yarn().map(([r, c]) => [r, c, " "] as [number, number, string]),
      [1, 3, "y"],
    );
    await run(g, [
      { until: { level: 2 }, maxFrames: 60, steps: [{ hold: ["right"], frames: 1 }] },
      { frames: 10 },
      { until: { level: 3 }, maxFrames: 60, steps: [{ hold: ["right"], frames: 1 }] },
      { frames: 10 },
      { until: { state: 2 }, maxFrames: 60, steps: [{ hold: ["right"], frames: 1 }] },
      { expect: { level: 4, score: 30 } },
    ]);
  });

  it("every 15 seconds the ghosts surge for 4 seconds", async () => {
    // Wall the cat into its corner so the ghosts can't catch it while we wait.
    await run(withCells([1, 2, "#"], [2, 1, "#"]), [
      { until: { ghostA: 3 }, maxFrames: 15 * 60 + 30, steps: [{ frames: 1 }] },
      { expect: { seconds: { gte: 14, lte: 15 } } },
      { until: { ghostA: 1 }, maxFrames: 5 * 60, steps: [{ frames: 1 }] },
    ]);
  });

  it("holds 60 fps through catnip, catches and a surge", async () => {
    // Catnip next to the cat, then 20 seconds of wandering (the surge comes at 15).
    const rom = await buildKitRom(withCells([1, 8, " "], [1, 2, "N"]), SOUND_LIBRARY, builder);
    if (!rom.ok) throw new Error(rom.failure);
    const sym = parseSymbols(rom.symbols);
    const loops = () => {
      const b = host.readMemory(sym.get("loopslo")!, 2);
      return b[0]! + 256 * b[1]!;
    };
    await host.load(rom.a78);
    host.step(5);
    host.setInput({ up: false, down: false, left: false, right: false, fire: true });
    host.step(2);
    const l0 = loops();
    const f0 = host.frame;
    const moves = ["right", "down", "right", "up", "left", "down"] as const;
    for (let k = 0; k < 120; k++) {
      const m = moves[Math.floor(k / 20) % moves.length]!;
      host.setInput({ up: m === "up", down: m === "down", left: m === "left", right: m === "right", fire: false });
      host.step(10);
    }
    expect(((loops() - l0) / (host.frame - f0)) * 60).toBeGreaterThanOrEqual(59.5);
  });
});

function g0Yarn(): [number, number][] {
  const out: [number, number][] = [];
  base.room.rows.forEach((r, i) => [...r].forEach((ch, c) => ch === "y" && out.push([i, c])));
  return out;
}
