// Kit fuzz: random games that pass validation (including the CPU budget)
// must build, never hang, and hold 60 fps for 600 frames of random input.
// This is what lets the kit promise "anything the editor accepts works".
// Replay one with KIT_FUZZ_SEED=<seed> KIT_FUZZ_COUNT=1.

import { beforeAll, describe, expect, it } from "vitest";
import type { WasiBuilder } from "@cartridge-studio/toolchain";
import { parseSymbols, type CoreHost } from "../emulator/core-host.ts";
import { nodeBuilder, nodeHost } from "../harness/node.ts";
import { SOUND_LIBRARY } from "../project/templates.ts";
import { validateKit } from "./generate.ts";
import {
  BEHAVIOURS,
  LEVEL,
  PLAYER_BEHAVIOURS,
  type Behaviour,
  type KitAction,
  type KitCondition,
  type KitCounter,
  type KitGame,
  type KitRule,
  type KitTrigger,
  type KitType,
} from "./schema.ts";
import { buildKitRom } from "./tests.ts";

const COUNT = Number(process.env.KIT_FUZZ_COUNT ?? 8);
const SEED = Number(process.env.KIT_FUZZ_SEED ?? 7800);

function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  const pick = <T,>(xs: readonly T[]): T => xs[int(xs.length)]!;
  return { next, int, pick };
}

