// Kit fuzz: random games that pass validation (including the CPU budget)
// must build, never hang, and hold 60 fps for 600 frames of random input,
// with things on the screen and in the slots the cost model priced. This is
// what lets the kit promise "anything the editor accepts works".
//
// The games use kit model v2's whole vocabulary (randomKitGameV2): parts,
// every trigger, targets, values, rooms, flow. Random v1 games (as saved
// before v2) check the migration: they must migrate, validate and build.
// Replay one with KIT_FUZZ_SEED=<seed> KIT_FUZZ_COUNT=1.

import { beforeAll, describe, expect, it } from "vitest";
import type { WasiBuilder } from "@cartridge-studio/toolchain";
import { parseSymbols, type CoreHost } from "../emulator/core-host.ts";
import { nodeBuilder, nodeHost } from "../harness/node.ts";
import { SOUND_LIBRARY } from "../project/templates.ts";
import { generateKit, validateKit } from "./generate.ts";
import { loadKit } from "./migrations.ts";
import { BEHAVIOURS as PRESETS, presetParts, presetRule } from "./parts.ts";
import { EDGE_REACTIONS, WALL_REACTIONS, type KitGameInput, type KitRule as KitRuleV2, type KitTarget, type KitValue } from "./schema.ts";
import {
  BEHAVIOURS,
  LEVEL,
  PLAYER_BEHAVIOURS,
  REACTIONS,
  type Behaviour,
  type KitActionV1 as KitAction,
  type KitConditionV1 as KitCondition,
  type KitCounterV1 as KitCounter,
  type KitGameV1 as KitGame,
  type KitRuleV1 as KitRule,
  type KitTriggerV1 as KitTrigger,
  type KitTypeV1 as KitType,
} from "./schema-v1.ts";
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

