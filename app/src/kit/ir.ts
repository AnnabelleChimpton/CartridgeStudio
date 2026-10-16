// Kit model v2, step 2 of 3: validate a kit game and lower it to a typed IR
// (intermediate representation). The IR is plain data: kinds of thing with
// their movement parts and slot ranges, rooms with their placements, and
// rules lowered to triggers, comparisons and actions with every name
// resolved. Every node carries a source span (the id of the type, rule,
// action or room it came from), so the emitter can say which lines came
// from what (coder mode's rule-to-code view, readable rems).
//
// emit.ts turns the IR into 7800basic; nothing after this file looks at the
// game JSON again.

import type { SoundEffect } from "../project/schema.ts";
import {
  FONT_CHARS,
  KitGameSchema,
  LEVEL,
  LIVES,
  MAX_OBJECTS,
  ROOM_COLS,
  ROOM_ROWS,
  SCORE,
  SECONDS,
  SPEED_STEPS,
  TILES,
  type KitAction,
  type KitCompare,
  type KitGame,
  type KitRule,
  type KitSpeed,
  type KitTarget,
  type KitTrigger,
  type KitType,
  type KitValue,
  type Op,
  type Prop,
  type Side,
} from "./schema.ts";

export const ROOMTOP = 16;
/** Objects one zone (8 lines) can hold, besides the walls and HUD. Measured, see docs/kit-spike-findings.md. */
export const ZONE_BUDGET = 12;
/** The built-in value for the room number (1 = the first room). */
export const ROOM = "room";

// ---- IR ----

export interface Span {
  kind: "type" | "rule" | "action" | "room" | "counter" | "flow" | "hook";
  id: string;
}

export interface IRSpeed {
  step: number;
  /** A counter's variable that adds steps, capped at `max`. */
  plus?: string;
  max: number;
}

export interface IRType {
  index: number;
  id: string;
  label: string;
  /** The const the generated code compares otype with (T_CAT). */
  sym: string;
  /** The id as it appears in labels (upd_fast_ghost). */
  name: string;
  /** Graphic name of the first frame (spr_cat). */
  sprite: string;
  width: number;
  height: number;
  palette: number;
  frames: string[][];
  /** Animation frames per direction set (1 or 2), and direction sets (1, 2 or 4). */
  anim: 1 | 2;
  dirSets: 1 | 2 | 4;
  animate: 4 | 8 | 16 | 32 | "moving";
  control?: { joystick: 1 | 2; axes: "lr" | "ud" | "4way" | "8way"; mode: "direct" | "keep"; speed: IRSpeed };
  steer?: { target: number; away: boolean; speed: IRSpeed; every: 1 | 2 | 4 };
  gravity?: { amount: number | "a" | "b"; max: number; axis: "x" | "y" };
  move: {
    vx: number;
    vy: number;
    pace?: { plus: string; max: number };
    wall: KitType["move"]["wall"];
    edge: KitType["move"]["edge"];
    /** Moves on alternate frames (by slot), twice as far. */
    sliced: boolean;
  };
  /** The slots reserved for this kind (placed and created things). */
  own: [number, number];
  /** Every slot that can hold this kind, including things that turn into it. Empty when b < a. */
  loop: [number, number];
  /** Most things that can be this kind at once (the cost model's population). */
  population: number;
  /** Other kinds whose things can turn into this one. */
  from: number[];
  /** Whether its velocity along each axis can ever be anything but 0 (else that axis's code is left out). */
  axes: { x: boolean; y: boolean };
  /** What this kind's compiled code needs. */
  uses: { facing: boolean; contact: boolean; leavesRule: boolean; exits: boolean; moves: boolean };
  vars: { a: number; b: number };
  /** Coder mode: 7800basic run after its movement, per thing (slot in mi). */
  hook?: string;
  span: Span;
}

export interface IRSpawn {
  type: number;
  x: number;
  y: number;
  slot: number;
  /** Index of this placement in its room (for the taken-items bits). */
  place: number;
}

export interface IRRoom {
  index: number;
  rows: string[];
  /** 0 empty, 1 wall, 2 hazard, 3 goal, by row then column. */
  tiles: number[];
  spawns: IRSpawn[];
  exits: { left?: number; right?: number; up?: number; down?: number };
  span: Span;
}

export interface IRCounter {
  id: string;
  label: string;
  /** The variable that holds it. */
  name: string;
  start: number;
  keep: "game" | "room";
  span: Span;
}

export type IRWho = "it" | "other" | "target";
export type IRSource =
  | { k: "lit"; n: number }
  | { k: "var"; name: string }
  | { k: "prop"; prop: Prop; of: IRWho }
  | { k: "count"; type: number }
  | { k: "random"; n: number }
  | { k: "joy"; axis: "x" | "y" }
  | { k: "facing"; axis: "x" | "y"; of: IRWho }
  | { k: "contact"; side: Side; of: IRWho };
export interface IRValue {
  src: IRSource;
  times?: number;
  div?: 2 | 4 | 8;
  neg?: boolean;
  plus?: number;
  /** Compared as signed (-128 to 127). */
  signed: boolean;
}
export interface IRCompare {
  a: IRValue;
  op: Op;
  b: IRValue;
}

export type IRTarget =
  | { k: "it"; type: number }
  | { k: "other"; type: number }
  | { k: "every"; type: number; where?: IRCompare }
  | { k: "nearest"; type: number }
  | { k: "random"; type: number };

export type IRActionBody =
  | { k: "counter"; mode: "set" | "add" | "take"; name: string; value: IRValue }
  | { k: "score"; mode: "set" | "add" | "take"; value: IRValue }
  | { k: "prop"; mode: "set" | "add" | "take"; prop: Prop; who: IRTarget; value: IRValue }
  | { k: "step"; who: IRTarget; dx: IRValue; dy: IRValue }
  | { k: "create"; type: number; at: IRTarget | { x: IRValue; y: IRValue }; place: "on" | "above" | "below" | "centre"; dx: number; dy: number; vx?: IRValue; vy?: IRValue }
  | { k: "destroy"; who: IRTarget }
  | { k: "turn"; who: IRTarget; into: number; tenths?: number }
  | { k: "toStart"; who: IRTarget }
  | { k: "startHere"; who: IRTarget }
  | { k: "protect"; who: IRTarget; tenths: number }
  | { k: "sound"; label: string }
  | { k: "send"; bit: number }
  | { k: "restart" }
  | { k: "goRoom"; room: number }
  | { k: "nextRoom" }
  | { k: "resetTaken" }
  | { k: "gameOver"; won: boolean }
  | { k: "run"; label: string };
