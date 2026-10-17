// Editing operations on kit games. Each mutates a draft (they run inside the
// store's edit recipes) and keeps the game consistent: room cells, rules and
// parts never point at things or counters that no longer exist.
//
// The editor offers the simple words first: a thing moves like a preset
// ("Chases the player"), the player shoots something, a thing drops
// something. Underneath those are the kit's movement parts and rules, so these
// helpers translate: a preset becomes parts, shooting becomes a "button
// pressed" rule, dropping an "every frame" rule.

import { BEHAVIOURS, PLAYER_BEHAVIOURS, isControlled, presetOf, presetParts, presetRule, type Behaviour } from "./parts.ts";
import { loseLifeActions } from "./migrations.ts";
import {
  LEVEL,
  LIVES,
  MAX_COUNTERS,
  MAX_MESSAGES,
  MAX_OBJECTS,
  ROOM_COLS,
  ROOM_ROWS,
  SCORE,
  SPEED_STEPS,
  TILES,
  type KitAction,
  type KitCompare,
  type KitDisplay,
  type KitGame,
  type KitRule,
  type KitTarget,
  type KitType,
  type KitValue,
  type Tile,
} from "./schema.ts";

export { BEHAVIOURS, PLAYER_BEHAVIOURS, type Behaviour };

export const BEHAVIOUR_LABELS: Record<Behaviour, string> = {
  still: "Stays put",
  "player-lr": "Player: moves left and right",
  "player-4way": "Player: moves in 4 directions",
  "player-8way": "Player: moves in 8 directions",
  "patrol-h": "Walks left and right",
  "patrol-v": "Walks up and down",
  bounce: "Bounces around",
  chase: "Chases the player",
  march: "Marches in formation",
  fall: "Falls from the sky",
  "projectile-up": "Flies up (a shot)",
  "projectile-down": "Falls fast (a bomb)",
  flee: "Runs away from the player",
};
/** How a thing moves, in words: its preset, or "its own way" when its parts aren't a preset. */
export const movementLabel = (t: KitType) => {
  const p = presetOf(t);
  return p ? BEHAVIOUR_LABELS[p.behaviour] : "Moves its own way";
};

export const SPEED_LABELS = ["", "Slow", "Medium", "Fast", "Very fast", "Faster", "Fastest"];

export type Brush = Tile | "erase" | string;

const LEGEND_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** A player is anything a joystick moves. */
export const isPlayer = (t: KitType) => isControlled(t);

/** A fresh stable id for a rule (`r-…`) or action (`a-…`), not used anywhere in the game. */
export function newId(g: KitGame, prefix: "r" | "a"): string {
  const used = new Set(g.rules.flatMap((r) => [r.id, ...r.then.map((a) => a.id)]));
  for (;;) {
    const id = `${prefix}-${Math.floor(Math.random() * 0x100000).toString(36)}`;
    if (!used.has(id)) return id;
  }
}
/** An action with a fresh id. */
export const act = (g: KitGame, a: Record<string, unknown>): KitAction => ({ id: newId(g, "a"), ...a }) as KitAction;

/**
 * The rule "Add rule" makes: one that doesn't fight the rules already there.
 * It's the first pair of things no "touches" rule mentions yet, player first,
 * scoring 10 points. When every pair has a rule, it's a timer that plays a sound.
 */
export function newRule(g: KitGame): KitRule {
  const touched = new Set(g.rules.flatMap((r) => ("touch" in r.when ? [`${r.when.touch[0]} ${r.when.touch[1]}`, `${r.when.touch[1]} ${r.when.touch[0]}`] : [])));
  const player = g.types.find(isPlayer) ?? g.types[0];
  const order = player ? [player, ...g.types.filter((t) => t !== player)] : [];
  for (const a of order)
    for (const b of order)
      if (a !== b && !touched.has(`${a.id} ${b.id}`))
        return { id: newId(g, "r"), when: { touch: [a.id, b.id] }, then: [act(g, { add: { what: { counter: SCORE }, by: 10 } })] };
  return { id: newId(g, "r"), when: { after: 30 }, then: [act(g, { sound: "blip" })] };
}

