// Cost measurements for the CPU model (not part of the normal run):
//   KIT_MEASURE=1 npx vitest run src/kit/kit-measure.test.ts
// A busy base game (walled room, 8 bouncers) gets "still" fillers, 4 points
// each in the model, until it drops below 60 fps. A feature's cost is how many
// fillers it displaces, times 4, divided by how many copies of it the test adds.

import { beforeAll, describe, it } from "vitest";
import type { WasiBuilder } from "@cartridge-studio/toolchain";
import { parseSymbols, type CoreHost } from "../emulator/core-host.ts";
import { nodeBuilder, nodeHost } from "../harness/node.ts";
import { SOUND_LIBRARY } from "../project/templates.ts";
import { cpuCost, validateKit, type KitOptions } from "./generate.ts";
import type { Behaviour, KitGame, KitMove, KitRule, KitType } from "./schema.ts";
import { buildKitRom } from "./tests.ts";

const box = (w: number, h: number) => Array.from({ length: h }, () => "1".repeat(w));
const type = (id: string, behaviour: Behaviour, extra: Partial<KitType> = {}): KitType => ({
  id, label: id, width: 8, height: 8, frames: [box(8, 8)], palette: "p", behaviour, speed: 3, ...extra,
});

interface Variant {
  name: string;
  copies: number;
  /** Changes the base game; fillers are added afterwards. */
  apply: (g: KitGame) => void;
}

/** Hero, 8 bouncers in a walled room, and `fillers` still things (type "rock"). */
function base(fillers: number, movers = 8, mover: Behaviour = "bounce"): KitGame {
  const rows = ["####################", ...Array.from({ length: 9 }, () => "#                  #"), "####################"].map((r) => [...r]);
  rows[9]![2] = "P";
  for (let k = 0; k < movers; k++) rows[1 + (k % 4) * 2]![2 + Math.floor(k / 4) * 4] = "M";
  for (let k = 0; k < fillers; k++) rows[2 + (k % 7)]![11 + Math.floor(k / 7) * 2] = "R";
  return {
    kit: 1,
    title: "Measure",
    palettes: [{ id: "p", colors: ["$0F", "$46", "$86"] }],
    background: "$00",
    wallPalette: "p",
    textPalette: "p",
    lives: 3,
    types: [type("hero", "player-8way"), type("mover", mover, { speed: 2 }), type("rock", "still"), type("alt", "still")],
    room: { rows: rows.map((r) => r.join("")), legend: { "#": "wall", "~": "hazard", P: "hero", M: "mover", R: "rock" } },
    counters: [],
    rules: [],
    text: { title: "M", win: "W", lose: "L" },
    sounds: {},
    cartridge: { manualText: null },
  };
}

let builder: WasiBuilder;
let host: CoreHost;
beforeAll(async () => {
  builder = await nodeBuilder();
  host = await nodeHost();
});

async function fps(g: KitGame, opts: KitOptions = {}): Promise<number> {
  const rom = await buildKitRom(g, SOUND_LIBRARY, builder, false, { ignoreBudget: true, ...opts });
  if (!rom.ok) throw new Error(rom.failure);
  const s = parseSymbols(rom.symbols);
  const loops = () => {
    const b = host.readMemory(s.get("loopslo")!, 2);
    return b[0]! + 256 * b[1]!;
  };
  await host.load(rom.a78);
  host.step(5);
  host.setInput({ up: false, down: false, left: false, right: false, fire: true });
  host.step(2);
  host.setInput({ up: false, down: false, left: false, right: false, fire: false });
  host.step(10);
  const l0 = loops();
  const f0 = host.frame;
  host.step(360);
  return ((loops() - l0) / (host.frame - f0)) * 60;
}

/** Most fillers that still hold 60 fps. */
async function capacity(make: (fillers: number) => KitGame, opts: KitOptions = {}): Promise<number> {
  let best = -1;
  for (let n = 0; n <= 15; n++) {
    // (24 objects at most: the hero, up to 8 movers and 15 fillers.)
    if ((await fps(make(n), opts)) < 59.5) break;
    best = n;
  }
  return best;
}

const counter = (id: string) => ({ id, label: id, start: 0 });
const touches = (n: number, conds = false): KitRule[] =>
  Array.from({ length: n }, () => ({
    when: { touch: ["hero", "rock"] as [string, string] },
    ...(conds ? { if: [{ counter: "c", op: "eq" as const, value: 0 }, { counter: "level", op: "gte" as const, value: 1 }] } : {}),
    then: [{ score: 10 }],
  }));
const VARIANTS: Variant[] = [
  { name: "baseline", copies: 1, apply: () => {} },
  { name: "touch hero/rock ×4 (reference for conditions)", copies: 4, apply: (g) => g.rules.push(...touches(4)) },
  {
    name: "touch hero/rock ×4 with 2 true conditions each",
    copies: 4,
    apply: (g) => {
      g.counters.push(counter("c"));
      g.rules.push(...touches(4, true));
    },
  },
  { name: "every 1 second ×8 (all firing together)", copies: 8, apply: (g) => g.rules.push(...Array.from({ length: 8 }, (): KitRule => ({ when: { every: 1 }, then: [{ score: 10 }] }))) },
  {
    name: "counter reaches ×8 (never true)",
    copies: 8,
    apply: (g) => {
      g.counters.push(counter("c"));
      g.rules.push(...Array.from({ length: 8 }, (): KitRule => ({ when: { reaches: ["c", 50] }, then: [{ score: 10 }] })));
    },
  },
  { name: "on a tile ×1 over 8 movers", copies: 8, apply: (g) => g.rules.push({ when: { onTile: ["mover", "hazard"] }, then: [{ score: 10 }] }) },
  { name: "timed turns present", copies: 1, apply: (g) => g.rules.push({ when: { every: 60 }, then: [{ turnAll: { type: "alt", into: "rock", seconds: 5 } }] }) },
  { name: "levels present", copies: 1, apply: (g) => g.rules.push({ when: { every: 60 }, then: [{ nextLevel: true }] }) },
  { name: "counter shown in the HUD", copies: 1, apply: (g) => g.counters.push({ ...counter("c"), show: true }) },
  { name: "timer shown in the HUD (a timer rule; existing, unpriced)", copies: 1, apply: (g) => g.rules.push({ when: { timer: 99 }, then: [{ score: 10 }] }) },
];