export type IRAction = IRActionBody & { id: string; span: Span };

export type IRTrigger =
  | { k: "touch"; a: number; b: number }
  | { k: "tile"; type: number; tile: number }
  | { k: "edge"; type: number; sides: Side[] }
  | { k: "wall"; type: number; sides: Side[] }
  | { k: "leaves"; type: number }
  | { k: "timerOut"; type: number }
  | { k: "created"; type: number }
  | { k: "destroyed"; type: number }
  | { k: "button"; released: boolean; types: number[] }
  | { k: "pushed"; dir: "left" | "right" | "up" | "down" | "any"; types: number[] }
  | { k: "every"; n: number; frames: boolean; counter: string }
  | { k: "after"; n: number }
  | { k: "roomStart" }
  | { k: "test"; cmp: IRCompare }
  | { k: "message"; bit: number };

export interface IRRule {
  /** 1-based, as the editor numbers rules. */
  n: number;
  id: string;
  label: string;
  trigger: IRTrigger;
  fires: "once" | "while" | null;
  any: boolean;
  /** Where its "fires once" memory is: a global latch bit, a per-thing bit, or none. */
  latch: { k: "global"; bit: number } | { k: "thing"; bit: number } | null;
  /** Conditions that don't read it/other (checked before looking at any thing), and those that do. */
  pre: IRCompare[];
  post: IRCompare[];
  actions: IRAction[];
  /** Runs inside another rule's action (created, destroyed): uses its own variables. */
  event: boolean;
  /** The kinds "it" can be (one compiled body each); empty when there's no "it". */
  its: number[];
  other: number | null;
  span: Span;
}

export interface IRHud {
  show: string;
  /** "score" for the 6-digit score, else a byte variable. */
  name: string;
  at: "left" | "middle" | "middle-right" | "right";
}

export interface IR {
  title: string;
  types: IRType[];
  rooms: IRRoom[];
  counters: IRCounter[];
  rules: IRRule[];
  hud: IRHud[];
  messages: string[];
  palettes: { id: string; colors: [string, string, string] }[];
  background: string;
  textPalette: number;
  wallPalette: number;
  text: { title: string; win: string; lose: string };
  flow: {
    title: boolean;
    attract: { after: number; input: number[] } | null;
    end: { show: { label: string; name: string }[]; after: number };
    remember: boolean;
  };
  sounds: { label: string; id: string }[];
  code: { init: string; startroom: string; frame: string; draw: string; routines: { label: string; body: string }[]; cost: number };
  /** What the runtime needs compiled in. */
  features: {
    walls: boolean;
    tileMap: boolean;
    timers: boolean;
    protect: boolean;
    timedTurns: boolean;
    facing: boolean;
    contact: boolean;
    latchThings: boolean;
    globalLatches: number;
    everyCounters: string[];
    messages: boolean;
    rooms: number;
    exits: boolean;
    remember: boolean;
    vars: boolean;
    place: boolean;
    joy2: boolean;
  };
}

// ---- helpers ----

/** The default for "fires" on states: touching and tiles hold while true; tests, edges and walls fire once. */
export function stateDefault(w: KitTrigger): "once" | "while" | null {
  if ("touch" in w || "onTile" in w) return "while";
  if ("edge" in w || "wall" in w || "test" in w) return "once";
  return null;
}
/** States about things: those can say "any" (fire once a frame) instead of once per thing. */
export const thingState = (w: KitTrigger) => "touch" in w || "onTile" in w || "edge" in w || "wall" in w;

/** The kind of thing a rule's "it" (or "other") is, when the trigger has one. Button and push rules: see itTypes. */
export function triggerThing(w: KitTrigger, who: "it" | "other"): string | null {
  if ("touch" in w) return w.touch[who === "it" ? 0 : 1];
  if (who === "other") return null;
  if ("onTile" in w) return w.onTile[0];
  if ("edge" in w) return w.edge[0];
  if ("wall" in w) return w.wall[0];
  if ("leaves" in w) return w.leaves;
  if ("timerOut" in w) return w.timerOut;
  if ("created" in w) return w.created;
  if ("destroyed" in w) return w.destroyed;
  return null;
}

/** Every kind "it" can be: the trigger's thing, or each kind the joystick controls for button and push rules. */
export function itTypes(w: KitTrigger, g: Pick<KitGame, "types">): string[] {
  const t = triggerThing(w, "it");
  if (t) return [t];
  if ("button" in w || "pushed" in w) {
    const joy = "button" in w ? w.button.joy : w.pushed.joy;
    return g.types.filter((x) => x.control?.joystick === joy).map((x) => x.id);
  }
  return [];
}

/** Every value inside a value, comparison or action, with its context. */
function targetsOf(a: KitAction): KitTarget[] {
  const out: KitTarget[] = [];
  const settable = (s: { counter: string } | { prop: Prop; of: KitTarget }) => ("prop" in s ? out.push(s.of) : 0);
  if ("set" in a) settable(a.set.what);
  if ("add" in a) settable(a.add.what);
  if ("take" in a) settable(a.take.what);
  if ("step" in a) out.push(a.step.who);
  if ("create" in a && !(typeof a.create.at === "object" && "x" in a.create.at)) out.push(a.create.at as KitTarget);
  if ("destroy" in a) out.push(a.destroy);
  if ("turn" in a) out.push(a.turn.who);
  if ("toStart" in a) out.push(a.toStart);
  if ("startHere" in a) out.push(a.startHere);
  if ("protect" in a) out.push(a.protect.who);
  return out;
}
const targetType = (t: KitTarget, it: string | null, other: string | null): string | null =>
  t === "it" ? it : t === "other" ? other : "every" in t ? t.every : "nearest" in t ? t.nearest : t.random;