/** The room character that places `id`, assigning a free one if needed. */
export function legendChar(g: KitGame, id: string): string {
  const existing = Object.entries(g.room.legend).find(([, v]) => v === id)?.[0];
  if (existing) return existing;
  const free = [...LEGEND_CHARS].find((c) => !(c in g.room.legend))!;
  g.room.legend[free] = id;
  return free;
}

const TILE_CHAR: Record<Tile, string> = { wall: "#", hazard: "~", goal: "*" };

function tileChar(g: KitGame, tile: Tile): string {
  const existing = Object.entries(g.room.legend).find(([, v]) => v === tile)?.[0];
  if (existing) return existing;
  g.room.legend[TILE_CHAR[tile]] = tile;
  return TILE_CHAR[tile];
}

/** What a cell of the first room holds: "wall", a thing's id, or null when empty. */
export function cellAt(g: KitGame, col: number, row: number): string | null {
  const ch = g.room.rows[row]?.[col];
  if (!ch || ch === " " || ch === ".") return null;
  return g.room.legend[ch] ?? null;
}

function setChar(g: KitGame, col: number, row: number, ch: string) {
  const r = g.room.rows[row]!;
  g.room.rows[row] = r.slice(0, col) + ch + r.slice(col + 1);
}

export function paintCell(g: KitGame, col: number, row: number, brush: Brush) {
  if (col < 0 || row < 0 || col >= ROOM_COLS || row >= ROOM_ROWS) return;
  if (brush === "erase") return setChar(g, col, row, " ");
  if ((TILES as readonly string[]).includes(brush)) return setChar(g, col, row, tileChar(g, brush as Tile));
  const type = g.types.find((t) => t.id === brush);
  if (!type) return;
  const ch = legendChar(g, brush);
  if (isPlayer(type)) {
    // There's one player in the room: painting it moves it.
    g.room.rows = g.room.rows.map((r) => r.replaceAll(ch, " "));
  }
  setChar(g, col, row, ch);
}

/** Every thing placed in the first room: its type index and starting cell. */
export function placements(g: KitGame): { type: number; col: number; row: number }[] {
  const index = new Map(g.types.map((t, i) => [t.id, i]));
  const out: { type: number; col: number; row: number }[] = [];
  g.room.rows.forEach((r, row) =>
    [...r].forEach((ch, col) => {
      const id = g.room.legend[ch];
      if (id && !(TILES as readonly string[]).includes(id) && index.has(id)) out.push({ type: index.get(id)!, col, row });
    }),
  );
  return out;
}

function defaultSprite(w: number, h: number): string[] {
  // A simple diamond, so a new thing is visible right away.
  return Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => {
      const dx = Math.abs(x - (w - 1) / 2) / (w / 2);
      const dy = Math.abs(y - (h - 1) / 2) / (h / 2);
      return dx + dy < 0.75 ? "2" : dx + dy < 1 ? "1" : "0";
    }).join(""),
  );
}

/** Adds a new kind of thing and returns its id. */
export function addThing(g: KitGame, behaviour: Behaviour = "still"): string {
  let n = g.types.length + 1;
  while (g.types.some((t) => t.id === `thing-${n}`)) n++;
  const id = `thing-${n}`;
  let palette = g.palettes.find((p) => p.id !== g.textPalette && p.id !== g.wallPalette)?.id ?? g.palettes[0]!.id;
  if (g.palettes.length < 8) {
    palette = id;
    g.palettes.push({ id, colors: ["$46", "$0F", "$86"] });
  }
  g.types.push({ id, label: `Thing ${n}`, width: 8, height: 8, frames: [defaultSprite(8, 8)], palette, ...presetParts(behaviour, 2, playerOf(g)) } as KitType);
  return id;
}

