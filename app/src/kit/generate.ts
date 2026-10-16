// Kit code generation: validates a kit game, then renders the generic runtime
// with the game's data tables, rule checks, draw routines, text and sounds.

import Handlebars from "handlebars";
import { encodeIndexedPng, type BuildInput } from "@cartridge-studio/toolchain";
import { lintBasic } from "../codegen/lint.ts";
import { sanitizeTitle, soundData } from "../codegen/generate.ts";
import type { SoundEffect } from "../project/schema.ts";
import {
  BEHAVIOURS,
  FONT_CHARS,
  KitGameSchema,
  LEVEL,
  MAX_OBJECTS,
  PLAYER_BEHAVIOURS,
  REACTIONS,
  ROOM_COLS,
  ROOM_ROWS,
  TILES,
  type KitAction,
  type KitCondition,
  type KitGame,
  type KitRule,
  type KitTrigger,
} from "./schema.ts";
import { fontRows } from "./font.ts";
import kitEngine from "@cartridge-studio/templates/kit/engine.bas.hbs?raw";

export const KIT_RUNTIME_VERSION = "0.3.0";
const ROOMTOP = 16;
/** Pixels per frame for speed 1-4, by frame phase (frame & 3). */
const SPEED_STEPS = [
  [1, 0, 0, 0],
  [1, 0, 1, 0],
  [1, 1, 1, 1],
  [2, 2, 2, 2],
];
/** Objects one zone (8 lines) can hold, besides the walls and HUD. Measured, see docs/kit-spike-findings.md. */
export const ZONE_BUDGET = 12;

/**
 * Frame-time cost model, calibrated from measurements in js7800 and MAME
 * (docs/kit-spike-findings.md). A game whose total is at most 100 runs at
 * 60 fps; the fuzz test checks that this stays true.
 */
export const CPU_BUDGET = 100;
const BEHAVIOUR_COST: Record<string, number> = {
  still: 4,
  march: 4.5,
  fall: 5,
  "patrol-h": 6,
  "patrol-v": 6,
  bounce: 9,
  chase: 9,
  "player-lr": 6,
  "player-4way": 6,
  "player-8way": 6,
  "projectile-up": 6,
  "projectile-down": 6,
  flee: 9,
};
/** Each display zone (8 lines) a sprite spans beyond the first. */
const EXTRA_ZONE_COST = 1.5;
/** Rolling the dice for a dropper, every frame. */
const DROPPER_COST = 0.5;
const TOUCH_RULE_COST = 2;
/** Per pair of objects a touch rule compares (outer × inner). */
const TOUCH_RULE_COST_PER_PAIR = 0.6;
const EVENT_RULE_COST = 1;
const EVENT_RULE_COST_PER_OBJECT = 0.2;
/**
 * Batch 1, measured in js7800 (src/kit/kit-measure.test.ts; one "still"
 * filler ≈ 4.5 points). Tile rules run on odd frames, so their per-object
 * cost is the odd frame's peak. Numbers in the HUD use plotvalue, which costs
 * more than any rule; the timer already did, and wasn't priced until now.
 */
const EVERY_RULE_COST = 0.5;
const TILE_RULE_COST = 1;
const TILE_RULE_COST_PER_OBJECT = 2.3;
const CONDITION_COST = 0.2;
/** Below the measurement's resolution (one filler); priced at half a filler. */
const TIMED_TURN_COST = 2;
const LEVELS_COST = 2;
const HUD_NUMBER_COST = 7;
/**
 * Model v2 spike: a thing moving by its own velocity, with a wall reaction.
 * Measured in a walled room against bounce (src/kit/kit-measure.test.ts,
 * docs/kit-model-v2.md): time-sliced like bounce, it costs the same, whether
 * interpreted or compiled per type, in quarter pixels or 8.8 fixed point.
 */
const VELOCITY_COST = 9;
/** The behaviour index the runtime gives velocity movers (after the 13 behaviours). */
const VELOCITY_BEH = BEHAVIOURS.length;

/** The type of thing a rule's "first" or "second" refers to, if any. */
export function ruleThing(w: KitTrigger, who: "first" | "second"): string | null {
  if ("touch" in w) return w.touch[who === "first" ? 0 : 1];
  if (who === "second") return null;
  return "reachesBottom" in w ? w.reachesBottom : "onTile" in w ? w.onTile[0] : null;
}

/**
 * Which types an object of each type can become through "turn" actions
 * (itself included), and back again when a turn has a time limit.
 */
export function turnReach(g: KitGame): Map<number, Set<number>> {
  const id = new Map(g.types.map((t, i) => [t.id, i]));
  const edges = new Map<number, Set<number>>(g.types.map((_, i) => [i, new Set([i])]));
  const edge = (a: string | null, b: string, back: boolean) => {
    const x = a === null ? undefined : id.get(a);
    const y = id.get(b);
    if (x === undefined || y === undefined) return;
    edges.get(x)!.add(y);
    if (back) edges.get(y)!.add(x);
  };
  for (const r of g.rules) {
    for (const a of r.then) {
      if ("turn" in a) edge(ruleThing(r.when, a.turn.who), a.turn.into, !!a.turn.seconds);
      if ("turnAll" in a) edge(a.turnAll.type, a.turnAll.into, !!a.turnAll.seconds);
    }
  }
  // Transitive closure (at most 8 types).
  for (let changed = true; changed; ) {
    changed = false;
    for (const set of edges.values()) {
      for (const v of [...set]) for (const w of edges.get(v)!) if (!set.has(w)) (set.add(w), (changed = true));
    }
  }
  return edges;
}