/** For each turn action: which kinds it turns from and into (seconds: it turns back). */
export function turnEdges(g: Pick<KitGame, "types" | "rules">): { from: string; into: string; back: boolean }[] {
  const out: { from: string; into: string; back: boolean }[] = [];
  for (const r of g.rules) {
    const its = itTypes(r.when, g);
    const other = triggerThing(r.when, "other");
    for (const a of r.then) {
      if (!("turn" in a)) continue;
      const froms = a.turn.who === "it" ? its : [targetType(a.turn.who, null, other)].filter((x): x is string => !!x);
      for (const from of froms) out.push({ from, into: a.turn.into, back: !!a.turn.seconds });
    }
  }
  return out;
}

/** Which kinds a thing of each kind can become through "turn" actions (itself included), and back again. */
export function turnReach(g: Pick<KitGame, "types" | "rules">): Map<number, Set<number>> {
  const id = new Map(g.types.map((t, i) => [t.id, i]));
  const reach = new Map<number, Set<number>>(g.types.map((_, i) => [i, new Set([i])]));
  for (const e of turnEdges(g)) {
    const x = id.get(e.from);
    const y = id.get(e.into);
    if (x === undefined || y === undefined) continue;
    reach.get(x)!.add(y);
    if (e.back) reach.get(y)!.add(x);
  }
  for (let changed = true; changed; ) {
    changed = false;
    for (const set of reach.values()) for (const v of [...set]) for (const w of reach.get(v)!) if (!set.has(w)) (set.add(w), (changed = true));
  }
  return reach;
}

/** Things each room places: [kind id, x, y] in reading order. */
export function roomPlacements(g: Pick<KitGame, "room" | "rooms">): { room: number; type: string; col: number; row: number }[][] {
  const all = [g.room.rows, ...g.rooms.map((r) => r.rows)];
  return all.map((rows, room) => {
    const out: { room: number; type: string; col: number; row: number }[] = [];
    rows.forEach((r, row) =>
      [...r].forEach((ch, col) => {
        const what = g.room.legend[ch];
        if (what && !(TILES as readonly string[]).includes(what)) out.push({ room, type: what, col, row });
      }),
    );
    return out;
  });
}

export const typeSym = (id: string) => `T_${id.toUpperCase().replace(/-/g, "_")}`;
/** A kind's id for labels (upd_fast_ghost); with its number when another kind's name starts the same, so labels can't clash. */
function labelName(id: string, k: number, all: string[]): string {
  const base = id.replace(/-/g, "_");
  const clash = all.some((other, j) => j !== k && other.replace(/-/g, "_").startsWith(`${base}_`));
  return clash ? `${base}${k}` : base;
}
export const spriteName = (id: string) => `spr_${id.replace(/-/g, "_")}`;
const counterName = (id: string) => (id === LIVES ? "lives" : id === LEVEL ? "levelnum" : `cnt_${id.replace(/-/g, "_")}`);

/** Text the font can draw, uppercased and trimmed to a screen line. */
export const kitText = (s: string, max = 32) =>
  [...s.toUpperCase()].filter((c) => FONT_CHARS.includes(c) && !"#~*".includes(c)).join("").trim().slice(0, max);

const SIGNED_PROPS: Prop[] = ["vx", "vy"];
const DEFAULT_DEMO = [8, 40, 24, 2, 8, 30, 0, 10, 4, 50, 20, 2, 4, 30, 1, 20, 2, 20, 16, 2, 0, 20];

export interface LowerOptions {
  /** Things nobody controls move every frame (cost measurements only). */
  everyFrame?: boolean;
}

export type LowerResult = { ok: true; ir: IR; game: KitGame } | { ok: false; errors: string[] };