// ---- what mentions what ----

const valueMentions = (v: KitValue, id: string) => typeof v === "object" && "count" in v && v.count === id;
const compareMentions = (c: KitCompare, id: string) => valueMentions(c.a, id) || valueMentions(c.b, id);
const targetMentions = (t: KitTarget, id: string) =>
  typeof t === "object" && (("every" in t && (t.every === id || (!!t.where && compareMentions(t.where, id)))) || ("nearest" in t && t.nearest === id) || ("random" in t && t.random === id));
const triggerMentions = (r: KitRule, id: string): boolean => {
  const w = r.when;
  return (
    ("touch" in w && w.touch.includes(id)) ||
    ("onTile" in w && w.onTile[0] === id) ||
    ("edge" in w && w.edge[0] === id) ||
    ("wall" in w && w.wall[0] === id) ||
    ("leaves" in w && w.leaves === id) ||
    ("timerOut" in w && w.timerOut === id) ||
    ("created" in w && w.created === id) ||
    ("destroyed" in w && w.destroyed === id) ||
    ("test" in w && compareMentions(w.test, id)) ||
    (r.if ?? []).some((c) => compareMentions(c, id))
  );
};
/** True when an action names this kind of thing (as a target, what to create or turn into, or in a value). */
export function actionMentions(a: KitAction, id: string): boolean {
  const s = JSON.stringify(a);
  if (!s.includes(`"${id}"`)) return false;
  if ("create" in a && a.create.type === id) return true;
  if ("turn" in a && a.turn.into === id) return true;
  const targets: KitTarget[] = [];
  if ("destroy" in a) targets.push(a.destroy);
  if ("toStart" in a) targets.push(a.toStart);
  if ("startHere" in a) targets.push(a.startHere);
  if ("turn" in a) targets.push(a.turn.who);
  if ("protect" in a) targets.push(a.protect.who);
  if ("step" in a) targets.push(a.step.who);
  if ("create" in a && typeof a.create.at === "object" && !("x" in a.create.at)) targets.push(a.create.at as KitTarget);
  for (const k of ["set", "add", "take"] as const) {
    if (k in a) {
      const s2 = (a as unknown as Record<string, { what: { prop?: string; of?: KitTarget } }>)[k]!;
      if (s2.what.of) targets.push(s2.what.of);
    }
  }
  return targets.some((t) => targetMentions(t, id)) || s.includes(`"count":"${id}"`);
}

/** Drops rules about `id` (in their trigger or conditions), and actions that name it. */
function forgetThing(g: KitGame, id: string) {
  g.rules = g.rules.filter((r) => !triggerMentions(r, id));
  for (const r of g.rules) r.then = r.then.filter((a) => !actionMentions(a, id));
  g.rules = g.rules.filter((r) => r.then.length > 0);
  for (const t of g.types) if (t.steer?.toward === id) delete t.steer;
}

export function removeThing(g: KitGame, id: string) {
  const ch = Object.entries(g.room.legend).find(([, v]) => v === id)?.[0];
  if (ch) {
    g.room.rows = g.room.rows.map((r) => r.replaceAll(ch, " "));
    g.rooms = g.rooms.map((room) => ({ ...room, rows: room.rows.map((r) => r.replaceAll(ch, " ")) }));
    delete g.room.legend[ch];
  }
  forgetThing(g, id);
  g.types = g.types.filter((t) => t.id !== id);
  if (g.code?.update) delete g.code.update[id];
  // Drop the thing's own palette if nothing else uses it.
  const used = new Set([g.textPalette, g.wallPalette, ...g.types.map((t) => t.palette)]);
  g.palettes = g.palettes.filter((p) => used.has(p.id));
}

