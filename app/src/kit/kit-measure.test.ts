// Cost measurements for the CPU model (not part of the normal run):
//   KIT_MEASURE=1 npx vitest run src/kit/kit-measure.test.ts --silent=false
// The kit runs too fast for the old method (a base game plus "still"
// fillers until it drops below 60 fps: 23 things now fit). Instead each game
// gets ballast: a busy loop in its user_frame hook (coder mode's hook, with
// no declared cost), and a binary search finds the most ballast that still
// holds 60 fps, its headroom. A part costs the headroom it takes away,
// divided by how many copies the variant adds.
//
// Points: 100 is a whole frame. A hero alone leaves N0 units of headroom, and
// the runtime's fixed work (input, the score and lives, drawscreen) plus the
// hero is taken as BASE points, so a unit is (100 - BASE) / N0 points. Any
// BASE keeps the model right at the 60 fps boundary, as long as parts add up.
// The model's numbers (COST in generate.ts) come from this run.

import { beforeAll, describe, it } from "vitest";
import type { WasiBuilder } from "@cartridge-studio/toolchain";
import { parseSymbols, type CoreHost, type JoystickInput } from "../emulator/core-host.ts";
import { nodeBuilder, nodeHost } from "../harness/node.ts";
import { SOUND_LIBRARY } from "../project/templates.ts";
import { cpuCost, type KitOptions } from "./generate.ts";
import type { KitGameInput, KitRule } from "./schema.ts";
import { buildKitRom } from "./tests.ts";

type Type = KitGameInput["types"][number];
const box = (w: number, h: number) => Array.from({ length: h }, () => "1".repeat(w));
const thing = (id: string, extra: Partial<Type> = {}): Type => ({ id, label: id, width: 8, height: 8, frames: [box(8, 8)], palette: "p", ...extra });
/** The runtime's fixed share of a frame and a hero, in points (see above). */
const BASE = 10;
/** Iterations of the inner ballast loop per unit. */
const INNER = 16;

interface Variant {
  name: string;
  copies: number;
  /** Changes the base game; fillers are added afterwards. */
  apply: (g: KitGameInput) => void;
  /** Joystick input held while measuring. */
  input?: Partial<JoystickInput>;
}

/** Hero, `movers` bouncers (½ px a frame, time-sliced) in a walled room, and `fillers` still things (kind "rock"). */
function base(fillers: number, movers = 8): KitGameInput {
  const rows = ["####################", ...Array.from({ length: 9 }, () => "#                  #"), "####################"].map((r) => [...r]);
  rows[9]![2] = "P";
  for (let k = 0; k < movers; k++) rows[1 + (k % 4) * 2]![2 + Math.floor(k / 4) * 4] = "M";
  for (let k = 0; k < fillers; k++) rows[2 + (k % 7)]![11 + Math.floor(k / 7) * 2] = "R";
  return {
    kit: 2,
    title: "Measure",
    palettes: [{ id: "p", colors: ["$0F", "$46", "$86"] }],
    background: "$00",
    wallPalette: "p",
    textPalette: "p",
    types: [
      thing("hero", { control: { joystick: 1, axes: "8way", mode: "direct", speed: { step: 3 } }, move: { wall: "slide", edge: "stop" } }),
      thing("mover", { move: { vx: 8, vy: 8, wall: "bounce", edge: "bounce" } }),
      thing("rock"),
      thing("alt"),
    ],
    room: { rows: rows.map((r) => r.join("")), legend: { "#": "wall", "~": "hazard", P: "hero", M: "mover", R: "rock", A: "alt" } },
    counters: [{ id: "lives", label: "Lives", start: 3 }],
    hud: [
      { show: "score", at: "left" },
      { show: "lives", at: "right" },
    ],
    rules: [],
    text: { title: "M", win: "W", lose: "L" },
  };
}

let builder: WasiBuilder;
let host: CoreHost;
beforeAll(async () => {
  builder = await nodeBuilder();
  host = await nodeHost();
});

const NONE: JoystickInput = { up: false, down: false, left: false, right: false, fire: false };