/** A random game; `density` scales how many things are placed (lowered until it fits the budget). */
export function randomKitGame(seed: number, density: number): KitGame {
  const r = rng(seed);
  const others = BEHAVIOURS.filter((b) => !PLAYER_BEHAVIOURS.includes(b));
  const nTypes = 2 + r.int(4);
  const types: KitType[] = Array.from({ length: nTypes }, (_, i) => {
    const width = 4 * (1 + r.int(4));
    const height = 4 + r.int(13);
    const frame = () => Array.from({ length: height }, () => Array.from({ length: width }, () => String(r.int(4))).join(""));
    const behaviour: Behaviour = i === 0 ? r.pick(PLAYER_BEHAVIOURS) : r.pick(others);
    return {
      id: `t${i}`,
      label: `Thing ${i}`,
      width,
      height,
      frames: r.next() < 0.3 ? [frame(), frame()] : [frame()],
      palette: "p",
      behaviour,
      speed: 1 + r.int(4),
    };
  });
  const projectile = types.findIndex((t, i) => i > 0 && t.behaviour === "projectile-up");
  if (projectile > 0 && r.next() < 0.7) types[0]!.shoots = types[projectile]!.id;
  const dropper = types.findIndex((t, i) => i > 0 && t.behaviour !== "projectile-down");
  const droppee = types.findIndex((t) => t.behaviour === "projectile-down");
  if (dropper > 0 && droppee > 0 && dropper !== droppee) types[dropper]!.drops = { type: types[droppee]!.id, chance: 1 + r.int(20) };

  const rows = Array.from({ length: 11 }, () => Array(20).fill(" "));
  if (r.next() < 0.5) {
    for (let k = 0; k < 4 + r.int(25); k++) rows[r.int(11)]![r.int(20)] = "#";
  }
  // Hazard and goal tiles (batch 1).
  if (r.next() < 0.4) {
    for (let k = 0; k < 1 + r.int(8); k++) rows[r.int(11)]![r.int(20)] = r.pick(["~", "*"]);
  }
  const symbol = (i: number) => String.fromCharCode(65 + i);
  rows[10]![r.int(18)] = symbol(0);
  const placed = Math.round(density * (2 + r.int(18)));
  for (let k = 0; k < placed; k++) {
    const t = 1 + r.int(nTypes - 1);
    if (types[t]!.behaviour.startsWith("projectile")) continue; // launched, not placed
    rows[r.int(10)]![r.int(18)] = symbol(t);
  }
  const legend: Record<string, string> = { "#": "wall", "~": "hazard", "*": "goal" };
  types.forEach((t, i) => (legend[symbol(i)] = t.id));

  // Counters (batch 1).
  const counters: KitCounter[] = Array.from({ length: r.int(3) }, (_, i) => ({ id: `c${i}`, label: `C${i}`, start: r.int(5), ...(i === 0 && r.next() < 0.3 ? { show: true } : {}) }));
  const counterRefs = [...counters.map((c) => c.id), LEVEL];
  const nonPlayers = types.filter((t) => !PLAYER_BEHAVIOURS.includes(t.behaviour)).map((t) => t.id);
  const isPlayer = (id: string) => PLAYER_BEHAVIOURS.includes(types.find((t) => t.id === id)!.behaviour);
  const turnTarget = (from: string) => nonPlayers.filter((x) => x !== from);
  const seconds = () => (r.next() < 0.5 ? { seconds: 1 + r.int(8) } : {});

  const actionsFor = (w: KitTrigger): KitAction[] => {
    const touch = "touch" in w;
    const thing = touch ? w.touch[0] : "onTile" in w ? w.onTile[0] : null;
    const pool: KitAction[] = [{ score: 10 * (1 + r.int(9)) }, { loseLife: true }, { sound: r.pick(SOUND_LIBRARY).id }];
    if (touch) pool.push({ remove: "second" }, { remove: "first" }, { respawn: "second" });
    if (thing && !touch) pool.push({ remove: "first" });
    if (counters.length) {
      const c = r.pick(counters).id;
      pool.push({ add: [c, 1 + r.int(5)] }, { take: [c, 1 + r.int(5)] }, { set: [c, r.int(10)] });
    }
    // Turning: never the player, never into itself.
    const turnWho = (who: "first" | "second", id: string | null) => {
      if (!id || isPlayer(id)) return;
      const into = turnTarget(id);
      if (into.length) pool.push({ turn: { who, into: r.pick(into), ...seconds() } });
    };
    turnWho("first", thing);
    if (touch) turnWho("second", w.touch[1]);
    if (nonPlayers.length > 1) {
      const from = r.pick(nonPlayers);
      pool.push({ turnAll: { type: from, into: r.pick(turnTarget(from)), ...seconds() } });
    }
    const out = Array.from({ length: 1 + r.int(3) }, () => r.pick(pool));
    if (r.next() < 0.12) out.push(r.pick<KitAction>([{ win: true }, { lose: true }, { restartRoom: true }, { nextLevel: true }]));
    return out;
  };
  const conditions = (): KitCondition[] | undefined =>
    r.next() < 0.3
      ? Array.from({ length: 1 + r.int(2) }, () => ({ counter: r.pick(counterRefs), op: r.pick(["eq", "ne", "gte", "lte"] as const), value: r.int(6) }))
      : undefined;
  const rules: KitRule[] = Array.from({ length: r.int(7) }, () => {
    const kind = r.int(7);
    const t = () => r.pick(types).id;
    const when: KitTrigger =
      kind === 0 || kind === 3
        ? { touch: [t(), t()] as [string, string] }
        : kind === 1
          ? { allGone: t() }
          : kind === 2
            ? { timer: 1 + r.int(20) }
            : kind === 4
              ? { every: 1 + r.int(5) }
              : kind === 5
                ? { reaches: [r.pick(counterRefs), 1 + r.int(6)] }
                : { onTile: [t(), r.pick(["hazard", "goal"] as const)] };
    const c = conditions();
    return { when, ...(c ? { if: c } : {}), then: actionsFor(when) };
  });

  return {
    kit: 1,
    title: `Fuzz ${seed}`,
    palettes: [{ id: "p", colors: ["$0F", "$46", "$86"] }],
    background: `$${r.int(256).toString(16).padStart(2, "0")}`,
    wallPalette: "p",
    textPalette: "p",
    lives: 1 + r.int(9),
    types,
    room: { rows: rows.map((x) => x.join("")), legend },
    counters,
    rules,
    text: { title: "Fuzz", win: "Win", lose: "Lose" },
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

/** The game a seed tests: thinned out until it passes validation (the CPU budget, mostly), or null. */
function fuzzGame(seed: number): KitGame | null {
  for (let density = 1; density > 0.05; density *= 0.7) {
    const g = randomKitGame(seed, density);
    if (validateKit(g, SOUND_LIBRARY).ok) return g;
  }
  return null;
}

describe("kit fuzz", () => {
  it("covers the vocabulary: most seeds are valid, and every batch 1 primitive appears", () => {
    const games = Array.from({ length: COUNT }, (_, k) => fuzzGame(SEED + k)).filter((g): g is KitGame => !!g);
    const json = games.map((g) => JSON.stringify(g));
    const seen = (needle: string) => json.filter((j) => j.includes(needle)).length;
    const tally = Object.fromEntries(
      ['"if":', '"every":', '"reaches":', '"onTile":', '"turn":', '"turnAll":', '"seconds":', '"nextLevel":', '"add":', '"show":true', '"flee"'].map((k) => [k, seen(k)]),
    );
    tally["hazard or goal tiles in the room"] = games.filter((g) => g.room.rows.some((r) => /[~*]/.test(r))).length;
    console.log(`kit fuzz: ${games.length} of ${COUNT} seeds valid; primitives seen in games: ${JSON.stringify(tally)}`);
    expect(games.length).toBeGreaterThanOrEqual(COUNT * 0.7);
    if (COUNT >= 30) for (const [k, n] of Object.entries(tally)) expect(n, k).toBeGreaterThan(0);
  });

  for (let k = 0; k < COUNT; k++) {
    const seed = SEED + k;
    it(`seed ${seed}: a valid random game builds, runs and holds 60 fps`, async () => {
      const game = fuzzGame(seed);
      if (!game) return; // nothing valid at any density (for example two players); not this test's concern

      const rom = await buildKitRom(game, SOUND_LIBRARY, builder);
      if (!rom.ok) throw new Error(`seed ${seed}: ${rom.failure}`);
      const s = parseSymbols(rom.symbols);
      const loops = () => {
        const b = host.readMemory(s.get("loopslo")!, 2);
        return b[0]! + 256 * b[1]!;
      };
      await host.load(rom.a78);
      host.step(5);
      host.setInput({ up: false, down: false, left: false, right: false, fire: true });
      host.step(2);
      const r = rng(seed ^ 0x5eed);
      const l0 = loops();
      const f0 = host.frame;
      for (let f = 0; f < 600; f += 10) {
        host.setInput({ up: r.next() < 0.25, down: r.next() < 0.25, left: r.next() < 0.3, right: r.next() < 0.3, fire: r.next() < 0.5 });
        host.step(10);
      }
      const fps = ((loops() - l0) / (host.frame - f0)) * 60;
      expect(fps, `seed ${seed}`).toBeGreaterThanOrEqual(58);
    });
  }
});