/** Changes a thing's size, keeping its drawing anchored at the top-left. */
export function resizeThing(g: KitGame, id: string, width: number, height: number) {
  const t = g.types.find((x) => x.id === id);
  if (!t) return;
  t.frames = t.frames.map((f) => Array.from({ length: height }, (_, y) => (f[y] ?? "").padEnd(width, "0").slice(0, width)));
  t.width = width;
  t.height = height;
}

export function setAnimated(g: KitGame, id: string, animated: boolean) {
  const t = g.types.find((x) => x.id === id);
  if (!t) return;
  if (t.frames.length !== directionSets(t.display?.directions) && !isAnimated(t)) return;
  // Each direction set gets a second frame (a copy to draw on), or loses it.
  if (animated && !isAnimated(t)) t.frames = t.frames.flatMap((f) => [f, [...f]]);
  if (!animated && isAnimated(t)) t.frames = t.frames.filter((_, n) => n % 2 === 0);
  if (animated) t.display = { ...t.display, animate: t.display?.animate ?? 16 };
}

// ---- movement presets ----

/** The player chasers chase: the first kind a joystick moves. */
export const playerOf = (g: KitGame) => g.types.find(isPlayer)?.id ?? null;

/** The rule that makes a march or a fall work for this kind, if it has one. */
function companionRule(g: KitGame, t: KitType): number {
  return g.rules.findIndex((r) => {
    const w = r.when;
    if ("leaves" in w && w.leaves === t.id && r.then.length === 2) return true;
    return "edge" in w && w.edge[0] === t.id && w.edge[1] === "sides" && !!r.any;
  });
}

export function setBehaviour(g: KitGame, id: string, behaviour: Behaviour, speed?: number) {
  const t = g.types.find((x) => x.id === id);
  if (!t) return;
  const before = presetOf(t)?.behaviour ?? null;
  const wasPlayer = isPlayer(t);
  const pace = t.move.pace ?? (t.steer?.speed.plus ? { plus: t.steer.speed.plus, max: t.steer.speed.max ?? 4 } : undefined);
  const parts = presetParts(behaviour, speed ?? presetOf(t)?.speed ?? 2, playerOf(g) === id ? null : playerOf(g), PLAYER_BEHAVIOURS.includes(behaviour) ? undefined : pace);
  delete t.control;
  delete t.steer;
  delete t.gravity;
  Object.assign(t, parts);
  // The march turns and the fall comes back by rules; keep them with the preset.
  if (before !== behaviour) {
    const old = companionRule(g, t);
    if (old >= 0 && (before === "march" || before === "fall")) g.rules.splice(old, 1);
    const rule = presetRule(behaviour, t, newId(g, "r"));
    if (rule) g.rules.unshift({ ...rule, then: rule.then.map((a) => ({ ...a, id: newId(g, "a") })) });
  }
  if (!isPlayer(t)) removeShooting(g, id);
  if (isPlayer(t) && !wasPlayer) {
    // Becoming the player: any other player stops being one, and one is placed.
    for (const other of g.types) {
      if (other !== t && isPlayer(other)) {
        Object.assign(other, { control: undefined, ...presetParts("still", 2, null) });
        delete other.control;
        removeShooting(g, other.id);
      }
    }
    for (const other of g.types) if (other.steer && other.steer.toward !== id && !g.types.some((x) => x.id === other.steer!.toward && isPlayer(x))) other.steer.toward = id;
    const ch = Object.entries(g.room.legend).find(([, v]) => v === id)?.[0];
    if (ch) {
      let kept = false;
      g.room.rows = g.room.rows.map((r) => [...r].map((c) => (c === ch ? (kept ? " " : ((kept = true), c)) : c)).join(""));
    }
  }
}

/** Changes a thing's speed (1-6), keeping its preset. Custom parts are left alone. */
export function setSpeed(g: KitGame, id: string, speed: number) {
  const t = g.types.find((x) => x.id === id);
  const p = t && presetOf(t);
  if (!t || !p) return;
  setBehaviour(g, id, p.behaviour, speed);
}