/** A random kit v1 game (as saved before model v2); `density` scales how many things are placed. */
export function randomKitGameV1(seed: number, density: number): KitGame {
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
  // Model v2 spike: some things move by velocity instead. A separate stream, so
  // the rest of each seed's game is unchanged.
  const rv = rng(seed ^ 0x7e10);
  types.forEach((t, i) => {
    if (i === 0 || rv.next() >= 0.25) return;
    const v = () => rv.int(33) - 16;
    t.move = { vx: v(), vy: v(), react: rv.pick(REACTIONS) };
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


type TypeV2 = KitGameInput["types"][number];
type ActionV2 = Record<string, unknown>;

/** A random kit v2 game; `density` scales how many things are placed (lowered until it fits the budget). */
export function randomKitGameV2(seed: number, density: number): KitGameInput {
  const r = rng(seed);
  const nTypes = 2 + r.int(5);
  const ids = Array.from({ length: nTypes }, (_, i) => `t${i}`);
  const sprite = (w: number, h: number) => Array.from({ length: h }, () => Array.from({ length: w }, () => String(r.int(4))).join(""));
  const others = PRESETS.filter((b) => !PLAYER_BEHAVIOURS.includes(b));
  const types: TypeV2[] = ids.map((id, i) => {
    const width = 4 * (1 + r.int(4));
    const height = 4 + r.int(13);
    const dirs = r.next() < 0.15 ? r.pick(["lr", "4"] as const) : null;
    const sets = dirs === "lr" ? 2 : dirs === "4" ? 4 : 1;
    const anim = r.next() < 0.3 ? 2 : 1;
    const t: TypeV2 = {
      id,
      label: `Thing ${i}`,
      width,
      height,
      frames: Array.from({ length: sets * anim }, () => sprite(width, height)),
      palette: "p",
      ...(dirs || anim > 1 ? { display: { ...(dirs ? { directions: dirs } : {}), ...(anim > 1 ? { animate: r.pick([4, 8, 16, 32, "moving"] as const) } : {}) } } : {}),
    };
    if (i === 0) {
      Object.assign(t, presetParts(r.pick(PLAYER_BEHAVIOURS), 1 + r.int(4), null));
      if (r.next() < 0.3) t.control!.mode = "keep";
      if (r.next() < 0.15) t.gravity = { amount: 1 + r.int(6), max: 16 + r.int(64) };
      return t;
    }
    if (r.next() < 0.6) Object.assign(t, presetParts(r.pick(others), 1 + r.int(4), "t0"));
    else {
      // Custom parts.
      const v = () => (r.next() < 0.3 ? 0 : r.int(97) - 48);
      t.move = { vx: v(), vy: v(), wall: r.pick(WALL_REACTIONS), edge: r.pick(EDGE_REACTIONS), ...(r.next() < 0.3 ? { smooth: true } : {}) };
      if (r.next() < 0.2) t.steer = { toward: r.pick(ids), ...(r.next() < 0.3 ? { away: true } : {}), speed: { step: 1 + r.int(4) }, every: r.pick([1, 2, 4] as const) };
      if (r.next() < 0.2) t.gravity = { amount: r.int(9) - 4 || 1, max: 8 + r.int(80), ...(r.next() < 0.2 ? { axis: "x" as const } : {}) };
    }
    if (r.next() < 0.2) t.vars = { a: { name: "a", start: r.int(20) }, b: { name: "b", start: r.int(20) } };
    if (r.next() < 0.15) t.cap = 1 + r.int(3);
    return t;
  });
  const symbol = (i: number) => String.fromCharCode(65 + i);
  const legend: Record<string, string> = { "#": "wall", "~": "hazard", "*": "goal" };
  ids.forEach((id, i) => (legend[symbol(i)] = id));
  const room = (withPlayer: boolean) => {
    const rows = Array.from({ length: 11 }, () => Array(20).fill(" "));
    if (r.next() < 0.5) for (let k = 0; k < 4 + r.int(25); k++) rows[r.int(11)]![r.int(20)] = "#";
    if (r.next() < 0.4) for (let k = 0; k < 1 + r.int(8); k++) rows[r.int(11)]![r.int(20)] = r.pick(["~", "*"]);
    if (withPlayer) rows[10]![r.int(18)] = symbol(0);
    const placed = Math.round(density * (2 + r.int(16)));
    for (let k = 0; k < placed; k++) {
      const t = 1 + r.int(nTypes - 1);
      if (r.next() < 0.25) continue; // some kinds only appear when rules create them
      rows[r.int(10)]![r.int(18)] = symbol(t);
    }
    return rows.map((x) => x.join(""));
  };
  const nRooms = r.next() < 0.25 ? 2 + r.int(2) : 1;
  const exits = (k: number) => (nRooms > 1 ? { ...(k + 1 < nRooms ? { right: k + 2 } : {}), ...(k > 0 ? { left: k } : {}) } : undefined);

  const counters = [
    ...(r.next() < 0.7 ? [{ id: "lives", label: "Lives", start: 1 + r.int(9) }] : []),
    ...Array.from({ length: r.int(3) }, (_, i) => ({ id: `c${i}`, label: `C${i}`, start: r.int(5), ...(r.next() < 0.2 ? { keep: "room" as const } : {}) })),
  ];
  const counterIds = counters.map((c) => c.id);
  const messages = r.next() < 0.3 ? ["m0", "m1"].slice(0, 1 + r.int(2)) : [];
  const hudChoices = ["score", "seconds", ...counterIds];
  const hud = (["left", "middle", "middle-right", "right"] as const).filter(() => r.next() < 0.5).map((at) => ({ show: r.pick(hudChoices), at }));

  let n = 0;
  const id = (p: string) => `${p}-f${++n}`;
  const value = (whose: ("it" | "other" | "target")[]): KitValue => {
    const k = r.int(9);
    const mods = r.next() < 0.3 ? r.pick([{ times: 1 + r.int(4) }, { div: 2 as const }, { neg: true as const }, { plus: r.int(20) - 5 }]) : {};
    if (k <= 2 || (k === 3 && !whose.length)) return r.int(30);
    if (k === 3) return { prop: r.pick(["x", "y", "vx", "vy", "facing", "a", "b", "timer"] as const), of: r.pick(whose), ...mods };
    if (k === 4 && counterIds.length) return { counter: r.pick([...counterIds, "seconds"]), ...mods };
    if (k === 5) return { count: r.pick(ids), ...mods };
    if (k === 6) return { random: 1 + r.int(40), ...mods };
    if (k === 7) return { joy: 1, axis: r.pick(["x", "y"] as const), ...mods };
    if (k === 8 && whose.length) return r.next() < 0.5 ? { facing: r.pick(["x", "y"] as const), of: r.pick(whose) } : { contact: r.pick(["left", "right", "top", "bottom"] as const), of: r.pick(whose) };
    return r.int(10);
  };
  const compare = (whose: ("it" | "other" | "target")[]) => ({ a: value(whose), op: r.pick(["eq", "ne", "gt", "gte", "lt", "lte"] as const), b: value(whose) });
  const rules: KitRuleV2[] = [];
  const nRules = r.int(9);
  for (let k = 0; k < nRules; k++) {
    const kind = r.int(15);
    const t = () => r.pick(ids);
    let when: KitRuleV2["when"];
    let it = false;
    let other = false;
    let event = false;
    if (kind === 0 || kind === 1) ((when = { touch: [t(), t()] }), (it = other = true));
    else if (kind === 2) ((when = { onTile: [t(), r.pick(["hazard", "goal"] as const)] }), (it = true));
    else if (kind === 3) ((when = { edge: [t(), r.pick(["left", "right", "top", "bottom", "sides", "any"] as const)] }), (it = true));
    else if (kind === 4) ((when = { wall: [t(), r.pick(["left", "right", "top", "bottom", "any"] as const)] }), (it = true));
    else if (kind === 5) ((when = { leaves: t() }), (it = true));
    else if (kind === 6) ((when = { timerOut: t() }), (it = true));
    else if (kind === 7) ((when = r.next() < 0.5 ? { created: t() } : { destroyed: t() }), (it = event = true));
    else if (kind === 8) ((when = { button: { joy: 1, button: 1, ...(r.next() < 0.3 ? { released: true } : {}) } }), (it = true));
    else if (kind === 9) ((when = { pushed: { joy: 1, dir: r.pick(["left", "right", "up", "down", "any"] as const) } }), (it = true));
    else if (kind === 10) when = { every: 1 + r.int(5), ...(r.next() < 0.4 ? { frames: true } : {}) };
    else if (kind === 11) when = { after: 1 + r.int(20) };
    else if (kind === 12) when = { roomStart: true };
    else if (kind === 13 && messages.length) when = { message: r.pick(messages) };
    else when = { test: compare([]) };
    const whose: ("it" | "other")[] = [...(it ? ["it" as const] : []), ...(other ? ["other" as const] : [])];
    const target = (): KitTarget =>
      r.pick<KitTarget>([...whose, { every: t(), ...(r.next() < 0.3 ? { where: compare(["target"]) } : {}) }, { random: t() }, ...(it ? [{ nearest: t() }] : [])]);
    const action = (): ActionV2 => {
      const a = r.int(14);
      if (a === 0) return { add: { what: { counter: "score" }, by: 10 * (1 + r.int(9)) } };
      const op = r.pick(["set", "add", "take"]);
      const amount = op === "set" ? "to" : "by";
      if (a === 1 && counterIds.length) return { [op]: { what: { counter: r.pick(counterIds) }, [amount]: value(whose) } };
      if (a === 2) return { [op]: { what: { prop: r.pick(["x", "y", "vx", "vy", "facing", "a", "b", "timer"] as const), of: target() }, [amount]: value([...whose, "target"]) } };
      if (a === 3) return { step: { who: target(), dx: r.int(17) - 8, dy: r.int(17) - 8 } };
      if (a === 4) return { create: { type: t(), at: r.next() < 0.3 ? { x: value(whose), y: value(whose) } : target(), place: r.pick(["on", "above", "below", "centre"] as const), ...(r.next() < 0.3 ? { vx: value([...whose, "target"]), vy: value([...whose, "target"]) } : {}) } };
      if (a === 5) return { destroy: target() };
      if (a === 6) return { turn: { who: target(), into: t(), ...(r.next() < 0.5 ? { seconds: 1 + r.int(8) } : {}) } };
      if (a === 7) return r.next() < 0.5 ? { toStart: target() } : { startHere: target() };
      if (a === 8) return { protect: { who: target(), tenths: 1 + r.int(30) } };
      if (a === 9) return { sound: r.pick(SOUND_LIBRARY).id };
      if (a === 10 && messages.length) return { send: r.pick(messages) };
      if (a === 11 && r.next() < 0.3) return r.pick<ActionV2>([{ gameOver: r.pick(["won", "lost"]) }, { restartRoom: true }, { nextRoom: true }, { goRoom: 1 + r.int(nRooms) }, { resetTaken: true }]);
      if (a === 12) return { run: "fuzz" };
      return { add: { what: { counter: "score" }, by: 10 } };
    };
    void event;
    const state = "touch" in when || "onTile" in when || "edge" in when || "wall" in when;
    const fires = (state || "test" in when) && r.next() < 0.3 ? { fires: r.pick(["once", "while"] as const) } : {};
    const any = state && r.next() < 0.2 ? { any: true } : {};
    const conds = r.next() < 0.3 ? { if: Array.from({ length: 1 + r.int(3) }, () => compare(whose)) } : {};
    rules.push({ id: id("r"), when, ...fires, ...any, ...conds, then: Array.from({ length: 1 + r.int(4), }, () => ({ id: id("a"), ...action() })) } as KitRuleV2);
  }
  // The presets' own rules (the march's turn, the fall) for kinds that move like them.
  types.forEach((t, i) => {
    for (const b of ["march", "fall"] as const) {
      const parts = presetParts(b, 1, null);
      if (JSON.stringify(parts.move) === JSON.stringify(t.move)) rules.unshift(presetRule(b, { id: t.id, width: t.width }, `r-p${i}`)!);
    }
  });
  if (counterIds.includes("lives")) rules.push({ id: "r-lives", when: { test: { a: { counter: "lives" }, op: "eq", b: 0 } }, then: [{ id: "a-lives", gameOver: "lost" }] });

  return {
    kit: 2,
    title: `Fuzz ${seed}`,
    palettes: [{ id: "p", colors: ["$0F", "$46", "$86"] }],
    background: `$${r.int(256).toString(16).padStart(2, "0")}`,
    wallPalette: "p",
    textPalette: "p",
    types,
    room: { rows: room(true), legend, ...(exits(0) ? { exits: exits(0) } : {}) },
    rooms: Array.from({ length: nRooms - 1 }, (_, k) => ({ rows: room(false), ...(exits(k + 1) ? { exits: exits(k + 1) } : {}) })),
    counters,
    hud,
    messages,
    rules: rules.slice(0, 24),
    text: { title: "Fuzz", win: "Win", lose: "Lose" },
    flow: {
      title: r.next() < 0.8,
      attract: r.next() < 0.15 ? { after: 3 + r.int(5) } : null,
      end: { show: counterIds.slice(0, r.int(3)), after: r.int(4) },
      remember: nRooms > 1 && r.next() < 0.5,
    },
    code: { routines: [{ label: "fuzz", body: " rem a routine the fuzz treats as a no-op" }], cost: 2 },
  };
}

let builder: WasiBuilder;
let host: CoreHost;
beforeAll(async () => {
  builder = await nodeBuilder();
  host = await nodeHost();
});

/** The game a seed tests: thinned out until it passes validation (the CPU budget, mostly), or null. */
function fuzzGame(seed: number): KitGameInput | null {
  for (let density = 1; density > 0.05; density *= 0.7) {
    const g = randomKitGameV2(seed, density);
    if (validateKit(g, SOUND_LIBRARY).ok) return g;
  }
  return null;
}

describe("kit fuzz", () => {
  it("covers the vocabulary: most seeds are valid, and every primitive appears", () => {
    const games = Array.from({ length: COUNT }, (_, k) => fuzzGame(SEED + k)).filter((g): g is KitGameInput => !!g);
    const json = games.map((g) => JSON.stringify(g));
    const seen = (needle: string) => json.filter((j) => j.includes(needle)).length;
    const NEEDLES = [
      '"touch":', '"onTile":', '"edge":[', '"wall":[', '"leaves":', '"timerOut":', '"created":', '"destroyed":', '"button":', '"pushed":', '"when":{"every":', '"when":{"after":', '"roomStart":', '"when":{"test":', '"when":{"message":',
      '"steer":', '"gravity":', '"control":', '"directions":', '"every":"', '"nearest":', '"random":"', '"where":', '"create":', '"turn":', '"protect":', '"step":{"who"', '"send":', '"run":', '"joy":1,"axis"', '"facing":"', '"contact":', '"rooms":[{', '"attract":{', '"remember":true',
    ];
    const tally = Object.fromEntries(NEEDLES.map((k) => [k, seen(k)]));
    console.log(`kit fuzz: ${games.length} of ${COUNT} seeds valid; primitives seen in games: ${JSON.stringify(tally)}`);
    expect(games.length).toBeGreaterThanOrEqual(COUNT * 0.7);
    if (COUNT >= 30) for (const [k, n] of Object.entries(tally)) expect(n, k).toBeGreaterThan(0);
  });

  it("random v1 games migrate and validate", () => {
    let valid = 0;
    let migrated = 0;
    for (let k = 0; k < COUNT; k++) {
      const v1 = randomKitGameV1(SEED + k, 1);
      const r = loadKit(v1);
      if (!r.ok) throw new Error(`seed ${SEED + k}: ${r.errors.join("; ")}`);
      migrated++;
      if (validateKit(r.game, SOUND_LIBRARY, { ignoreBudget: true }).ok) valid++;
    }
    console.log(`kit fuzz: ${migrated} of ${COUNT} random v1 games migrate; ${valid} validate`);
    // A v1 game that broke v1's own rules (two players, a shooter that isn't the player) may not validate.
    expect(valid).toBeGreaterThanOrEqual(COUNT * 0.6);
  });

  for (let k = 0; k < COUNT; k++) {
    const seed = SEED + k;
    it(`seed ${seed}: a valid random game builds, runs and holds 60 fps`, async () => {
      const game = fuzzGame(seed);
      if (!game) return; // nothing valid at any density; not this test's concern

      const gen = generateKit(game, SOUND_LIBRARY);
      if (!gen.ok) throw new Error(`seed ${seed}: ${gen.errors.join("; ")}`);
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
      const types = gen.ir.types;
      for (let f = 0; f < 600; f += 10) {
        host.setInput({ up: r.next() < 0.25, down: r.next() < 0.25, left: r.next() < 0.3, right: r.next() < 0.3, fire: r.next() < 0.5 });
        host.step(10);
        // Things stay in the slots their kinds were priced for, and on the screen unless they pass its edges.
        const otype = host.readMemory(s.get("otype")!, 24);
        const ox = host.readMemory(s.get("ox")!, 24);
        const oy = host.readMemory(s.get("oy")!, 24);
        for (let slot = 0; slot < 24; slot++) {
          const t = otype[slot]!;
          if (t === 255) continue;
          const kind = types[t];
          expect(kind, `seed ${seed}: slot ${slot} holds kind ${t}`).toBeDefined();
          expect(slot >= kind!.loop[0] && slot <= kind!.loop[1], `seed ${seed}: a ${kind!.id} in slot ${slot}, outside ${kind!.loop}`).toBe(true);
          if (kind!.move.edge === "pass" || kind!.from.some((u) => types[u]!.move.edge === "pass")) continue;
          const onScreen = ox[slot]! + kind!.width <= 160 && oy[slot]! >= 16 && oy[slot]! + kind!.height <= 192;
          expect(onScreen, `seed ${seed}: a ${kind!.id} at (${ox[slot]}, ${oy[slot]})`).toBe(true);
        }
      }
      const fps = ((loops() - l0) / (host.frame - f0)) * 60;
      expect(fps, `seed ${seed}`).toBeGreaterThanOrEqual(58);
    });
  }
});