describe.skipIf(!process.env.KIT_MEASURE)("kit cost measurements", () => {
  it("prices each batch 1 primitive", { timeout: 1_800_000 }, async () => {
    // Calibration: one bouncer (9 points in the model) fewer frees this many fillers.
    const seven = await capacity((n) => base(n, 7));
    const eight = await capacity((n) => base(n, 8));
    const perFiller = 9 / Math.max(1, seven - eight);
    console.log(`calibration: 7 bouncers fit ${seven} fillers, 8 fit ${eight}; one filler ≈ ${perFiller.toFixed(2)} points`);
    let baseline = 0;
    for (const v of VARIANTS) {
      const cap = await capacity((n) => {
        const g = base(n);
        v.apply(g);
        return g;
      });
      if (v.name === "baseline") baseline = cap;
      const g = base(Math.max(0, cap));
      v.apply(g);
      const model = validateKit(g, SOUND_LIBRARY, { ignoreBudget: true });
      const modelCost = model.ok ? cpuCost(model.game, model.spawns) : NaN;
      const each = ((baseline - cap) * perFiller) / v.copies;
      console.log(`${v.name}: ${cap} fillers fit (baseline ${baseline}) → about ${each.toFixed(2)} points each (±${(perFiller / v.copies).toFixed(2)}); model total at capacity ${modelCost}`);
    }
    // Flee against chase: how many fit at 60 fps in a walled room.
    for (const mover of ["chase", "flee"] as Behaviour[]) {
      let n = 0;
      for (let m = 4; m <= 16; m++) {
        if ((await fps(base(0, m, mover))) < 59.5) break;
        n = m;
      }
      console.log(`${mover}: ${n} fit at 60 fps (no fillers)`);
    }
  });
});

/** The base game with its movers moving by velocity (model v2 spike) instead of a behaviour; optionally without walls. */
function velocityBase(fillers: number, movers: number, move: KitMove | null, speed = 2, walls = true): KitGame {
  const g = base(fillers, movers);
  const m = g.types[1]!;
  if (move) m.move = move;
  m.speed = speed;
  if (!walls) g.room.rows = g.room.rows.map((r) => r.replace(/#/g, " "));
  return g;
}

describe.skipIf(!process.env.KIT_MEASURE)("model v2 spike: velocity movement", () => {
  it("counts velocity movers at 60 fps against the bounce behaviour", { timeout: 1_800_000 }, async () => {
    const most = async (make: (m: number) => KitGame, opts: KitOptions = {}) => {
      let n = 0;
      for (let m = 4; m <= 20; m++) {
        if ((await fps(make(m), opts)) < 59.5) break;
        n = m;
      }
      return n;
    };
    const cases: { name: string; make: (fillers: number, movers: number) => KitGame; opts?: KitOptions }[] = [];
    for (const walls of [true, false]) {
      const room = walls ? "walled room" : "open room";
      for (const [speed, v] of [
        [2, 2],
        [3, 4],
      ] as const) {
        const px = v / 4;
        cases.push({ name: `bounce behaviour, ${px} px/frame, ${room}`, make: (f, m) => velocityBase(f, m, null, speed, walls) });
        cases.push({ name: `velocity + bounce, ${px} px/frame, time-sliced, ${room}`, make: (f, m) => velocityBase(f, m, { vx: v, vy: v, react: "bounce" }, speed, walls) });
        cases.push({
          name: `velocity + bounce, ${px} px/frame, every frame, ${room}`,
          make: (f, m) => velocityBase(f, m, { vx: v, vy: v, react: "bounce" }, speed, walls),
          opts: { velocityEveryFrame: true },
        });
      }
    }
    cases.push({ name: "velocity + wrap, 1 px/frame, time-sliced, open room", make: (f, m) => velocityBase(f, m, { vx: 4, vy: 4, react: "wrap" }, 3, false) });
    cases.push({ name: "velocity + turn, 1 px/frame, time-sliced, walled room", make: (f, m) => velocityBase(f, m, { vx: 4, vy: 0, react: "turn" }, 3, true) });
    // Points per mover: fillers displaced by 8 movers against 7, as in the batch 1 calibration (one filler ≈ 4.5 points).
    for (const c of cases) {
      const n = await most((m) => c.make(0, m), c.opts);
      const seven = await capacity((f) => c.make(f, 7), c.opts);
      const eight = await capacity((f) => c.make(f, 8), c.opts);
      console.log(`${c.name}: ${n} fit at 60 fps (hero, no fillers); 8 movers leave room for ${eight} fillers, 7 for ${seven} → ≈ ${((seven - eight) * 4.5).toFixed(1)} points each`);
    }
  });
});