/**
 * "Make this my player": the thing's drawing, name and size become the
 * player's, and the old player's look moves to the thing. Rules, the room and
 * how everything moves stay as they were, so the game still plays the same.
 * Returns the id now wearing the thing's look (the player), or null.
 */
export function makePlayer(g: KitGame, id: string): string | null {
  const t = g.types.find((x) => x.id === id);
  if (!t || isPlayer(t)) return null;
  const p = g.types.find(isPlayer);
  if (!p) {
    setBehaviour(g, id, "player-4way");
    return id;
  }
  const look = (x: KitType) => ({ label: x.label, palette: x.palette, width: x.width, height: x.height, frames: x.frames, display: x.display });
  const [a, b] = [look(p), look(t)];
  Object.assign(p, b);
  Object.assign(t, a);
  return p.id;
}

// ---- custom parts (the "Customise" editor) ----

export type Mover = "none" | "joystick" | "steer";
/** What drives a thing besides its own velocity: a joystick, steering toward a kind, or nothing. */
export const moverOf = (t: KitType): Mover => (t.control ? "joystick" : t.steer ? "steer" : "none");

/** Switches what drives a thing. A joystick and steering can't both move it, so one replaces the other. */
export function setMover(g: KitGame, id: string, mover: Mover) {
  const t = g.types.find((x) => x.id === id);
  if (!t || moverOf(t) === mover) return;
  const speed = t.control?.speed ?? t.steer?.speed ?? { step: 2 };
  delete t.control;
  delete t.steer;
  if (mover === "joystick") t.control = { joystick: 1, axes: "4way", mode: "direct", speed: { step: speed.step } };
  if (mover === "steer") {
    const toward = playerOf(g) ?? g.types.find((x) => x.id !== id)?.id ?? id;
    t.steer = { toward, speed: { step: speed.step }, every: 1 };
  }
  if (mover !== "joystick") removeShooting(g, id);
}

/**
 * Changes a thing's velocity and reactions. A thing that speeds up with a
 * counter needs its speeds to be speed steps, so the pace goes when they aren't.
 */
export function setMove(g: KitGame, id: string, patch: Partial<KitType["move"]>) {
  const t = g.types.find((x) => x.id === id);
  if (!t) return;
  Object.assign(t.move, patch);
  if (patch.smooth === false) delete t.move.smooth;
  const steps = SPEED_STEPS as readonly number[];
  if (t.move.pace && [t.move.vx, t.move.vy].some((v) => v && !steps.includes(Math.abs(v)))) delete t.move.pace;
}

/** Gravity along an axis ("down" pulls toward the bottom), or none. */
export const GRAVITY_WAYS = ["none", "down", "up", "right", "left"] as const;
export type GravityWay = (typeof GRAVITY_WAYS)[number];
export function gravityWay(t: KitType): GravityWay {
  const gr = t.gravity;
  if (!gr) return "none";
  const negative = typeof gr.amount === "number" && gr.amount < 0;
  return gr.axis === "x" ? (negative ? "left" : "right") : negative ? "up" : "down";
}
export function setGravity(g: KitGame, id: string, way: GravityWay, strength?: number | "a" | "b", max?: number) {
  const t = g.types.find((x) => x.id === id);
  if (!t) return;
  if (way === "none") return void delete t.gravity;
  const old = t.gravity?.amount;
  const s = strength ?? (typeof old === "object" ? old.prop : Math.abs(old ?? 2) || 2);
  const sign = way === "up" || way === "left" ? -1 : 1;
  t.gravity = {
    amount: typeof s === "number" ? sign * Math.max(1, Math.min(32, s)) : { prop: s },
    max: Math.max(1, Math.min(112, max ?? t.gravity?.max ?? 48)),
    axis: way === "left" || way === "right" ? "x" : "y",
  };
}

const directionSets = (d: KitDisplay["directions"]) => (d === "lr" ? 2 : d === "4" ? 4 : 1);
/** Frames ordered by direction set, then animation frame (as the runtime reads them). */
const isAnimated = (t: KitType) => t.frames.length === 2 * directionSets(t.display?.directions);

