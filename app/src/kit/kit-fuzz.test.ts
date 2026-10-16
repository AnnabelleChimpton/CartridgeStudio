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
import { BEHAVIOURS, PLAYER_BEHAVIOURS, type Behaviour, type KitAction, type KitGame, type KitRule, type KitType } from "./schema.ts";
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
  const symbol = (i: number) => String.fromCharCode(65 + i);
  rows[10]![r.int(18)] = symbol(0);
  const placed = Math.round(density * (2 + r.int(18)));
  for (let k = 0; k < placed; k++) {
    const t = 1 + r.int(nTypes - 1);
    if (types[t]!.behaviour.startsWith("projectile")) continue; // launched, not placed
    rows[r.int(10)]![r.int(18)] = symbol(t);
  }
  const legend: Record<string, string> = { "#": "wall" };
  types.forEach((t, i) => (legend[symbol(i)] = t.id));

  const actionsFor = (touch: boolean): KitAction[] => {
    const pool: KitAction[] = [{ score: 10 * (1 + r.int(9)) }, { loseLife: true }, { sound: r.pick(SOUND_LIBRARY).id }];
    if (touch) pool.push({ remove: "second" }, { remove: "first" }, { respawn: "second" });
    const out = Array.from({ length: 1 + r.int(3) }, () => r.pick(pool));
    if (r.next() < 0.1) out.push(r.pick<KitAction>([{ win: true }, { lose: true }, { restartRoom: true }]));
    return out;
  };
  const rules: KitRule[] = Array.from({ length: r.int(6) }, () => {
    const kind = r.int(4);
    const t = () => r.pick(types).id;
    if (kind === 0 || kind === 3) return { when: { touch: [t(), t()] as [string, string] }, then: actionsFor(true) };
    if (kind === 1) return { when: { allGone: t() }, then: actionsFor(false) };
    return { when: { timer: 1 + r.int(20) }, then: actionsFor(false) };
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
    rules,
    text: { title: "Fuzz", win: "Win", lose: "Lose" },
    sounds: {},
  };
}

let builder: WasiBuilder;
let host: CoreHost;
beforeAll(async () => {
  builder = await nodeBuilder();
  host = await nodeHost();
});

describe("kit fuzz", () => {
  for (let k = 0; k < COUNT; k++) {
    const seed = SEED + k;
    it(`seed ${seed}: a valid random game builds, runs and holds 60 fps`, async () => {
      // Thin the room out until the game passes validation (the CPU budget, mostly).
      let game: KitGame | null = null;
      for (let density = 1; density > 0.05 && !game; density *= 0.7) {
        const g = randomKitGame(seed, density);
        if (validateKit(g, SOUND_LIBRARY).ok) game = g;
      }
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