/** Estimated share of a frame the game needs (100 = all of it). */
export function cpuCost(g: KitGame, spawns: { type: number }[]): number {
  const id = new Map(g.types.map((t, i) => [t.id, i]));
  const launched = new Set(g.types.flatMap((t) => [t.shoots, t.drops?.type]).filter((x): x is string => !!x));
  const base = (t: number) => spawns.filter((s) => s.type === t).length + (launched.has(g.types[t]!.id) ? 1 : 0);
  const reach = turnReach(g);
  // Objects that can be of type t at some point: every type that can turn into it.
  const population = (t: number) => g.types.reduce((n, _, u) => n + (reach.get(u)!.has(t) ? base(u) : 0), 0);
  const each = (i: number) => {
    const t = g.types[i]!;
    return (t.move ? VELOCITY_COST : BEHAVIOUR_COST[t.behaviour]!) + EXTRA_ZONE_COST * (Math.ceil(t.height / 8) - 1) + (t.drops ? DROPPER_COST : 0);
  };
  let cost = 0;
  // An object that can turn into something busier is priced as the busiest thing it can be.
  g.types.forEach((_, i) => (cost += base(i) * Math.max(...[...reach.get(i)!].map(each))));
  for (const r of g.rules) {
    const w = r.when;
    cost += CONDITION_COST * (r.if?.length ?? 0);
    if ("touch" in w) {
      // The runtime loops over the scarcer side and checks every object of the other.
      const [a, b] = w.touch.map((x) => population(id.get(x)!)) as [number, number];
      cost += TOUCH_RULE_COST + TOUCH_RULE_COST_PER_PAIR * Math.max(1, Math.min(a, b)) * Math.max(a, b);
    } else if ("every" in w) {
      cost += EVERY_RULE_COST;
    } else if ("onTile" in w) {
      cost += TILE_RULE_COST + TILE_RULE_COST_PER_OBJECT * population(id.get(w.onTile[0])!);
    } else {
      const t = "allGone" in w ? w.allGone : "reachesBottom" in w ? w.reachesBottom : null;
      cost += EVENT_RULE_COST + EVENT_RULE_COST_PER_OBJECT * (t ? population(id.get(t)!) : 0);
    }
  }
  const actions = g.rules.flatMap((r) => r.then);
  if (actions.some((a) => ("turn" in a && a.turn.seconds) || ("turnAll" in a && a.turnAll.seconds))) cost += TIMED_TURN_COST;
  if (actions.some((a) => "nextLevel" in a)) cost += LEVELS_COST;
  if (g.counters.some((c) => c.show)) cost += HUD_NUMBER_COST;
  if (g.rules.some((r) => "timer" in r.when)) cost += HUD_NUMBER_COST;
  return Math.round(cost);
}

export type KitResult = { ok: true; input: BuildInput & { files: Record<string, Uint8Array> } } | { ok: false; errors: string[] };

/** Text the font can draw, uppercased and trimmed to a screen line. */
export const kitText = (s: string, max = 32) =>
  [...s.toUpperCase()].filter((c) => FONT_CHARS.includes(c) && !"#~*".includes(c)).join("").trim().slice(0, max);

interface Spawn {
  type: number;
  x: number;
  y: number;
}

export interface KitOptions {
  /** Skip the CPU budget check (cost measurements only). */
  ignoreBudget?: boolean;
  /** Velocity movers update every frame instead of on alternate frames (cost measurements only). */
  velocityEveryFrame?: boolean;
  /** Velocity movers run through the interpreted path (b_velocity) instead of compiled per-type loops (cost measurements only). */
  interpretVelocity?: boolean;
  /** Compiled velocity movers keep velocity and position in 8.8 fixed point instead of quarter pixels (cost measurements only). */
  fixed88?: boolean;
}