/** Changes how many direction sets a thing draws, keeping its drawings: new sets start as copies of the first. */
export function setDirections(g: KitGame, id: string, directions: NonNullable<KitDisplay["directions"]>) {
  const t = g.types.find((x) => x.id === id);
  if (!t) return;
  const from = directionSets(t.display?.directions);
  const to = directionSets(directions);
  const anim = isAnimated(t) ? 2 : 1;
  const frame = (set: number, k: number) => [...t.frames[Math.min(set, from - 1) * anim + k]!];
  t.frames = Array.from({ length: to * anim }, (_, n) => frame(Math.floor(n / anim), n % anim));
  t.display = { ...t.display, directions };
  if (directions === "none") delete t.display.directions;
  if (!Object.keys(t.display).length) delete t.display;
}

/** How fast a 2-frame animation changes (every 4, 8, 16 or 32 frames, or while moving). */
export function setAnimateRate(g: KitGame, id: string, rate: NonNullable<KitDisplay["animate"]>) {
  const t = g.types.find((x) => x.id === id);
  if (t) t.display = { ...t.display, animate: rate };
}

/** Names (and starts) one of a thing's two variables, or removes it with null. */
export function setVar(g: KitGame, id: string, which: "a" | "b", v: { name: string; start: number } | null) {
  const t = g.types.find((x) => x.id === id);
  if (!t) return;
  if (v) t.vars = { ...t.vars, [which]: { name: v.name.slice(0, 12), start: Math.max(0, Math.min(255, Math.round(v.start))) } };
  else if (t.vars) {
    delete t.vars[which];
    if (!t.vars.a && !t.vars.b) delete t.vars;
  }
}

/** The most of a kind at once (1-24), or null for the default. */
export function setCap(g: KitGame, id: string, cap: number | null) {
  const t = g.types.find((x) => x.id === id);
  if (!t) return;
  if (cap === null) delete t.cap;
  else t.cap = Math.max(1, Math.min(MAX_OBJECTS, Math.round(cap)));
}

// ---- shooting and dropping, as rules ----

/** "When fire is pressed: create X above it" (it: each player; one rule serves them all). */
const isShootRule = (r: KitRule, _id: string) =>
  "button" in r.when && r.when.button.joy === 1 && r.when.button.button === 1 && !r.when.button.released && r.then.some((a) => "create" in a && a.create.at === "it" && a.create.place === "above");

/** What the player shoots (the kind its fire button creates), if anything. */
export function shootsOf(g: KitGame, id: string): string | null {
  const t = g.types.find((x) => x.id === id);
  if (!t || !isPlayer(t)) return null;
  const r = g.rules.find((x) => isShootRule(x, id));
  const c = r?.then.find((a) => "create" in a);
  return c && "create" in c ? c.create.type : null;
}

function removeShooting(g: KitGame, id: string) {
  if (!g.types.some((t) => t.id === id && isPlayer(t)) || g.types.filter(isPlayer).length <= 1) g.rules = g.rules.filter((r) => !isShootRule(r, id));
}

/** Fire shoots `shot` (one on screen at a time), or nothing. */
export function setShoots(g: KitGame, id: string, shot: string | null) {
  const existing = g.rules.findIndex((x) => isShootRule(x, id));
  if (!shot) {
    if (existing >= 0) g.rules.splice(existing, 1);
    return;
  }
  if (existing >= 0) {
    const r = g.rules[existing]!;
    for (const a of r.then) if ("create" in a) a.create.type = shot;
    r.if = [{ a: { count: shot }, op: "eq", b: 0 }];
    return;
  }
  g.rules.unshift({
    id: newId(g, "r"),
    when: { button: { joy: 1, button: 1 } },
    if: [{ a: { count: shot }, op: "eq", b: 0 }],
    then: [act(g, { create: { type: shot, at: "it", place: "above" } })],
  });
}