async function fps(g: KitGameInput, opts: KitOptions = {}, input: Partial<JoystickInput> = {}): Promise<number> {
  const rom = await buildKitRom(g, SOUND_LIBRARY, builder, false, { ignoreBudget: true, ...opts });
  if (!rom.ok) throw new Error(rom.failure);
  const s = parseSymbols(rom.symbols);
  const loops = () => {
    const b = host.readMemory(s.get("loopslo")!, 2);
    return b[0]! + 256 * b[1]!;
  };
  await host.load(rom.a78);
  host.step(5);
  host.setInput({ ...NONE, fire: true });
  host.step(2);
  host.setInput({ ...NONE, ...input });
  host.step(10);
  const l0 = loops();
  const f0 = host.frame;
  host.step(360);
  return ((loops() - l0) / (host.frame - f0)) * 60;
}

/** The game with `units` of ballast in its user_frame hook. */
function ballast(g: KitGameInput, units: number): KitGameInput {
  if (units <= 0) return g;
  return { ...g, code: { frame: [` for ck = 1 to ${units}`, ` for rc = 1 to ${INNER}`, " next", " next"].join("\n"), cost: 0 } };
}

/** Most ballast units that still hold 60 fps (-1: not even none). */
async function headroom(g: KitGameInput, opts: KitOptions = {}, input: Partial<JoystickInput> = {}): Promise<number> {
  if ((await fps(g, opts, input)) < 59.5) return -1;
  let lo = 0;
  let hi = 255;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if ((await fps(ballast(g, mid), opts, input)) >= 59.5) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

let ruleId = 0;
const rule = (r: Omit<KitRule, "id" | "then"> & { then: Record<string, unknown>[] }): KitRule =>
  ({ ...r, id: `r-m${++ruleId}`, then: r.then.map((a) => ({ id: `a-m${++ruleId}`, ...a })) }) as KitRule;
const many = (n: number, f: () => KitRule) => Array.from({ length: n }, f);
/** Replaces the movers' kind. */
const movers = (extra: Partial<Type>) => (g: KitGameInput) => void Object.assign(g.types[1]!, extra);
const counter = (id: string) => ({ id, label: id, start: 0 });

const VARIANTS: Variant[] = [
  { name: "baseline (8 bouncers, time-sliced)", copies: 1, apply: () => {} },
  { name: "movers updated every frame (smooth)", copies: 8, apply: movers({ move: { vx: 8, vy: 8, wall: "bounce", edge: "bounce", smooth: true } }) },
  { name: "movers with no checks (walls through, edges pass, smooth)", copies: 8, apply: movers({ move: { vx: 8, vy: 0, wall: "through", edge: "wrap", smooth: true } }) },
  { name: "movers still (velocity 0, no parts)", copies: 8, apply: movers({ move: { vx: 0, vy: 0 } }) },
  { name: "movers steering toward the hero", copies: 8, apply: movers({ steer: { toward: "hero", speed: { step: 2 } }, move: { wall: "slide", edge: "stop" } }) },
  {
    name: "movers steering toward the nearest of 4 alts",
    copies: 8,
    apply: (g) => {
      movers({ steer: { toward: "alt", speed: { step: 2 } }, move: { wall: "slide", edge: "stop" } })(g);
      g.room.rows[9] = "# P  A A A A       #";
    },
  },
  { name: "movers with gravity", copies: 8, apply: movers({ gravity: { amount: 2, max: 32 }, move: { vx: 8, vy: 8, wall: "bounce", edge: "bounce" } }) },
  {
    name: "movers with 4 direction frames (facing)",
    copies: 8,
    apply: movers({ frames: [box(8, 8), box(8, 8), box(8, 8), box(8, 8)], display: { directions: "4" }, move: { vx: 8, vy: 8, wall: "bounce", edge: "bounce" } }),
  },
  {
    name: "movers controlled by the joystick, held right",
    copies: 8,
    apply: movers({ control: { joystick: 1, axes: "8way", mode: "direct", speed: { step: 2 } }, move: { wall: "slide", edge: "stop" } }),
    input: { right: true },
  },
  { name: "rule: touch hero/mover ×4 (8 movers)", copies: 4, apply: (g) => g.rules.push(...many(4, () => rule({ when: { touch: ["hero", "mover"] }, then: [{ add: { what: { counter: "score" }, by: 10 } }] }))) },
  {
    name: "rule: touch hero/mover ×4 (8 movers) with 2 true conditions each",
    copies: 4,
    apply: (g) => {
      g.counters!.push(counter("c"));
      g.rules.push(
        ...many(4, () =>
          rule({
            when: { touch: ["hero", "mover"] },
            if: [
              { a: { counter: "c" }, op: "eq", b: 0 },
              { a: { counter: "lives" }, op: "gte", b: 1 },
            ],
            then: [{ add: { what: { counter: "score" }, by: 10 } }],
          }),
        ),
      );
    },
  },
  { name: "rule: mover on a tile ×1 (8 movers)", copies: 8, apply: (g) => g.rules.push(rule({ when: { onTile: ["mover", "hazard"] }, then: [{ add: { what: { counter: "score" }, by: 10 } }] })) },
  { name: "rule: mover at an edge, once ×1 (8 movers)", copies: 8, apply: (g) => g.rules.push(rule({ when: { edge: ["mover", "any"] }, then: [{ add: { what: { counter: "score" }, by: 10 } }] })) },
  { name: "rule: every frame ×4 (each with a random roll and a count of 8 movers)", copies: 4, apply: (g) => g.rules.push(...many(4, () => rule({ when: { every: 1, frames: true }, if: [{ a: { random: 255 }, op: "lt", b: 4 }, { a: { count: "mover" }, op: "gt", b: 100 }], then: [{ add: { what: { counter: "score" }, by: 10 } }] }))) },
  { name: "rule: count of 8 movers is 0 ×4 (never true)", copies: 4, apply: (g) => g.rules.push(...many(4, () => rule({ when: { test: { a: { count: "mover" }, op: "eq", b: 0 } }, then: [{ add: { what: { counter: "score" }, by: 10 } }] }))) },
  { name: "rule: every frame, every mover: add 1 to its a ×1 (8 movers)", copies: 8, apply: (g) => g.rules.push(rule({ when: { every: 1, frames: true }, then: [{ add: { what: { prop: "a", of: { every: "mover" } }, by: 1 } }] })) },
  { name: "rule: button pressed ×8 (not pressed)", copies: 8, apply: (g) => g.rules.push(...many(8, () => rule({ when: { button: { joy: 1, button: 1 } }, then: [{ add: { what: { counter: "score" }, by: 10 } }] }))) },
  { name: "timers present (a timed turn)", copies: 1, apply: (g) => g.rules.push(rule({ when: { every: 60 }, then: [{ turn: { who: { every: "alt" }, into: "rock", seconds: 5 } }] })) },
  {
    name: "a third and fourth number on screen",
    copies: 2,
    apply: (g) => {
      g.counters!.push(counter("c"));
      g.hud!.push({ show: "c", at: "middle" }, { show: "seconds", at: "middle-right" });
    },
  },
];

describe.skipIf(!process.env.KIT_MEASURE)("kit model v2 cost measurements", () => {
  it("prices each part", { timeout: 3_600_000 }, async () => {
    const hero = base(0, 0);
    const n0 = await headroom(hero);
    const unit = (100 - BASE) / n0;
    console.log(`calibration: a hero alone leaves ${n0} units of headroom; one unit ≈ ${unit.toFixed(2)} points (the hero and the runtime: ${BASE})`);
    const baseline = await headroom(base(0));
    console.log(`base game (hero + 8 bouncers): ${baseline} units → 8 bouncers ≈ ${(((n0 - baseline) * unit) / 8).toFixed(2)} points each`);
    const stills = await headroom(base(8, 0));
    console.log(`8 still things: ${stills} units → ≈ ${(((n0 - stills) * unit) / 8).toFixed(2)} points each`);
    const only = process.env.KIT_MEASURE_ONLY;
    for (const v of VARIANTS) {
      if (v.name.startsWith("baseline")) continue;
      if (only && !v.name.includes(only)) continue;
      const g = base(0);
      v.apply(g);
      const h = await headroom(g, {}, v.input);
      const each = ((baseline - h) * unit) / v.copies;
      console.log(`${v.name}: ${h} units (base ${baseline}) → about ${each.toFixed(2)} points each (±${(unit / v.copies).toFixed(2)}); the model says ${cpuCost(g)} in all`);
    }
  });
});