export function validateKit(
  input: unknown,
  library: SoundEffect[],
  opts: KitOptions = {},
): { ok: true; game: KitGame; spawns: Spawn[] } | { ok: false; errors: string[] } {
  const parsed = KitGameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `This game file is damaged (${i.path.join(".")}: ${i.message}).`) };
  }
  const g = parsed.data;
  const errors: string[] = [];
  const typeIndex = new Map(g.types.map((t, i) => [t.id, i]));
  const paletteIds = new Set(g.palettes.map((p) => p.id));

  if (typeIndex.size !== g.types.length) errors.push("Two kinds of thing have the same name.");
  for (const t of g.types) if ((TILES as readonly string[]).includes(t.id)) errors.push(`"${t.id}" is a kind of tile; give "${t.label}" another id.`);
  for (const p of [g.wallPalette, g.textPalette]) if (!paletteIds.has(p)) errors.push(`There's no palette called "${p}".`);
  for (const t of g.types) {
    if (!paletteIds.has(t.palette)) errors.push(`"${t.label}" uses a palette that doesn't exist.`);
    t.frames.forEach((f, n) => {
      if (f.length !== t.height || f.some((r) => r.length !== t.width || !/^[0-3]*$/.test(r))) {
        errors.push(`The pixels of "${t.label}" (frame ${n + 1}) are damaged.`);
      }
    });
    if (t.shoots && !typeIndex.has(t.shoots)) errors.push(`"${t.label}" shoots something that doesn't exist.`);
    if (t.shoots && !PLAYER_BEHAVIOURS.includes(t.behaviour)) errors.push(`Only the player can shoot ("${t.label}" can't).`);
    if (t.drops && !typeIndex.has(t.drops.type)) errors.push(`"${t.label}" drops something that doesn't exist.`);
    if (t.move && PLAYER_BEHAVIOURS.includes(t.behaviour)) errors.push(`The player moves by the joystick ("${t.label}" can't have its own velocity).`);
  }

  // Room: walls and where things start.
  const spawns: Spawn[] = [];
  if (g.room.rows.length !== ROOM_ROWS || g.room.rows.some((r) => r.length !== ROOM_COLS)) {
    errors.push(`The room must be ${ROOM_COLS} squares wide and ${ROOM_ROWS} tall.`);
  } else {
    g.room.rows.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        if (ch === " " || ch === ".") return;
        const what = g.room.legend[ch];
        if (!what) errors.push(`The room uses "${ch}", which doesn't stand for anything.`);
        else if (!(TILES as readonly string[]).includes(what)) {
          const t = typeIndex.get(what);
          if (t === undefined) errors.push(`The room places "${what}", which doesn't exist.`);
          else spawns.push({ type: t, x: c * 8, y: ROOMTOP + r * 16 });
        }
      });
    });
  }
  const players = spawns.filter((s) => PLAYER_BEHAVIOURS.includes(g.types[s.type]!.behaviour)).length;
  if (players > 1) errors.push("Only one player can be in the room.");
  if (spawns.length === 0) errors.push("Put at least one thing in the room.");
  const launchers = g.types.filter((t) => t.shoots || t.drops).length;
  if (spawns.length + launchers > MAX_OBJECTS) {
    errors.push(`A room can hold ${MAX_OBJECTS - launchers} things here; this one has ${spawns.length}.`);
  }
  // Zone budget: objects whose top-left lands in the same 16-line room row.
  for (let r = 0; r < ROOM_ROWS; r++) {
    const n = spawns.filter((s) => s.y === ROOMTOP + r * 16).length;
    if (n > ZONE_BUDGET) errors.push(`Row ${r + 1} of the room has ${n} things; the console can show ${ZONE_BUDGET} side by side.`);
  }

  // Counters.
  const counterIds = new Set(g.counters.map((c) => c.id));
  if (counterIds.size !== g.counters.length) errors.push("Two counters have the same name.");
  if (counterIds.has(LEVEL)) errors.push(`"${LEVEL}" is built in; give the counter another name.`);
  if (g.counters.filter((c) => c.show).length > 1) errors.push("Only one counter can be shown on screen.");
  const refCounter = (id: string, where: string, levelOk: boolean) => {
    if (id === LEVEL ? !levelOk : !counterIds.has(id)) errors.push(`${where} uses a counter "${id}" that doesn't exist.`);
  };

  // Rules.
  const refType = (id: string, where: string) => !typeIndex.has(id) && errors.push(`${where} mentions "${id}", which doesn't exist.`);
  const isPlayerType = (id: string) => PLAYER_BEHAVIOURS.includes(g.types[typeIndex.get(id) ?? -1]?.behaviour as never);
  g.rules.forEach((rule, n) => {
    const where = `Rule ${n + 1}`;
    const w = rule.when;
    if ("touch" in w) w.touch.forEach((id) => refType(id, where));
    if ("allGone" in w) refType(w.allGone, where);
    if ("reachesBottom" in w) refType(w.reachesBottom, where);
    if ("onTile" in w) refType(w.onTile[0], where);
    if ("reaches" in w) refCounter(w.reaches[0], where, true);
    for (const c of rule.if ?? []) refCounter(c.counter, where, true);
    for (const a of rule.then) {
      const who = "remove" in a ? a.remove : "respawn" in a ? a.respawn : "turn" in a ? a.turn.who : null;
      if (who && ruleThing(w, who) === null) errors.push(`${where} changes ${who === "second" ? "a second thing, but only touching involves two" : "a thing, but nothing is involved"}.`);
      if ("sound" in a && !library.some((s) => s.id === a.sound)) errors.push(`${where} plays a sound that isn't in the library.`);
      if ("add" in a) refCounter(a.add[0], where, false);
      if ("take" in a) refCounter(a.take[0], where, false);
      if ("set" in a) refCounter(a.set[0], where, false);
      const turnFrom = "turn" in a ? ruleThing(w, a.turn.who) : "turnAll" in a ? a.turnAll.type : null;
      const turnInto = "turn" in a ? a.turn.into : "turnAll" in a ? a.turnAll.into : null;
      if (turnInto) {
        refType(turnInto, where);
        if (turnFrom) refType(turnFrom, where);
        if ((turnFrom && isPlayerType(turnFrom)) || isPlayerType(turnInto)) errors.push(`${where}: the player can't turn into something else, or be turned into.`);
        if (turnFrom === turnInto) errors.push(`${where} turns something into itself.`);
      }
    }
    // A touch or tile rule isn't latched: if it's already true when the room starts and it
    // starts the room again, the room restarts forever.
    const restarts = rule.then.some((a) => "restartRoom" in a || "nextLevel" in a);
    if (restarts && spawns.length && ("touch" in w || "onTile" in w)) {
      const placed = (id: string) => spawns.filter((s) => s.type === typeIndex.get(id));
      const size = (s: Spawn) => g.types[s.type]!;
      let why: string | null = null;
      if ("onTile" in w) {
        const on = placed(w.onTile[0]).find((s) => {
          const r = Math.floor((s.y + Math.floor(size(s).height / 2) - ROOMTOP) / 16);
          const c = Math.floor((s.x + Math.floor(size(s).width / 2)) / 8);
          return g.room.legend[g.room.rows[r]?.[c] ?? " "] === w.onTile[1];
        });
        if (on) why = `a ${g.types[on.type]!.label} starts on a ${w.onTile[1]} tile`;
      } else {
        const [as, bs] = [placed(w.touch[0]), placed(w.touch[1])];
        const overlap = (a: Spawn, b: Spawn) =>
          a !== b && a.x < b.x + size(b).width && b.x < a.x + size(a).width && a.y < b.y + size(b).height && b.y < a.y + size(a).height;
        if (as.some((a) => bs.some((b) => overlap(a, b)))) why = `a ${w.touch[0]} and a ${w.touch[1]} start touching`;
      }
      if (why) errors.push(`${where} starts the room again, but it's already true when the room starts (${why}), so the room would restart forever.`);
    }
    if ("reachesBottom" in w) {
      const settles = rule.then.some((a) => "remove" in a || "respawn" in a || "win" in a || "lose" in a || "restartRoom" in a);
      if (!settles) errors.push(`${where}: something reaching the bottom must be removed or moved back, or end the game.`);
    }
  });
  if (g.sounds.shoot && !library.some((s) => s.id === g.sounds.shoot)) errors.push("The shooting sound isn't in the library.");

  if (!errors.length && !opts.ignoreBudget) {
    const cost = cpuCost(g, spawns);
    if (cost > CPU_BUDGET) {
      errors.push(`This room is too busy for the console to run smoothly (it needs ${cost}% of each frame). Remove some things or rules.`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, game: g, spawns };
}

function dataTable(name: string, values: number[]): string {
  const rows: string[] = [];
  for (let i = 0; i < values.length; i += 20) rows.push(` ${values.slice(i, i + 20).join(", ")}`);
  return ` data ${name}\n${rows.join("\n")}\nend`;
}

const triggerText = (w: KitTrigger) =>
  "touch" in w
    ? `${w.touch[0]} touches ${w.touch[1]}`
    : "allGone" in w
      ? `all ${w.allGone} are gone`
      : "reachesBottom" in w
        ? `a ${w.reachesBottom} reaches the bottom`
        : "timer" in w
          ? `${w.timer} seconds pass`
          : "every" in w
            ? `every ${w.every} seconds`
            : "reaches" in w
              ? `${w.reaches[0]} reaches ${w.reaches[1]}`
              : `a ${w.onTile[0]} is on a ${w.onTile[1]} tile`;

export function generateKit(input: unknown, library: SoundEffect[], opts: KitOptions = {}): KitResult {
  const v = validateKit(input, library, opts);
  if (!v.ok) return v;
  const { game: g } = v;
  // Placed objects are sorted by type, so each type has its own slot range;
  // launched ones (shots, bombs, drops) use the slots after them.
  const spawns = [...v.spawns].sort((a, b) => a.type - b.type);
  const launchStart = spawns.length;
  const launchedTypes = new Set(g.types.flatMap((t) => [t.shoots, t.drops?.type]).filter((x): x is string => !!x));
  /** First and last slot that start out holding objects of type t. */
  const baseSlots = (t: number): [number, number] => {
    const placed = spawns.map((s, i) => [s.type, i] as const).filter(([type]) => type === t).map(([, i]) => i);
    const launched = launchedTypes.has(g.types[t]!.id);
    if (placed.length === 0) return launched ? [launchStart, 23] : [launchStart, launchStart - 1];
    return [placed[0]!, launched ? 23 : placed.at(-1)!];
  };
  const reach = turnReach(g);
  /** First and last slot that can hold objects of type t, including things that turn into it. */
  const slots = (t: number): [number, number] => {
    const ranges = g.types.map((_, u) => u).filter((u) => reach.get(u)!.has(t)).map(baseSlots).filter(([a, b]) => b >= a);
    if (ranges.length === 0) return [launchStart, launchStart - 1];
    return [Math.min(...ranges.map((r) => r[0])), Math.max(...ranges.map((r) => r[1]))];
  };
  const typeIndex = new Map(g.types.map((t, i) => [t.id, i]));
  const paletteIndex = new Map(g.palettes.map((p, i) => [p.id, i]));
  const files: Record<string, Uint8Array> = {};
  const usedSounds = new Map<string, SoundEffect>();
  const sound = (id: string) => {
    usedSounds.set(id, library.find((s) => s.id === id)!);
    return `playsfx sfx_${id.replace(/-/g, "_")}`;
  };

  // Graphics: one PNG per frame, consecutive so `plotsprite name pal x y frame` animates; then the font.
  const graphics: string[] = [];
  g.types.forEach((t, k) => {
    t.frames.forEach((f, n) => {
      const name = n === 0 ? `spr${k}` : `spr${k}_${n}`;
      files[`${name}.png`] = encodeIndexedPng(f);
      graphics.push(` rem ${t.label}${n ? ` frame ${n + 1}` : ""}\n incgraphic ${name}.png 160A 0 1 2 3`);
    });
  });
  files["font.png"] = encodeIndexedPng(fontRows(FONT_CHARS));
  graphics.push(" incgraphic font.png 160A 0 1 2 3");

  const palettes = g.palettes
    .map((p, i) => ` rem palette ${p.id}\n P${i}C1 = ${p.colors[0]} : P${i}C2 = ${p.colors[1]} : P${i}C3 = ${p.colors[2]}`)
    .join("\n");

  // Draw routines, one per type.
  const drawRoutines = g.types
    .map(
      (t, k) =>
        // 4-byte sprite objects: every kit sprite is 160A, so none needs its own mode byte.
        // (The inline PLOTSPRITE4 macro is faster still, but skips off-screen checks.)
        `draw${k}\n rem ${t.label}\n plotsprite4 spr${k} ${paletteIndex.get(t.palette)} px py${t.frames.length > 1 ? " animframe" : ""}\n return`,
    )
    .join("\n\n");

  // Rules.
  const ruleCode: string[] = [" ruleexit = 0", " oddframe = frame & 1"];
  /** Which loop variable holds each rule's first and second thing. */
  const roles = new Map<number, { first: string; second: string }>();
  /** Most objects of a type there can be: placed ones, or one if something shoots or drops it. */
  const basePopulation = (t: number) => {
    const placed = spawns.filter((s) => s.type === t).length;
    const launched = g.types.some((x) => x.shoots === g.types[t]!.id || x.drops?.type === g.types[t]!.id) ? 1 : 0;
    return placed + launched;
  };
  const population = (t: number) => g.types.reduce((n, _, u) => n + (reach.get(u)!.has(t) ? basePopulation(u) : 0), 0);

  // Counters: cnt0-cnt3, plus the built-in level.
  const counterVar = (id: string) => (id === LEVEL ? "levelnum" : `cnt${g.counters.findIndex((c) => c.id === id)}`);
  /** Lines that jump to `fail` unless every condition holds. */
  const conditionGate = (conds: KitCondition[] | undefined, fail: string) =>
    (conds ?? []).map((c) => {
      const v = counterVar(c.counter);
      const not = { eq: "<>", ne: "=", gte: "<", lte: ">" }[c.op];
      return ` if ${v} ${not} ${c.value} then ${fail}`;
    });
  const timedTurns = g.rules.some((r) => r.then.some((a) => ("turn" in a && a.turn.seconds) || ("turnAll" in a && a.turnAll.seconds)));
  let everyCount = 0;
  const everyInit: string[] = [];
  let latch = 0;
  g.rules.forEach((rule, n) => {
    const w = rule.when;
    const L = `r${n}`;
    const out: string[] = [` rem rule ${n + 1}: when ${triggerText(w)}${rule.if?.length ? ", only if " + rule.if.map((c) => `${c.counter} ${c.op} ${c.value}`).join(" and ") : ""}`];
    const latched = "allGone" in w || "timer" in w || "reaches" in w;
    // Looping rules check their conditions first, so a false one also saves the loop.
    if (!latched && !("every" in w)) out.push(...conditionGate(rule.if, `goto ${L}_end`));
    if ("touch" in w) {
      // The outer loop runs over the scarcer type: the player (one known slot)
      // or whichever type has fewer objects. Actions still see the rule's
      // first thing as `first`.
      const first = typeIndex.get(w.touch[0])!;
      const second = typeIndex.get(w.touch[1])!;
      const swap = population(second) < population(first);
      const outer = swap ? second : first;
      const inner = swap ? first : second;
      roles.set(n, swap ? { first: "oj", second: "oi" } : { first: "oi", second: "oj" });
      const to = g.types[outer]!;
      const tn = g.types[inner]!;
      const outerIsHero = PLAYER_BEHAVIOURS.includes(to.behaviour);
      const [os, oe] = slots(outer);
      const [is, ie] = slots(inner);
      if (oe < os || ie < is) {
        ruleCode.push([out[0], ` rem (never true: no ${oe < os ? to.label : tn.label} can exist)`].join("\n"));
        return;
      }
      out.push(
        ...(outerIsHero
          ? [` oi = heroi`, ` if oi = EMPTY then goto ${L}_ni`, ` if otype[oi] <> ${outer} then goto ${L}_ni`]
          : [` for oi = ${os} to ${oe}`, ` if otype[oi] <> ${outer} then goto ${L}_ni`]),
        ` x1 = ox[oi] : y1 = oy[oi]`,
        ` for oj = ${is} to ${ie}`,
        ` if otype[oj] <> ${inner} then goto ${L}_nj`,
        ...(outer === inner ? [` if oj = oi then goto ${L}_nj`] : []),
        ` x2 = ox[oj] : y2 = oy[oj]`,
        ` if boxcollision(x1, y1, ${to.width}, ${to.height}, x2, y2, ${tn.width}, ${tn.height}) then gosub ${L}_do`,
        ` if ruleexit then return`,
        ` if otype[oi] <> ${outer} then goto ${L}_ni`,
        `${L}_nj`,
        ` next`,
        `${L}_ni`,
        ...(outerIsHero ? [] : [` next`]),
      );
    } else if ("every" in w) {
      const v = `ev${everyCount++}`;
      everyInit.push(` ${v} = ${w.every}`);
      out.push(
        ` if secondtick <> 0 then goto ${L}_end`,
        ` ${v} = ${v} - 1`,
        ` if ${v} then goto ${L}_end`,
        ` ${v} = ${w.every}`,
        ...conditionGate(rule.if, `goto ${L}_end`),
        ` gosub ${L}_do`,
        ` if ruleexit then return`,
      );
    } else if ("onTile" in w) {
      const a = typeIndex.get(w.onTile[0])!;
      const [as, ae] = slots(a);
      const kind = TILES.indexOf(w.onTile[1]) + 1;
      const t = g.types[a]!;
      if (ae < as) {
        ruleCode.push([out[0], ` rem (never true: no ${t.label} can exist)`].join("\n"));
        return;
      }
      roles.set(n, { first: "oi", second: "oj" });
      // Checked at the thing's middle, on odd frames like the other event rules.
      out.push(
        ` if oddframe = 0 then goto ${L}_end`,
        ` for oi = ${as} to ${ae}`,
        ` if otype[oi] <> ${a} then goto ${L}_ni`,
        ` px = ox[oi] + ${Math.floor(t.width / 2)} : py = oy[oi] + ${Math.floor(t.height / 2)}`,
        ` if py > 191 then goto ${L}_ni`,
        ` gosub wallat`,
        ` if cell = ${kind} then gosub ${L}_do`,
        ` if ruleexit then return`,
        `${L}_ni`,
        ` next`,
      );
    } else if ("reachesBottom" in w) {
      const a = typeIndex.get(w.reachesBottom)!;
      const [as, ae] = slots(a);
      // Event rules run on odd frames only: a frame's delay doesn't show, and it halves their cost.
      out.push(
        ` if oddframe = 0 then goto ${L}_ni2`,
        ` for oi = ${as} to ${Math.max(as, ae)}`,
        ` if otype[oi] <> ${a} then goto ${L}_ni`,
        ` y1 = oy[oi] + ${g.types[a]!.height}`,
        ` if y1 >= 190 then gosub ${L}_do`,
        ` if ruleexit then return`,
        `${L}_ni`,
        ` next`,
        `${L}_ni2`,
      );
    } else {
      // Event rules fire once each time their condition becomes true.
      const bit = latch++;
      const reg = bit < 8 ? "latches" : "latches2";
      const flag = `${reg}{${bit % 8}}`;
      out.push(` if oddframe = 0 then goto ${L}_end`);
      out.push(...conditionGate(rule.if, `${flag} = 0 : goto ${L}_end`));
      if ("allGone" in w) {
        const a = typeIndex.get(w.allGone)!;
        const [as, ae] = slots(a);
        out.push(
          ` count = 0`,
          ` for oj = ${as} to ${Math.max(as, ae)}`,
          ` if otype[oj] = ${a} then count = count + 1`,
          ` next`,
          ` if count > 0 then ${flag} = 0 : goto ${L}_end`,
        );
      } else if ("reaches" in w) {
        out.push(` if ${counterVar(w.reaches[0])} < ${w.reaches[1]} then ${flag} = 0 : goto ${L}_end`);
      } else {
        out.push(` if seconds <> ${w.timer} then ${flag} = 0 : goto ${L}_end`);
      }
      out.push(` if ${flag} then goto ${L}_end`, ` ${flag} = 1`, ` gosub ${L}_do`, ` if ruleexit then return`);
    }
    out.push(`${L}_end`, ` if gamestate <> STATE_PLAY then return`);
    ruleCode.push(out.join("\n"));
  });
  const turnLines = (x: string, from: string | null, into: string, seconds: number | undefined) => {
    const t = typeIndex.get(into)!;
    const to = g.types[t]!;
    const was = from === null ? undefined : g.types[typeIndex.get(from)!];
    // Something turning into a bigger thing could end up past the screen edge, where it could never move again.
    const clamp = [
      ...(!was || to.width > was.width ? [` if ox[${x}] > ${160 - to.width} then ox[${x}] = ${160 - to.width}`] : []),
      ...(!was || to.height > was.height ? [` if oy[${x}] > ${192 - to.height} then oy[${x}] = ${192 - to.height}`] : []),
    ];
    if (seconds) return [` if otimer[${x}] = 0 then oback[${x}] = otype[${x}]`, ` otimer[${x}] = ${seconds}`, ` otype[${x}] = ${t}`, ...clamp];
    return [...(timedTurns ? [` otimer[${x}] = 0`] : []), ` otype[${x}] = ${t}`, ...clamp];
  };
  const ruleBodies = g.rules.map((rule: KitRule, n) => {
    const role = roles.get(n) ?? { first: "oi", second: "oj" };
    const body = rule.then.map((a: KitAction, j) => {
      if ("add" in a) {
        const v = counterVar(a.add[0]);
        return ` ${v} = ${v} + ${a.add[1]}\n if ${v} > 99 then ${v} = 99`;
      }
      if ("take" in a) {
        const v = counterVar(a.take[0]);
        return ` if ${v} < ${a.take[1]} then ${v} = 0 else ${v} = ${v} - ${a.take[1]}`;
      }
      if ("set" in a) return ` ${counterVar(a.set[0])} = ${a.set[1]}`;
      if ("turn" in a) return turnLines(role[a.turn.who], ruleThing(rule.when, a.turn.who), a.turn.into, a.turn.seconds).join("\n");
      if ("turnAll" in a) {
        const from = typeIndex.get(a.turnAll.type)!;
        const [fs, fe] = slots(from);
        if (fe < fs) return ` rem (no ${a.turnAll.type} can exist)`;
        const skip = `r${n}_t${j}`;
        return [` for tk = ${fs} to ${fe}`, ` if otype[tk] <> ${from} then goto ${skip}`, ...turnLines("tk", a.turnAll.type, a.turnAll.into, a.turnAll.seconds), skip, ` next`].join("\n");
      }
      if ("nextLevel" in a) return ` if levelnum < 99 then levelnum = levelnum + 1\n gosub startroom : ruleexit = 1`;
      if ("remove" in a) return ` otype[${role[a.remove]}] = EMPTY`;
      if ("respawn" in a) {
        const x = role[a.respawn];
        return ` ox[${x}] = osx[${x}] : oy[${x}] = osy[${x}]`;
      }
      if ("score" in a) return ` score0 = score0 + ${a.score}`;
      if ("loseLife" in a) return ` gosub loselife`;
      if ("win" in a) return ` gamestate = STATE_WON : ruleexit = 1`;
      if ("lose" in a) return ` gamestate = STATE_LOST : ruleexit = 1`;
      if ("restartRoom" in a) return ` gosub startroom : ruleexit = 1`;
      return ` ${sound(a.sound)}`;
    });
    return `r${n}_do\n${body.join("\n")}\n return`;
  });

  // Text, centred; y is in zones (8 lines).
  const textLine = (s: string, y: number) => {
    const t = kitText(s);
    if (!t) return "";
    return ` plotchars '${t}' ${paletteIndex.get(g.textPalette)} ${Math.floor((160 - t.length * 4) / 2)} ${y}`;
  };

  // Data.
  const room = g.room.rows.map((r) => r.replace(/\./g, " "));
  const isWall = (ch: string) => g.room.legend[ch] === "wall";
  /** 0 empty, 1 wall, 2 hazard, 3 goal. */
  const tileOf = (ch: string) => TILES.indexOf(g.room.legend[ch] as never) + 1;
  const TILE_CHARS = ["  ", "##", "~~", "**"];
  const mapLines = room.flatMap((r) => {
    const line = [...r].map((ch) => TILE_CHARS[tileOf(ch)]).join("");
    return [line, line]; // each 16-line room row is two 8-line character rows
  });
  const hasLevels = g.rules.some((r) => r.then.some((a) => "nextLevel" in a));
  const hasVelocity = g.types.some((t) => t.move);
  const compiledVelocity = hasVelocity && !opts.interpretVelocity;
  const fixed88 = compiledVelocity && !!opts.fixed88;
  const data = [
    dataTable("typew", g.types.map((t) => t.width)),
    dataTable("typeh", g.types.map((t) => t.height)),
    dataTable("typebeh", g.types.map((t) => (t.move ? VELOCITY_BEH : BEHAVIOURS.indexOf(t.behaviour)))),
    ...(hasVelocity
      ? [
          // Quarter pixels, or in 8.8 fixed point the whole pixels (floored) and the 1/256ths.
          dataTable("typevx", g.types.map((t) => (fixed88 ? Math.floor((t.move?.vx ?? 0) / 4) : (t.move?.vx ?? 0)) & 255)),
          dataTable("typevy", g.types.map((t) => (fixed88 ? Math.floor((t.move?.vy ?? 0) / 4) : (t.move?.vy ?? 0)) & 255)),
          ...(fixed88
            ? [
                dataTable("typevxl", g.types.map((t) => ((t.move?.vx ?? 0) & 3) * 64)),
                dataTable("typevyl", g.types.map((t) => ((t.move?.vy ?? 0) & 3) * 64)),
              ]
            : []),
          dataTable("typereact", g.types.map((t) => REACTIONS.indexOf(t.move?.react ?? "stop"))),
        ]
      : []),
    dataTable("typespeed", g.types.map((t) => t.speed - 1)),
    dataTable("typeshoots", g.types.map((t) => (t.shoots ? typeIndex.get(t.shoots)! : 255))),
    dataTable("typedrops", g.types.map((t) => (t.drops ? typeIndex.get(t.drops.type)! : 255))),
    dataTable("typedropchance", g.types.map((t) => t.drops?.chance ?? 0)),
    dataTable("speedsteps", SPEED_STEPS.flat()),
    dataTable("roomwalls", room.flatMap((r) => [...r].map(tileOf))),
    ...(hasLevels ? [dataTable("typefaster", g.types.map((t) => (PLAYER_BEHAVIOURS.includes(t.behaviour) ? 0 : 1)))] : []),
    dataTable("rowoffset", Array.from({ length: ROOM_ROWS }, (_, r) => r * ROOM_COLS)),
    dataTable("spawntype", spawns.map((s) => s.type)),
    dataTable("spawnx", spawns.map((s) => s.x)),
    dataTable("spawny", spawns.map((s) => s.y)),
    ` alphadata roommap font\n${mapLines.map((l) => ` '${l}'`).join("\n")}\nend`,
  ].join("\n\n");

  // Model v2 spike, compiled movement: each velocity type gets its own loop over
  // its slot range, with its size, reaction and time-slicing written in, and an
  // axis left out when its velocity can never be anything but 0.
  const slice = !opts.velocityEveryFrame;
  const compiledMovement = !compiledVelocity
    ? ""
    : g.types
        .map((t, k) => {
          if (!t.move) return "";
          const [s0, s1] = slots(k);
          if (s1 < s0) return ` rem ${t.label}: none can exist`;
          const L = `cv${k}`;
          const react = t.move.react;
          const axis = (a: "x" | "y") => {
            const [v, f, o, next] = a === "x" ? ["ovx", "ofx", "ox", `${L}_y`] : ["ovy", "ofy", "oy", `${L}_next`];
            const start = a === "x" ? t.move!.vx : t.move!.vy;
            if (start === 0 && react !== "turn") return [` rem ${a}: always still`];
            if (fixed88) return axis88(a, v, f, o, next);
            const hit: Record<typeof react, string[]> = {
              stop: [` ${v}[oi] = 0`],
              bounce: [` tmp = ${v}[oi] : ${v}[oi] = 0 - tmp`],
              wrap: [` gosub hit${a === "x" ? "wrapx" : "wrapy"}`],
              turn: [` gosub hitturn`],
              destroy: [` otype[oi] = EMPTY`, ` goto ${L}_next`],
            };
            return [
              ` tmp = ${v}[oi]`,
              ` if tmp = 0 then goto ${next}`,
              ...(slice ? [` tmp = tmp + tmp`] : []),
              ` tmp = tmp + ${f}[oi]`,
              ` ${f}[oi] = tmp & 3`,
              ` cell = tmp / 4`,
              ` if tmp >= 128 then cell = cell | 192`,
              ` if cell = 0 then goto ${next}`,
              a === "x" ? ` nx = ${o}[oi] + cell : ny = oy[oi]` : ` nx = ox[oi] : ny = ${o}[oi] + cell`,
              ` wid = ${t.width} : hgt = ${t.height}`,
              ` gosub trymovesized`,
              ` if !blocked then goto ${next}`,
              ...hit[react],
            ];
          };
          /** The same in 8.8 fixed point: `v` holds whole pixels (signed), `vl` the 1/256ths. */
          const axis88 = (a: "x" | "y", v: string, f: string, o: string, next: string) => {
            const vl = `${v}l`;
            const negate = (hi: string, lo: string) => [
              ` tmp = ${lo}[oi] : px = ${hi}[oi]`,
              ` if tmp = 0 then ${hi}[oi] = 0 - px`,
              ` if tmp <> 0 then ${lo}[oi] = 0 - tmp : ${hi}[oi] = 255 - px`,
            ];
            const edge = a === "x" ? 160 - t.width : 192 - t.height;
            const hit: Record<typeof react, string[]> = {
              stop: [` ${v}[oi] = 0 : ${vl}[oi] = 0`],
              bounce: negate(v, vl),
              wrap:
                a === "x"
                  ? [` px = nx + ${t.width - 1}`, ` if nx < 160 && px < 160 then ${v}[oi] = 0 : ${vl}[oi] = 0 : goto ${next}`, ` tmp = ${v}[oi]`, ` if tmp < 128 then ox[oi] = 0 else ox[oi] = ${edge}`]
                  : [` py = ny + ${t.height - 1}`, ` if ny >= ROOMTOP && py < 192 then ${v}[oi] = 0 : ${vl}[oi] = 0 : goto ${next}`, ` tmp = ${v}[oi]`, ` if tmp < 128 then oy[oi] = ROOMTOP else oy[oi] = ${edge}`],
              // A quarter turn clockwise: (vx, vy) becomes (-vy, vx).
              turn: [` cell = ovx[oi] : amt = ovxl[oi]`, ...negate("ovy", "ovyl"), ` ovx[oi] = ovy[oi] : ovxl[oi] = ovyl[oi]`, ` ovy[oi] = cell : ovyl[oi] = amt`],
              destroy: [` otype[oi] = EMPTY`, ` goto ${L}_next`],
            };
            return [
              ` tmp = ${f}[oi] + ${vl}[oi] : cell = ${v}[oi]`,
              ` if tmp < ${f}[oi] then cell = cell + 1`,
              ...(slice ? [` amt = tmp + ${vl}[oi] : cell = cell + ${v}[oi]`, ` if amt < tmp then cell = cell + 1`, ` tmp = amt`] : []),
              ` ${f}[oi] = tmp`,
              ` if cell = 0 then goto ${next}`,
              a === "x" ? ` nx = ${o}[oi] + cell : ny = oy[oi]` : ` nx = ox[oi] : ny = ${o}[oi] + cell`,
              ` wid = ${t.width} : hgt = ${t.height}`,
              ` gosub trymovesized`,
              ` if !blocked then goto ${next}`,
              ...hit[react],
            ];
          };
          return [
            ` rem ${t.label}: velocity, ${react} (compiled${fixed88 ? ", 8.8 fixed point" : ""})`,
            ` for oi = ${s0} to ${s1}`,
            ` if otype[oi] <> ${k} then goto ${L}_next`,
            ...(slice ? [` tmp = oi ^ frame`, ` tmp = tmp & 1`, ` if tmp then goto ${L}_next`] : []),
            ...axis("x"),
            `${L}_y`,
            ...axis("y"),
            `${L}_next`,
            ` next`,
          ].join("\n");
        })
        .filter(Boolean)
        .join("\n");

  const shootSound = g.sounds.shoot ? sound(g.sounds.shoot) : "rem no shooting sound";
  const soundBlocks = [...usedSounds].map(([id, sfx]) => soundData(`sfx_${id.replace(/-/g, "_")}`, sfx)).join("\n\n");

  const source = Handlebars.create()
    .compile(kitEngine, { noEscape: true, strict: true, ignoreStandalone: true })({
      title: sanitizeTitle(g.title),
      runtimeVersion: KIT_RUNTIME_VERSION,
      lives: g.lives,
      constants: [
        ` const spawncount_minus1 = ${spawns.length - 1}`,
        ` const LAUNCHSTART = ${Math.min(launchStart, 23)}`,
        ` const typecount_minus1 = ${g.types.length - 1}`,
        ` autodim byte ruleexit`,
        ...g.counters.map((c, i) => ` autodim byte cnt${i}`),
        ...Array.from({ length: everyCount }, (_, i) => ` autodim byte ev${i}`),
      ].join("\n"),
      counterInit: g.counters.map((c, i) => ` cnt${i} = ${c.start}`).join("\n") || " rem no counters",
      everyInit: everyInit.join("\n") || " rem no every-N-seconds rules",
      hasTimedTurns: timedTurns,
      hasLevels,
      hudCounter: g.counters.some((c) => c.show) ? `cnt${g.counters.findIndex((c) => c.show)}` : "",
      hasDrops: g.types.some((t) => t.drops),
      hasVelocity,
      velocitySlice: slice,
      compiledVelocity,
      fixed88,
      compiledMovement: compiledMovement || " rem no compiled movement",
      graphics: graphics.join("\n"),
      alphachars: FONT_CHARS,
      palettes,
      background: g.background,
      textPalette: paletteIndex.get(g.textPalette),
      wallPalette: paletteIndex.get(g.wallPalette),
      showTimer: g.rules.some((r) => "timer" in r.when),
      hasWalls: room.some((r) => [...r].some(isWall)),
      hasTileMap: room.some((r) => [...r].some(isWall)) || g.rules.some((r) => "onTile" in r.when),
      drawLabels: g.types.map((_, k) => `draw${k}`).join(" "),
      shootSound,
      rules: ruleCode.join("\n\n"),
      ruleActions: ruleBodies.join("\n\n"),
      drawRoutines,
      titleText: [textLine(g.text.title, 9), textLine("PRESS FIRE", 12)].filter(Boolean).join("\n") || " rem no title",
      winText: textLine(g.text.win, 11) || " rem no win text",
      loseText: textLine(g.text.lose, 11) || " rem no lose text",
      dataTables: data,
      soundData: soundBlocks,
    })
    .replace(/\n{3,}/g, "\n\n");

  const lint = lintBasic(source);
  if (lint.length) return { ok: false, errors: lint.map((l) => `Runtime error on line ${l.line}: ${l.message}`) };
  return { ok: true, input: { source, files } };
}