/** The sound the fire button's shot plays, if any (an action in the shooting rule). */
export function shootSoundOf(g: KitGame): string | null {
  const r = g.rules.find((x) => g.types.some((t) => isShootRule(x, t.id)));
  const a = r?.then.find((x) => "sound" in x);
  return a && "sound" in a ? a.sound : null;
}
export function setShootSound(g: KitGame, sound: string | null) {
  const r = g.rules.find((x) => g.types.some((t) => isShootRule(x, t.id)));
  if (!r) return;
  r.then = r.then.filter((a) => !("sound" in a));
  if (sound) r.then.push(act(g, { sound }));
}

const isDropRule = (r: KitRule, id: string) =>
  "every" in r.when && r.when.every === 1 && !!r.when.frames && r.then.length === 1 && "create" in r.then[0]! && JSON.stringify(r.then[0].create.at) === JSON.stringify({ random: id });

/** What a thing drops, and how often (1-40, as the editor's slider), if anything. */
export function dropsOf(g: KitGame, id: string): { type: string; chance: number } | null {
  const r = g.rules.find((x) => isDropRule(x, id));
  if (!r) return null;
  const a = r.then[0]!;
  const roll = r.if?.find((c) => typeof c.a === "object" && "random" in c.a);
  const n = Math.max(1, placements(g).filter((p) => g.types[p.type]?.id === id).length);
  const chance = typeof roll?.b === "number" ? Math.max(1, Math.min(40, Math.round(roll.b / n) - 1)) : 4;
  return "create" in a ? { type: a.create.type, chance } : null;
}

/** The thing drops `drop` below it at random, one at a time; `chance` 1-40 per dropper per frame (out of 256). */
export function setDrops(g: KitGame, id: string, drop: { type: string; chance: number } | null) {
  const existing = g.rules.findIndex((x) => isDropRule(x, id));
  if (!drop) {
    if (existing >= 0) g.rules.splice(existing, 1);
    return;
  }
  const n = Math.max(1, placements(g).filter((p) => g.types[p.type]?.id === id).length);
  const rule: KitRule = {
    id: existing >= 0 ? g.rules[existing]!.id : newId(g, "r"),
    when: { every: 1, frames: true },
    if: [
      { a: { random: 255 }, op: "lt", b: Math.min(255, (drop.chance + 1) * n) },
      { a: { count: drop.type }, op: "eq", b: 0 },
    ],
    then: [{ id: existing >= 0 ? g.rules[existing]!.then[0]!.id : newId(g, "a"), create: { type: drop.type, at: { random: id }, place: "below" } }],
  };
  if (existing >= 0) g.rules[existing] = rule;
  else g.rules.unshift(rule);
}

/** Which kind's rule creates this one ("Appears when the Ship shoots"), if any. */
export function launchedBy(g: KitGame, id: string): { by: string; how: "shoots" | "drops" | "rule" } | null {
  for (const t of g.types) {
    if (shootsOf(g, t.id) === id) return { by: t.id, how: "shoots" };
    if (dropsOf(g, t.id)?.type === id) return { by: t.id, how: "drops" };
  }
  const r = g.rules.find((x) => x.then.some((a) => "create" in a && a.create.type === id));
  return r ? { by: "", how: "rule" } : null;
}

// ---- lives and counters ----

/** The "lives" counter's start, if the game keeps lives. */
export const livesOf = (g: KitGame) => g.counters.find((c) => c.id === LIVES)?.start ?? null;
export function setLives(g: KitGame, n: number) {
  const c = g.counters.find((x) => x.id === LIVES);
  if (c) c.start = n;
}

/** Actions for "lose a life": take one, the players back to start, protected for a moment. */
export const loseLife = (g: KitGame): KitAction[] => loseLifeActions(newId(g, "a"), g.types.filter(isPlayer).map((t) => t.id));