/** Validates a kit game and lowers it to the IR. `library` null skips checking sounds (pricing only). */
export function lowerKit(input: unknown, library: SoundEffect[] | null, opts: LowerOptions = {}): LowerResult {
  const parsed = KitGameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `This game file is damaged (${i.path.join(".")}: ${i.message}).`) };
  }
  const g = parsed.data;
  const errors: string[] = [];
  const err = (s: string) => errors.push(s);
  const typeIndex = new Map(g.types.map((t, i) => [t.id, i]));
  const paletteIndex = new Map(g.palettes.map((p, i) => [p.id, i]));
  const label = (id: string) => g.types.find((t) => t.id === id)?.label ?? id;

  // ---- kinds of thing ----
  if (typeIndex.size !== g.types.length) err("Two kinds of thing have the same name.");
  for (const t of g.types) if ((TILES as readonly string[]).includes(t.id)) err(`"${t.id}" is a kind of tile; give "${t.label}" another id.`);
  for (const p of [g.wallPalette, g.textPalette]) if (!paletteIndex.has(p)) err(`There's no palette called "${p}".`);

  // ---- counters and built-in values ----
  const counterIds = new Set(g.counters.map((c) => c.id));
  if (counterIds.size !== g.counters.length) err("Two counters have the same name.");
  for (const c of g.counters) if ([SCORE, SECONDS, ROOM].includes(c.id)) err(`"${c.id}" is built in; give the counter another name.`);
  /** Readable byte values: counters, seconds and the room number. */
  const varName = (id: string, where: string): string => {
    if (id === SECONDS) return "seconds";
    if (id === ROOM) return "roomnum";
    if (!counterIds.has(id)) err(`${where} uses a counter "${id}" that doesn't exist.`);
    return counterName(id);
  };
  const speed = (s: KitSpeed, where: string): IRSpeed => ({
    step: s.step,
    ...(s.plus ? { plus: varName(s.plus, where) } : {}),
    max: s.max ?? 6,
  });

  for (const t of g.types) {
    const where = `"${t.label}"`;
    if (!paletteIndex.has(t.palette)) err(`${where} uses a palette that doesn't exist.`);
    t.frames.forEach((f, n) => {
      if (f.length !== t.height || f.some((r) => r.length !== t.width || !/^[0-3]*$/.test(r))) err(`The pixels of ${where} (frame ${n + 1}) are damaged.`);
    });
    const sets = t.display?.directions === "lr" ? 2 : t.display?.directions === "4" ? 4 : 1;
    if (t.frames.length !== sets && t.frames.length !== 2 * sets) err(`${where} needs ${sets} or ${2 * sets} frames for its directions; it has ${t.frames.length}.`);
    if (t.control?.joystick === 2) err(`${where} is moved by joystick 2: two players are coming soon (the "Player 2" part is reserved).`);
    if (t.steer && !typeIndex.has(t.steer.toward)) err(`${where} steers toward something that doesn't exist.`);
    if (t.control && t.steer) err(`${where} can't both follow a joystick and steer by itself.`);
    if (t.move.pace) {
      varName(t.move.pace.plus, where);
      for (const v of [t.move.vx, t.move.vy]) if (v && !SPEED_STEPS.includes(Math.abs(v) as never)) err(`${where} speeds up with a counter, so its speed must be a speed step.`);
    }
    if (t.control) speed(t.control.speed, where);
    if (t.steer) speed(t.steer.speed, where);
  }

  // ---- rooms ----
  const rooms = [g.room, ...g.rooms];
  const placements = roomPlacements(g);
  rooms.forEach((room, r) => {
    const name = rooms.length > 1 ? `Room ${r + 1}` : "The room";
    if (room.rows.length !== ROOM_ROWS || room.rows.some((x) => x.length !== ROOM_COLS)) {
      err(`${name} must be ${ROOM_COLS} squares wide and ${ROOM_ROWS} tall.`);
      return;
    }
    for (const row of room.rows) for (const ch of row) if (ch !== " " && ch !== "." && !g.room.legend[ch]) err(`${name} uses "${ch}", which doesn't stand for anything.`);
    for (const p of placements[r]!) if (!typeIndex.has(p.type)) err(`${name} places "${p.type}", which doesn't exist.`);
    for (let row = 0; row < ROOM_ROWS; row++) {
      const n = placements[r]!.filter((p) => p.row === row).length;
      if (n > ZONE_BUDGET) err(`Row ${row + 1} of ${name.toLowerCase()} has ${n} things; the console can show ${ZONE_BUDGET} side by side.`);
    }
    for (const [side, to] of Object.entries(room.exits ?? {})) if (to > rooms.length) err(`${name}'s ${side} exit leads to room ${to}, which doesn't exist.`);
  });
  if (placements.flat().length === 0) err("Put at least one thing in the room.");
  if (errors.length) return { ok: false, errors };

  // ---- rules: references ----
  const messages = new Map(g.messages.map((m, i) => [m, i]));
  if (messages.size !== g.messages.length) err("Two messages have the same name.");
  const routines = new Set((g.code?.routines ?? []).map((r) => r.label));
  const created = new Set<string>();
  for (const r of g.rules) for (const a of r.then) if ("create" in a) created.add(a.create.type);
  const hasRule = (pred: (w: KitTrigger) => boolean) => g.rules.some((r) => pred(r.when));
  const createdRules = new Set(g.rules.flatMap((r) => ("created" in r.when ? [r.when.created] : [])));
  const destroyedRules = new Set(g.rules.flatMap((r) => ("destroyed" in r.when ? [r.when.destroyed] : [])));

  g.rules.forEach((rule, i) => {
    const where = `Rule ${i + 1}`;
    const w = rule.when;
    const its = itTypes(w, g);
    const other = triggerThing(w, "other");
    const refType = (id: string) => (typeIndex.has(id) ? true : (err(`${where} mentions "${id}", which doesn't exist.`), false));
    for (const id of [triggerThing(w, "it"), other]) if (id) refType(id);
    if ("button" in w && w.button.button === 2) err(`${where} uses button 2: two-button controllers are coming soon.`);
    if (("button" in w && w.button.joy === 2) || ("pushed" in w && w.pushed.joy === 2)) err(`${where} uses joystick 2: two players are coming soon.`);
    if ("message" in w && !messages.has(w.message)) err(`${where} listens for a message "${w.message}" that doesn't exist.`);
    if (rule.fires && !stateDefault(w)) err(`${where}: only rules about something being true can say "once" or "while".`);
    if (rule.any && !thingState(w)) err(`${where}: only rules about things touching, tiles, edges or walls can say "any".`);
    const event = "created" in w || "destroyed" in w;
    /** Checks a value can be read here; `target` is the kind "target" means, if any. */
    const checkValue = (v: KitValue, target: string | null, points = false) => {
      if (typeof v === "number") {
        if (v > 255 && !points) err(`${where} uses ${v}, but numbers go up to 255 (only points can be bigger).`);
        return;
      }
      if ("counter" in v) {
        if (v.counter === SCORE) err(`${where} reads the score, which can only be added to or taken from.`);
        else varName(v.counter, where);
      }
      if ("count" in v) refType(v.count);
      if ("joy" in v && v.joy === 2) err(`${where} reads joystick 2: two players are coming soon.`);
      if ("of" in v) {
        const kind = v.of === "it" ? (its[0] ?? null) : v.of === "other" ? other : target;
        if (!kind) err(`${where} reads ${v.of === "target" ? "the target" : v.of === "it" ? "a thing" : "a second thing"}, but there isn't one here.`);
      }
    };
    const checkCompare = (c: KitCompare, target: string | null) => (checkValue(c.a, target), checkValue(c.b, target));
    if ("test" in w) checkCompare(w.test, null);
    for (const c of rule.if ?? []) checkCompare(c, null);
    const checkTarget = (t: KitTarget): string | null => {
      if (t === "it" && !its.length) return (err(`${where} changes a thing, but nothing is involved.`), null);
      if (t === "other" && !other) return (err(`${where} changes a second thing, but only touching involves two.`), null);
      const kind = targetType(t, its[0] ?? null, other);
      if (kind && !refType(kind)) return null;
      if (typeof t === "object" && "every" in t && t.where) checkCompare(t.where, kind);
      return kind;
    };
    for (const a of rule.then) {
      for (const t of targetsOf(a)) checkTarget(t);
      const settable = "set" in a ? a.set : "add" in a ? a.add : "take" in a ? a.take : null;
      if (settable) {
        const what = settable.what;
        const value = "to" in settable ? settable.to : settable.by;
        const kind = "prop" in what ? targetType(what.of, its[0] ?? null, other) : null;
        checkValue(value, kind, "counter" in what && what.counter === SCORE);
        if ("counter" in what) {
          if (what.counter === SECONDS || what.counter === ROOM) err(`${where} changes "${what.counter}", which only the game changes.`);
          else if (what.counter === SCORE) {
            if ("set" in a && a.set.to !== 0) err(`${where} sets the score to something other than 0; add or take points instead.`);
          } else varName(what.counter, where);
        }
      }
      if ("step" in a) {
        const kind = targetType(a.step.who, its[0] ?? null, other);
        checkValue(a.step.dx, kind);
        checkValue(a.step.dy, kind);
      }
      if ("create" in a) {
        refType(a.create.type);
        const at = a.create.at;
        const kind = typeof at === "object" && "x" in at ? null : targetType(at as KitTarget, its[0] ?? null, other);
        if (typeof at === "object" && "x" in at) (checkValue(at.x, null), checkValue(at.y, null));
        for (const v of [a.create.vx, a.create.vy]) if (v !== undefined) checkValue(v, kind);
        if (event && createdRules.has(a.create.type)) err(`${where} runs when something appears or goes, so it can't create a ${label(a.create.type)}, which sets off another such rule.`);
      }
      if ("destroy" in a) {
        const kind = targetType(a.destroy, its[0] ?? null, other);
        if (event && kind && destroyedRules.has(kind)) err(`${where} runs when something appears or goes, so it can't remove a ${label(kind)}, which sets off another such rule.`);
      }
      if ("turn" in a) refType(a.turn.into);
      if ("sound" in a && library && !library.some((s) => s.id === a.sound)) err(`${where} plays a sound that isn't in the library.`);
      if ("send" in a && !messages.has(a.send)) err(`${where} sends a message "${a.send}" that doesn't exist.`);
      if ("goRoom" in a && a.goRoom > rooms.length) err(`${where} goes to room ${a.goRoom}, which doesn't exist.`);
      if ("run" in a && !routines.has(a.run)) err(`${where} runs code "${a.run}", which isn't one of the game's routines.`);
      if ("roomStart" in w && ("restartRoom" in a || "goRoom" in a || "nextRoom" in a)) err(`${where} runs when the room starts, so it can't start a room again (that would never stop).`);
    }
    if ("edge" in w && (rule.fires ?? stateDefault(w)) === "while") {
      const settles = rule.then.some(
        (a) =>
          ("destroy" in a && a.destroy === "it") ||
          ("toStart" in a && a.toStart === "it") ||
          "gameOver" in a ||
          "restartRoom" in a ||
          "goRoom" in a ||
          "nextRoom" in a ||
          (("set" in a || "add" in a || "take" in a) && (() => {
            const s = "set" in a ? a.set : "add" in a ? a.add : a.take;
            return "prop" in s.what && (s.what.prop === "x" || s.what.prop === "y");
          })()),
      );
      if (!settles) err(`${where}: something at the edge must be removed or moved back, or end the game (or make the rule fire once).`);
    }
  });
  for (const id of Object.keys(g.code?.update ?? {})) if (!typeIndex.has(id)) err(`Code runs for "${id}", which doesn't exist.`);

  // ---- slots: each kind gets its own range, sized for what's placed and created ----
  const maxPlaced = (id: string) => Math.max(0, ...placements.map((ps) => ps.filter((p) => p.type === id).length));
  const own: [number, number][] = [];
  let next = 0;
  for (const t of g.types) {
    const placed = maxPlaced(t.id);
    const size = Math.max(placed, t.cap ?? (placed + (created.has(t.id) ? 1 : 0)));
    own.push([next, next + size - 1]);
    next += size;
  }
  if (next > MAX_OBJECTS) err(`A game can hold ${MAX_OBJECTS} things at once; this one needs ${next} (things placed, plus room for the ones rules create).`);
  if (errors.length) return { ok: false, errors };

  const reach = turnReach(g);
  const loop = (t: number): [number, number] => {
    const ranges = g.types.map((_, u) => u).filter((u) => reach.get(u)!.has(t)).map((u) => own[u]!).filter(([a, b]) => b >= a);
    if (!ranges.length) return [0, -1];
    return [Math.min(...ranges.map((r) => r[0])), Math.max(...ranges.map((r) => r[1]))];
  };
  const population = (t: number) => g.types.reduce((n, _, u) => n + (reach.get(u)!.has(t) ? own[u]![1] - own[u]![0] + 1 : 0), 0);

  // ---- lowering ----
  const value = (v: KitValue): IRValue => {
    if (typeof v === "number") return { src: { k: "lit", n: v }, signed: v < 0 };
    const mods = { ...(v.times ? { times: v.times } : {}), ...(v.div ? { div: v.div } : {}), ...(v.neg ? { neg: true } : {}), ...(v.plus ? { plus: v.plus } : {}) };
    let src: IRSource;
    let signed = !!v.neg || (v.plus ?? 0) < 0;
    if ("counter" in v) src = { k: "var", name: varName(v.counter, "") };
    else if ("prop" in v) {
      src = { k: "prop", prop: v.prop, of: v.of };
      signed ||= SIGNED_PROPS.includes(v.prop);
    } else if ("count" in v) src = { k: "count", type: typeIndex.get(v.count)! };
    else if ("random" in v) src = { k: "random", n: v.random };
    else if ("joy" in v) {
      src = { k: "joy", axis: v.axis };
      signed = true;
    } else if ("facing" in v) {
      src = { k: "facing", axis: v.facing, of: v.of };
      signed = true;
    } else src = { k: "contact", side: v.contact, of: v.of };
    return { src, ...mods, signed };
  };
  const compare = (c: KitCompare): IRCompare => ({ a: value(c.a), op: c.op, b: value(c.b) });
  const readsThing = (v: IRValue, who: IRWho[] = ["it", "other"]) => "of" in v.src && who.includes(v.src.of);
  const cmpReadsThing = (c: IRCompare) => readsThing(c.a) || readsThing(c.b);

  let globalLatches = 0;
  let thingLatches = 0;
  const everyCounters: string[] = [];
  const sounds = new Map<string, string>();
  const facingTypes = new Set<number>();
  const contactTypes = new Set<number>();
  const noteValue = (v: IRValue, kinds: (number | null)[]) => {
    if (v.src.k === "facing" || (v.src.k === "prop" && v.src.prop === "facing")) for (const k of kinds) if (k !== null) facingTypes.add(k);
    if (v.src.k === "contact") for (const k of kinds) if (k !== null) contactTypes.add(k);
  };

  const rules: IRRule[] = g.rules.map((rule: KitRule, i): IRRule => {
    const n = i + 1;
    const w = rule.when;
    const span: Span = { kind: "rule", id: rule.id };
    const its = itTypes(w, g).map((id) => typeIndex.get(id)!);
    const otherId = triggerThing(w, "other");
    const other = otherId ? typeIndex.get(otherId)! : null;
    const tIdx = (id: string) => typeIndex.get(id)!;
    const sidesOf = (s: string): Side[] => (s === "any" ? ["left", "right", "top", "bottom"] : s === "sides" ? ["left", "right"] : [s as Side]);
    const trigger: IRTrigger =
      "touch" in w
        ? { k: "touch", a: tIdx(w.touch[0]), b: tIdx(w.touch[1]) }
        : "onTile" in w
          ? { k: "tile", type: tIdx(w.onTile[0]), tile: TILES.indexOf(w.onTile[1]) + 1 }
          : "edge" in w
            ? { k: "edge", type: tIdx(w.edge[0]), sides: sidesOf(w.edge[1]) }
            : "wall" in w
              ? { k: "wall", type: tIdx(w.wall[0]), sides: sidesOf(w.wall[1]) }
              : "leaves" in w
                ? { k: "leaves", type: tIdx(w.leaves) }
                : "timerOut" in w
                  ? { k: "timerOut", type: tIdx(w.timerOut) }
                  : "created" in w
                    ? { k: "created", type: tIdx(w.created) }
                    : "destroyed" in w
                      ? { k: "destroyed", type: tIdx(w.destroyed) }
                      : "button" in w
                        ? { k: "button", released: !!w.button.released, types: its }
                        : "pushed" in w
                          ? { k: "pushed", dir: w.pushed.dir, types: its }
                          : "every" in w
                            ? { k: "every", n: w.every, frames: !!w.frames, counter: (everyCounters.push(`ev${n}`), `ev${n}`) }
                            : "after" in w
                              ? { k: "after", n: w.after }
                              : "roomStart" in w
                                ? { k: "roomStart" }
                                : "test" in w
                                  ? { k: "test", cmp: compare(w.test) }
                                  : { k: "message", bit: messages.get(w.message)! };
    if (trigger.k === "wall") contactTypes.add(trigger.type);
    const fires = stateDefault(w) ? (rule.fires ?? stateDefault(w)) : null;
    const any = !!rule.any && thingState(w);
    let latch: IRRule["latch"] = null;
    if (fires === "once" || trigger.k === "after") {
      if (thingState(w) && !any) latch = { k: "thing", bit: thingLatches++ };
      else latch = { k: "global", bit: globalLatches++ };
    }
    const conds = (rule.if ?? []).map(compare);
    if (trigger.k === "test") for (const k of [trigger.cmp.a, trigger.cmp.b]) noteValue(k, []);
    for (const c of conds) for (const v of [c.a, c.b]) noteValue(v, [readsOf(v, its, other)].flat());

    const target = (t: KitTarget): IRTarget => {
      if (t === "it") return { k: "it", type: its[0]! };
      if (t === "other") return { k: "other", type: other! };
      if ("every" in t) {
        const where = t.where ? compare(t.where) : undefined;
        if (where) for (const v of [where.a, where.b]) noteValue(v, [tIdx(t.every)]);
        return { k: "every", type: tIdx(t.every), ...(where ? { where } : {}) };
      }
      if ("nearest" in t) return { k: "nearest", type: tIdx(t.nearest) };
      return { k: "random", type: tIdx(t.random) };
    };
    const actions: IRAction[] = rule.then.map((a): IRAction => {
      const base = { id: a.id, span: { kind: "action", id: a.id } as Span };
      const settable = (mode: "set" | "add" | "take", what: { counter: string } | { prop: Prop; of: KitTarget }, v: KitValue): IRAction => {
        const val = value(v);
        if ("counter" in what) {
          if (what.counter === SCORE) return { ...base, k: "score", mode, value: val };
          return { ...base, k: "counter", mode, name: varName(what.counter, ""), value: val };
        }
        const who = target(what.of);
        noteValue(val, [who.type, ...its]);
        if (what.prop === "facing") facingTypes.add(who.type);
        return { ...base, k: "prop", mode, prop: what.prop, who, value: val };
      };
      if ("set" in a) return settable("set", a.set.what, a.set.to);
      if ("add" in a) return settable("add", a.add.what, a.add.by);
      if ("take" in a) return settable("take", a.take.what, a.take.by);
      if ("step" in a) return { ...base, k: "step", who: target(a.step.who), dx: value(a.step.dx), dy: value(a.step.dy) };
      if ("create" in a) {
        const c = a.create;
        const at = typeof c.at === "object" && "x" in c.at ? { x: value(c.at.x), y: value(c.at.y) } : target(c.at as KitTarget);
        return {
          ...base,
          k: "create",
          type: tIdx(c.type),
          at,
          place: c.place ?? "on",
          dx: c.dx ?? 0,
          dy: c.dy ?? 0,
          ...(c.vx !== undefined ? { vx: value(c.vx) } : {}),
          ...(c.vy !== undefined ? { vy: value(c.vy) } : {}),
        };
      }
      if ("destroy" in a) return { ...base, k: "destroy", who: target(a.destroy) };
      if ("turn" in a) return { ...base, k: "turn", who: target(a.turn.who), into: tIdx(a.turn.into), ...(a.turn.seconds ? { tenths: a.turn.seconds * 10 } : {}) };
      if ("toStart" in a) return { ...base, k: "toStart", who: target(a.toStart) };
      if ("startHere" in a) return { ...base, k: "startHere", who: target(a.startHere) };
      if ("protect" in a) return { ...base, k: "protect", who: target(a.protect.who), tenths: a.protect.tenths };
      if ("sound" in a) {
        const lbl = `sfx_${a.sound.replace(/-/g, "_")}`;
        sounds.set(lbl, a.sound);
        return { ...base, k: "sound", label: lbl };
      }
      if ("send" in a) return { ...base, k: "send", bit: messages.get(a.send)! };
      if ("restartRoom" in a) return { ...base, k: "restart" };
      if ("goRoom" in a) return { ...base, k: "goRoom", room: a.goRoom - 1 };
      if ("nextRoom" in a) return { ...base, k: "nextRoom" };
      if ("resetTaken" in a) return { ...base, k: "resetTaken" };
      if ("gameOver" in a) return { ...base, k: "gameOver", won: a.gameOver === "won" };
      return { ...base, k: "run", label: `code_${a.run.replace(/-/g, "_")}` };
    });
    return {
      n,
      id: rule.id,
      label: `rule${n}`,
      trigger,
      fires,
      any,
      latch,
      pre: conds.filter((c) => !cmpReadsThing(c)),
      post: conds.filter(cmpReadsThing),
      actions,
      event: "created" in w || "destroyed" in w,
      its,
      other,
      span,
    };
  });
  if (thingLatches > 8) err(`Up to 8 rules about things can fire once per thing; this game has ${thingLatches}. Make some fire "while" instead.`);
  if (globalLatches > 16) err(`Up to 16 rules can fire once; this game has ${globalLatches}.`);

  // Rules that would start the room again forever: true for the things as placed, every frame.
  const restarts = (r: IRRule) => r.actions.some((a) => a.k === "restart" || a.k === "goRoom" || a.k === "nextRoom");
  rules.forEach((r) => {
    if (r.fires !== "while" || !restarts(r)) return;
    const spawns = placements[0]!.map((p) => ({ type: typeIndex.get(p.type)!, x: p.col * 8, y: ROOMTOP + p.row * 16 }));
    const size = (s: { type: number }) => g.types[s.type]!;
    let why: string | null = null;
    if (r.trigger.k === "tile") {
      const tr = r.trigger;
      const on = spawns.find((s) => {
        if (s.type !== tr.type) return false;
        const row = Math.floor((s.y + Math.floor(size(s).height / 2) - ROOMTOP) / 16);
        const col = Math.floor((s.x + Math.floor(size(s).width / 2)) / 8);
        return g.room.legend[g.room.rows[row]?.[col] ?? " "] === TILES[tr.tile - 1];
      });
      if (on) why = `a ${g.types[on.type]!.id} starts on a ${TILES[tr.tile - 1]} tile`;
    } else if (r.trigger.k === "touch") {
      const tr = r.trigger;
      const overlap = (a: (typeof spawns)[number], b: (typeof spawns)[number]) =>
        a !== b && a.x < b.x + size(b).width && b.x < a.x + size(a).width && a.y < b.y + size(b).height && b.y < a.y + size(a).height;
      const as = spawns.filter((s) => s.type === tr.a);
      const bs = spawns.filter((s) => s.type === tr.b);
      if (as.some((a) => bs.some((b) => overlap(a, b)))) why = `a ${g.types[tr.a]!.id} and a ${g.types[tr.b]!.id} start touching`;
    }
    if (why) err(`Rule ${r.n} starts the room again, but it's already true when the room starts (${why}), so the room would restart forever.`);
  });

  // ---- hud, flow, code ----
  const hud: IRHud[] = g.hud.map((h) => ({ show: h.show, at: h.at, name: h.show === SCORE ? "score" : varName(h.show, "The screen's numbers") }));
  if (new Set(g.hud.map((h) => h.at)).size !== g.hud.length) err("Two numbers on screen are in the same place.");
  const endShow = g.flow.end.show.map((id) => ({ label: g.counters.find((c) => c.id === id)?.label ?? id, name: id === SCORE ? "score" : varName(id, "The end screen") }));
  for (const [k, body] of Object.entries(g.code ?? {})) if (typeof body === "string" && body.length > 0 && /^\s*(main|draw)\s*$/m.test(body)) err(`Code in ${k} uses a label the runtime already has.`);

  if (errors.length) return { ok: false, errors };

  // Every value anywhere in the rules: what they read decides which per-thing tables the runtime needs.
  const values: IRValue[] = [];
  const walk = (x: unknown) => {
    if (!x || typeof x !== "object") return;
    if ("src" in x && "signed" in x) values.push(x as IRValue);
    for (const v of Object.values(x)) walk(v);
  };
  walk(rules);
  const reads = (prop: Prop) => values.some((v) => v.src.k === "prop" && v.src.prop === prop) || rules.some((r) => r.actions.some((a) => a.k === "prop" && a.prop === prop));
  if (values.some((v) => v.src.k === "facing") || reads("facing")) {
    // Facing is read somewhere: every kind that can move keeps its facing up to date.
    g.types.forEach((_, k) => facingTypes.add(k));
  }
  if (values.some((v) => v.src.k === "contact")) g.types.forEach((_, k) => contactTypes.add(k));
  const usesProtect = rules.some((r) => r.actions.some((a) => a.k === "protect"));
  const timedTurns = rules.some((r) => r.actions.some((a) => a.k === "turn" && a.tenths));
  const timerProp = reads("timer");
  const timers = timedTurns || timerProp || hasRule((w) => "timerOut" in w);
  const exits = rooms.some((r) => Object.keys(r.exits ?? {}).length > 0);
  for (const t of g.types) if (t.display?.directions && t.display.directions !== "none") facingTypes.add(typeIndex.get(t.id)!);

  const types: IRType[] = g.types.map((t, k): IRType => {
    const sets = t.display?.directions === "lr" ? 2 : t.display?.directions === "4" ? 4 : 1;
    const controlled = !!t.control;
    const moves = !!(t.control || t.steer || t.gravity || t.move.vx || t.move.vy) || rules.some((r) => r.actions.some((a) => (a.k === "prop" && (a.prop === "vx" || a.prop === "vy") && a.who.type === k) || (a.k === "create" && a.type === k && (a.vx || a.vy))));
    return {
      index: k,
      id: t.id,
      label: t.label,
      sym: typeSym(t.id),
      name: labelName(t.id, k, g.types.map((x) => x.id)),
      sprite: spriteName(t.id),
      width: t.width,
      height: t.height,
      palette: paletteIndex.get(t.palette)!,
      frames: t.frames,
      anim: t.frames.length === 2 * sets ? 2 : 1,
      dirSets: sets as 1 | 2 | 4,
      animate: t.display?.animate ?? 16,
      ...(t.control ? { control: { joystick: t.control.joystick, axes: t.control.axes, mode: t.control.mode, speed: speed(t.control.speed, "") } } : {}),
      ...(t.steer ? { steer: { target: typeIndex.get(t.steer.toward)!, away: !!t.steer.away, speed: speed(t.steer.speed, ""), every: t.steer.every } } : {}),
      ...(t.gravity ? { gravity: { amount: typeof t.gravity.amount === "number" ? t.gravity.amount : t.gravity.amount.prop, max: t.gravity.max, axis: t.gravity.axis } } : {}),
      move: {
        vx: t.move.vx,
        vy: t.move.vy,
        ...(t.move.pace ? { pace: { plus: varName(t.move.pace.plus, ""), max: t.move.pace.max } } : {}),
        wall: t.move.wall,
        edge: t.move.edge,
        sliced: !controlled && !t.move.smooth && !opts.everyFrame,
      },
      own: own[k]!,
      loop: loop(k),
      population: population(k),
      from: g.types.map((_, u) => u).filter((u) => u !== k && reach.get(u)!.has(k)),
      axes: { x: false, y: false },
      uses: {
        facing: facingTypes.has(k),
        contact: contactTypes.has(k),
        leavesRule: hasRule((w) => "leaves" in w && w.leaves === t.id),
        exits: controlled && exits,
        moves,
      },
      vars: { a: t.vars?.a?.start ?? 0, b: t.vars?.b?.start ?? 0 },
      ...(g.code?.update?.[t.id]?.trim() ? { hook: g.code.update[t.id] } : {}),
      span: { kind: "type", id: t.id },
    };
  });

  // An axis is live when anything that can be this kind can have velocity along it.
  const axisLive = (u: IRType, axis: "x" | "y") =>
    (axis === "x" ? u.move.vx : u.move.vy) !== 0 ||
    (u.control && (axis === "x" ? u.control.axes !== "ud" : u.control.axes !== "lr")) ||
    !!u.steer ||
    (u.gravity && u.gravity.axis === axis) ||
    u.move.wall === "turn" ||
    u.move.edge === "turn" ||
    rules.some((r) => r.actions.some((a) => (a.k === "prop" && a.prop === `v${axis}` && a.who.type === u.index) || (a.k === "create" && a.type === u.index && (axis === "x" ? a.vx : a.vy))));
  for (const t of types) {
    const kinds = [t, ...t.from.map((u) => types[u]!)];
    t.axes = { x: kinds.some((u) => axisLive(u, "x")), y: kinds.some((u) => axisLive(u, "y")) };
  }

  // Placements, in reading order; each kind fills its own slots from the first.
  const irRooms: IRRoom[] = rooms.map((room, r) => {
    const fill = new Map<number, number>();
    const spawns = placements[r]!.map((p, place): IRSpawn => {
      const type = typeIndex.get(p.type)!;
      const slot = own[type]![0] + (fill.get(type) ?? 0);
      fill.set(type, (fill.get(type) ?? 0) + 1);
      return { type, x: p.col * 8, y: ROOMTOP + p.row * 16, slot, place };
    });
    const rows = room.rows.map((x) => x.replace(/\./g, " "));
    return {
      index: r,
      rows,
      tiles: rows.flatMap((x) => [...x].map((ch) => TILES.indexOf(g.room.legend[ch] as never) + 1)),
      spawns,
      exits: Object.fromEntries(Object.entries(room.exits ?? {}).map(([s, to]) => [s, to - 1])),
      span: { kind: "room", id: `room-${r + 1}` },
    };
  });

  const walls = irRooms.some((r) => r.tiles.includes(1));
  const ir: IR = {
    title: g.title,
    types,
    rooms: irRooms,
    counters: g.counters.map((c) => ({ id: c.id, label: c.label, name: counterName(c.id), start: c.start, keep: c.keep ?? "game", span: { kind: "counter", id: c.id } })),
    rules,
    hud,
    messages: g.messages,
    palettes: g.palettes,
    background: g.background,
    textPalette: paletteIndex.get(g.textPalette)!,
    wallPalette: paletteIndex.get(g.wallPalette)!,
    text: g.text,
    flow: {
      title: g.flow.title,
      attract: g.flow.attract ? { after: g.flow.attract.after, input: g.flow.attract.input?.length ? g.flow.attract.input : DEFAULT_DEMO } : null,
      end: { show: endShow, after: g.flow.end.after },
      remember: g.flow.remember,
    },
    sounds: [...sounds].map(([lbl, id]) => ({ label: lbl, id })),
    code: {
      init: g.code?.init ?? "",
      startroom: g.code?.startroom ?? "",
      frame: g.code?.frame ?? "",
      draw: g.code?.draw ?? "",
      routines: (g.code?.routines ?? []).map((r) => ({ label: `code_${r.label.replace(/-/g, "_")}`, body: r.body })),
      cost: g.code?.cost ?? 10,
    },
    features: {
      walls,
      tileMap: walls || rules.some((r) => r.trigger.k === "tile"),
      timers,
      protect: usesProtect,
      timedTurns,
      facing: facingTypes.size > 0,
      contact: contactTypes.size > 0,
      latchThings: thingLatches > 0,
      globalLatches,
      everyCounters,
      messages: g.messages.length > 0,
      rooms: irRooms.length,
      exits,
      remember: g.flow.remember,
      vars: reads("a") || reads("b") || g.types.some((t) => t.vars || (t.gravity && typeof t.gravity.amount === "object")),
      place: g.flow.remember,
      joy2: false,
    },
  };
  return { ok: true, ir, game: g };
}

/** The kinds a value reads, for "it"/"other". */
function readsOf(v: IRValue, its: number[], other: number | null): (number | null)[] {
  if (!("of" in v.src)) return [];
  return v.src.of === "it" ? its : v.src.of === "other" ? [other] : [];
}