/** Adds a counter (keys, coins, combo…) and returns its id. */
export function addCounter(g: KitGame): string | null {
  if (g.counters.length >= MAX_COUNTERS) return null;
  // Numbered among the counters the Game tab lists (lives has its own slider).
  let n = g.counters.filter((c) => c.id !== LIVES).length + 1;
  while (g.counters.some((c) => c.id === `counter-${n}`)) n++;
  const id = `counter-${n}`;
  g.counters.push({ id, label: `Counter ${n}`, start: 0 });
  return id;
}

const valueUses = (v: KitValue, id: string) => typeof v === "object" && "counter" in v && v.counter === id;
const compareUses = (c: KitCompare, id: string) => valueUses(c.a, id) || valueUses(c.b, id);
const actionUses = (a: KitAction, id: string) => {
  for (const k of ["set", "add", "take"] as const) {
    if (k in a) {
      const s = (a as unknown as Record<string, { what: { counter?: string } }>)[k]!;
      if (s.what.counter === id) return true;
    }
  }
  return JSON.stringify(a).includes(`"counter":"${id}"`) || JSON.stringify(a).includes(`"plus":"${id}"`);
};

/** Removes a counter along with the conditions, actions, rules and parts that use it. */
export function removeCounter(g: KitGame, id: string) {
  g.counters = g.counters.filter((c) => c.id !== id);
  g.hud = g.hud.filter((h) => h.show !== id);
  g.flow.end.show = g.flow.end.show.filter((x) => x !== id);
  g.rules = g.rules.filter((r) => !("test" in r.when && compareUses(r.when.test, id)));
  for (const r of g.rules) {
    r.then = r.then.filter((a) => !actionUses(a, id));
    if (r.if) {
      r.if = r.if.filter((c) => !compareUses(c, id));
      if (r.if.length === 0) delete r.if;
    }
  }
  g.rules = g.rules.filter((r) => r.then.length > 0);
  for (const t of g.types) {
    if (t.move.pace?.plus === id) delete t.move.pace;
    for (const sp of [t.control?.speed, t.steer?.speed]) if (sp?.plus === id) (delete sp.plus, delete sp.max);
  }
}

const HUD_FREE = ["middle-right", "middle", "left", "right"] as const;
/** Whether a counter is one of the numbers on screen. */
export const shown = (g: KitGame, id: string) => g.hud.some((h) => h.show === id);
/** Shows a counter on screen (in a free place, up to four numbers), or takes it off. */
export function showCounter(g: KitGame, id: string, show: boolean) {
  if (!show) {
    g.hud = g.hud.filter((h) => h.show !== id);
    return;
  }
  if (shown(g, id)) return;
  const at = HUD_FREE.find((p) => !g.hud.some((h) => h.at === p));
  if (at) g.hud.push({ show: id, at });
}

/** "Go to the next level": one more level, and the room again (adds the level counter if needed). */
export function nextLevel(g: KitGame): KitAction[] {
  if (!g.counters.some((c) => c.id === LEVEL) && g.counters.length < MAX_COUNTERS) g.counters.push({ id: LEVEL, label: "Level", start: 1 });
  return [act(g, { add: { what: { counter: LEVEL }, by: 1 } }), act(g, { restartRoom: true })];
}

/** Adds a message rules can send and listen for (message-1, message-2…) and returns it; when there's no room, the first one. */
export function newMessage(g: KitGame): string {
  if (g.messages.length >= MAX_MESSAGES) return g.messages[0]!;
  let n = g.messages.length + 1;
  while (g.messages.includes(`message-${n}`)) n++;
  g.messages.push(`message-${n}`);
  return `message-${n}`;
}

/** Moves a rule to another place in the list: rules run in order, top first. */
export function moveRule(g: KitGame, from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= g.rules.length || to >= g.rules.length) return;
  const [rule] = g.rules.splice(from, 1);
  g.rules.splice(to, 0, rule!);
}

export { SCORE };
