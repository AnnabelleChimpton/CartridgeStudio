// Rules for kit games: "When <trigger>, only if <conditions>, <actions>",
// over the game's own things and counters. Only valid combinations are
// offered (e.g. "the second thing" only exists when two things touch), and
// the rarer parts ("only if", "for N seconds") appear when asked for.
//
// Targets ("the Cat", "every Ghost whose x is less than 80", "the nearest
// Rock", "a random Bomb") and values (a number, a counter, a thing's
// property, how many there are, a random number, the joystick, facing, with
// modifiers) have pickers of their own. The editor recognises the shapes it
// can edit; the rest (rooms, "any", button 2 and the like) show as their
// sentence, still in the game and movable. Lists are keyed on the rules'
// stable ids, so focus and drag state stay with the right rule.

import { useEffect, useId, useRef, useState } from "react";
import { SOUND_LIBRARY } from "../project/templates.ts";
import { act, isPlayer, loseLife, moveRule, newId, newMessage, nextLevel } from "./edit.ts";
import { triggerThing } from "./ir.ts";
import {
  LEVEL,
  MAX_MESSAGES,
  PROPS,
  SCORE,
  SECONDS,
  SIDES,
  type KitAction,
  type KitCompare,
  type KitGame,
  type KitRule,
  type KitSettable,
  type KitTarget,
  type KitTrigger,
  type KitValue,
  type Prop,
  type Whose,
} from "./schema.ts";
import { ruleSentence } from "./sentence.ts";
import { useKitStore } from "./store.ts";

type TriggerKind =
  | "touch"
  | "allGone"
  | "reachesBottom"
  | "leaves"
  | "onHazard"
  | "onGoal"
  | "created"
  | "destroyed"
  | "timerOut"
  | "fire"
  | "timer"
  | "every"
  | "reaches"
  | "counterIs"
  | "compare"
  | "message"
  | "roomStart";
type ActionKind =
  | "remove"
  | "respawn"
  | "score"
  | "add"
  | "take"
  | "set"
  | "turn"
  | "turnAll"
  | "respawnAll"
  | "protect"
  | "create"
  | "step"
  | "send"
  | "loseLife"
  | "win"
  | "lose"
  | "restartRoom"
  | "nextLevel"
  | "sound";
type Who = "it" | "other";
type KitCreate = Extract<KitAction, { create: unknown }>["create"];
type Op = KitCompare["op"];

const TRIGGERS: { kind: TriggerKind; label: string }[] = [
  { kind: "touch", label: "touches" },
  { kind: "allGone", label: "are all gone" },
  { kind: "reachesBottom", label: "reaches the bottom" },
  { kind: "leaves", label: "leaves the screen" },
  { kind: "onHazard", label: "is on spikes" },
  { kind: "onGoal", label: "is on a goal" },
  { kind: "created", label: "appears" },
  { kind: "destroyed", label: "is removed" },
  { kind: "timerOut", label: "timer runs out" },
  { kind: "fire", label: "fire is pressed" },
  { kind: "timer", label: "seconds have passed" },
  { kind: "every", label: "every" },
  { kind: "reaches", label: "reaches" },
  { kind: "counterIs", label: "is" },
  { kind: "compare", label: "this is true:" },
  { kind: "message", label: "the message" },
  { kind: "roomStart", label: "the room starts" },
];
/** Triggers that name one thing first ("When the Rock …"). */
const ONE_THING: TriggerKind[] = ["allGone", "reachesBottom", "leaves", "onHazard", "onGoal", "created", "destroyed", "timerOut"];

// Lower case: they're read mid-sentence ("When …, remove the yarn ball").
const ACTION_LABELS: Record<ActionKind, string> = {
  remove: "remove",
  respawn: "send back to start",
  score: "add points",
  add: "add",
  take: "take away",
  set: "set",
  turn: "turn",
  turnAll: "turn every",
  respawnAll: "send every … back to start",
  protect: "protect",
  create: "create",
  step: "step",
  send: "send the message",
  loseLife: "lose a life",
  win: "win the game",
  lose: "lose the game",
  restartRoom: "start the room again",
  nextLevel: "go to the next level",
  sound: "play a sound",
};
/** Menu choices that add several actions at once; they're not kinds an action can be. */
const GROUPS: ActionKind[] = ["loseLife", "nextLevel"];

const OPS: { op: Op; label: string }[] = [
  { op: "eq", label: "is" },
  { op: "ne", label: "isn't" },
  { op: "gte", label: "is at least" },
  { op: "lte", label: "is at most" },
  { op: "gt", label: "is more than" },
  { op: "lt", label: "is less than" },
];
const PLACES = [
  { place: "above", label: "above" },
  { place: "below", label: "below" },
  { place: "centre", label: "in the middle of" },
  { place: "on", label: "at" },
] as const;

const POINTS = [10, 20, 50, 100, 200, 300, 500];
const FIRES = [
  { fires: "while", label: "the whole time" },
  { fires: "once", label: "once each time" },
] as const;
const PROP_LABELS: Record<Prop, string> = { x: "x", y: "y", vx: "speed across", vy: "speed down", facing: "facing (0 to 7)", a: "a", b: "b", timer: "timer" };
const WALL_SIDE: Record<(typeof SIDES)[number], string> = { left: "on the left", right: "on the right", top: "above", bottom: "below" };
const DEFAULT_FILTER: KitCompare = { a: { prop: "x", of: "target" }, op: "lt", b: 80 };

/** Sizes a select to its chosen option, so rules read as sentences without cut-off words. */
const fit = (text: string) => ({ width: `calc(${text.length}ch + 36px)` });

const isCounterValue = (v: unknown): v is { counter: string } => typeof v === "object" && v !== null && Object.keys(v).length === 1 && "counter" in v;
const isCountValue = (v: unknown): v is { count: string } => typeof v === "object" && v !== null && Object.keys(v).length === 1 && "count" in v;
const isWho = (t: KitTarget): t is Who => t === "it" || t === "other";
/** Every thing of a kind, with no "whose" filter (the "turn every" and "send every … back" menu words). */
const isEvery = (t: KitTarget): t is { every: string } => typeof t === "object" && "every" in t && !t.where;
const isPosition = (at: KitTarget | { x: KitValue; y: KitValue }): at is { x: KitValue; y: KitValue } => typeof at === "object" && "x" in at;

/** A target as a select value: "it", "other", "every:rock", "nearest:rock", "random:rock". */
const targetKey = (t: KitTarget) => (typeof t === "string" ? t : "every" in t ? `every:${t.every}` : "nearest" in t ? `nearest:${t.nearest}` : `random:${t.random}`);
function keyTarget(key: string): KitTarget {
  if (key === "it" || key === "other") return key;
  const [mode, id] = key.split(":") as ["every" | "nearest" | "random", string];
  return mode === "every" ? { every: id } : mode === "nearest" ? { nearest: id } : { random: id };
}

const MOD_KEYS = ["times", "div", "neg", "plus"] as const;
type Mods = Pick<Extract<KitValue, { counter: string }>, (typeof MOD_KEYS)[number]>;
const modsOf = (v: KitValue): Mods => (typeof v === "number" ? {} : Object.fromEntries(MOD_KEYS.filter((k) => v[k] !== undefined).map((k) => [k, v[k]])));
/**
 * A value as a select value: counters by their id (so "Keys" reads as its
 * counter), everything else with an "@" (`@count:rock`, `@prop:it:x`…).
 */
function valueKey(v: Exclude<KitValue, number>): string {
  if ("counter" in v) return v.counter;
  if ("count" in v) return `@count:${v.count}`;
  if ("random" in v) return "@random";
  if ("prop" in v) return `@prop:${v.of}:${v.prop}`;
  if ("joy" in v) return `@joy:${v.axis}`;
  if ("facing" in v) return `@facing:${v.of}:${v.facing}`;
  return `@contact:${v.of}:${v.contact}`;
}
function keyValue(key: string, old: KitValue): KitValue {
  if (key === "@num") return 0;
  const mods = modsOf(old);
  if (!key.startsWith("@")) return { counter: key, ...mods };
  const [kind, a, b] = key.slice(1).split(":") as [string, string, string];
  if (kind === "count") return { count: a, ...mods };
  if (kind === "random") return { random: typeof old === "object" && "random" in old ? old.random : 9, ...mods };
  if (kind === "prop") return { prop: b as Prop, of: a as Whose, ...mods };
  if (kind === "joy") return { joy: 1, axis: a as "x" | "y", ...mods };
  if (kind === "facing") return { facing: b as "x" | "y", of: a as Whose, ...mods };
  return { contact: b as (typeof SIDES)[number], of: a as Whose, ...mods };
}

/** "it" and "other" mentioned where an action or comparison names a thing (its targets, and whose values it reads). */
const WHO_KEYS = new Set(["destroy", "toStart", "startHere", "who", "at", "of"]);
function whosIn(x: unknown, key = "", out = new Set<string>()): Set<string> {
  if (typeof x === "string") {
    if (WHO_KEYS.has(key) && (x === "it" || x === "other")) out.add(x);
  } else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) whosIn(v, k, out);
  return out;
}

/** The editor's name for a trigger, or null when this rule's trigger is one it can't edit yet. */
function triggerKind(r: KitRule): TriggerKind | null {
  const w = r.when;
  const fires = r.fires;
  if (r.any) return null;
  if ("touch" in w) return "touch";
  if ("onTile" in w) return w.onTile[1] === "hazard" ? "onHazard" : "onGoal";
  if ("edge" in w) return w.edge[1] === "bottom" && fires === "while" ? "reachesBottom" : null;
  if ("leaves" in w) return "leaves";
  if ("created" in w) return "created";
  if ("destroyed" in w) return "destroyed";
  if ("timerOut" in w) return "timerOut";
  if ("message" in w) return "message";
  if ("button" in w) return w.button.joy === 1 && w.button.button === 1 && !w.button.released ? "fire" : null;
  if ("after" in w) return "timer";
  if ("every" in w) return "every";
  if ("roomStart" in w) return "roomStart";
  if ("test" in w && (!fires || fires === "once")) {
    const t = w.test;
    if (isCountValue(t.a) && t.op === "eq" && t.b === 0) return "allGone";
    if (isCounterValue(t.a) && typeof t.b === "number" && t.a.counter !== SCORE) return t.op === "gte" ? "reaches" : "counterIs";
    return "compare";
  }
  return null;
}

/** The editor's name for an action, or null when it can't edit it yet. */
function actionKind(a: KitAction): ActionKind | null {
  if ("destroy" in a) return "remove";
  if ("toStart" in a) return isEvery(a.toStart) ? "respawnAll" : "respawn";
  if ("add" in a) return "counter" in a.add.what && a.add.what.counter === SCORE && typeof a.add.by === "number" ? "score" : "add";
  if ("take" in a) return "take";
  if ("set" in a) return "set";
  if ("turn" in a) return isEvery(a.turn.who) ? "turnAll" : "turn";
  if ("protect" in a) return "protect";
  if ("create" in a) return "create";
  if ("step" in a) return "step";
  if ("send" in a) return "send";
  if ("gameOver" in a) return a.gameOver === "won" ? "win" : "lose";
  if ("restartRoom" in a) return "restartRoom";
  if ("sound" in a) return "sound";
  return null;
}

/** True when every part of the rule is something these menus offer (any target and value is). */
export function editableRule(r: KitRule): boolean {
  if (!triggerKind(r)) return false;
  return r.then.every((a) => actionKind(a) !== null);
}

/** The things a rule's actions can point at: both when two touch, one when a single thing triggers it. */
const whoChoices = (w: KitTrigger, g: KitGame): Who[] => ("touch" in w ? ["it", "other"] : thingOf(w, "it", g) ? ["it"] : []);
/** The kind a rule's "it" or "other" is (fire: the player). */
function thingOf(w: KitTrigger, who: Who, g: KitGame): string | null {
  if ("button" in w) return who === "it" ? (g.types.find(isPlayer)?.id ?? null) : null;
  if ("test" in w && who === "it") return null;
  return triggerThing(w, who);
}

/** Kinds of thing that can change into other kinds (never the player). */
const turnable = (g: KitGame) => g.types.filter((t) => !isPlayer(t)).map((t) => t.id);
const playerId = (g: KitGame, id: string | null) => !!id && g.types.some((t) => t.id === id && isPlayer(t));

function defaultTrigger(kind: TriggerKind, g: KitGame, from: KitRule): Pick<KitRule, "when" | "fires"> {
  const first = thingOf(from.when, "it", g) ?? ("test" in from.when && isCountValue(from.when.test.a) ? from.when.test.a.count : null) ?? g.types[0]!.id;
  const second = g.types.find((t) => t.id !== first)?.id ?? first;
  switch (kind) {
    case "touch":
      return { when: { touch: [first, second] } };
    case "allGone":
      return { when: { test: { a: { count: first }, op: "eq", b: 0 } } };
    case "reachesBottom":
      return { when: { edge: [first, "bottom"] }, fires: "while" };
    case "leaves":
      return { when: { leaves: first } };
    case "created":
      return { when: { created: first } };
    case "destroyed":
      return { when: { destroyed: first } };
    case "timerOut":
      return { when: { timerOut: first } };
    case "compare":
      return { when: { test: { a: { count: first }, op: "gte", b: 3 } } };
    case "message":
      return { when: { message: g.messages[0] ?? newMessage(g) } };
    case "onHazard":
    case "onGoal":
      // Usually the player stepping on spikes or reaching the goal.
      return { when: { onTile: [g.types.find(isPlayer)?.id ?? first, kind === "onHazard" ? "hazard" : "goal"] } };
    case "fire":
      return { when: { button: { joy: 1, button: 1 } } };
    case "timer":
      return { when: { after: 30 } };
    case "every":
      return { when: { every: 10 } };
    case "reaches":
    case "counterIs":
      return {
        when: { test: { a: { counter: g.counters.find((c) => c.id !== "lives")?.id ?? g.counters[0]?.id ?? LEVEL }, op: kind === "reaches" ? "gte" : "eq", b: kind === "reaches" ? 3 : 0 } },
      };
    case "roomStart":
      return { when: { roomStart: true } };
  }
}

/** A thing to turn `from` into, or null when there's nothing else it could become. */
const turnTarget = (g: KitGame, from: string | null, prefer?: string) => {
  const options = turnable(g).filter((id) => id !== from);
  return prefer && options.includes(prefer) ? prefer : (options[0] ?? null);
};

/** Who a "turn" action can change: a thing in the rule that isn't the player and has something to become. */
const turnWho = (g: KitGame, w: KitTrigger): Who | null => {
  const ok = whoChoices(w, g).filter((who) => {
    const from = thingOf(w, who, g);
    return !playerId(g, from) && turnTarget(g, from) !== null;
  });
  return ok.includes("other") ? "other" : (ok[0] ?? null);
};

const counterIds = (g: KitGame) => g.counters.map((c) => c.id);

function defaultActions(kind: ActionKind, w: KitTrigger, g: KitGame): KitAction[] {
  const counter = g.counters.find((c) => c.id !== "lives")?.id ?? g.counters[0]?.id ?? "";
  const a = (x: Record<string, unknown>) => [act(g, x)];
  switch (kind) {
    case "remove":
    case "respawn": {
      // The thing touched, the rule's own thing, or (with neither) every thing that isn't the player.
      const who = "touch" in w ? "other" : (whoChoices(w, g)[0] ?? { every: g.types.find((t) => !isPlayer(t))?.id ?? g.types[0]!.id });
      return a(kind === "remove" ? { destroy: who } : { toStart: who });
    }
    case "respawnAll":
      return a({ toStart: { every: g.types.find(isPlayer)?.id ?? g.types[0]!.id } });
    case "score":
      return a({ add: { what: { counter: SCORE }, by: 10 } });
    case "sound":
      return a({ sound: SOUND_LIBRARY[0]!.id });
    case "add":
      return a({ add: { what: { counter }, by: 1 } });
    case "take":
      return a({ take: { what: { counter }, by: 1 } });
    case "set":
      return a({ set: { what: { counter }, to: 0 } });
    case "turn": {
      const who = turnWho(g, w) ?? "it";
      return a({ turn: { who, into: turnTarget(g, thingOf(w, who, g))! } });
    }
    case "turnAll": {
      const type = turnable(g)[0]!;
      return a({ turn: { who: { every: type }, into: turnTarget(g, type)! } });
    }
    case "protect":
      return a({ protect: { who: whoChoices(w, g)[0] ?? { every: g.types.find(isPlayer)?.id ?? g.types[0]!.id }, tenths: 15 } });
    case "create": {
      const at = whoChoices(w, g)[0];
      const type = g.types.find((t) => t.id !== thingOf(w, at ?? "it", g))?.id ?? g.types[0]!.id;
      return a({ create: { type, ...(at ? { at, place: "above" } : { at: { x: 80, y: 100 } }) } });
    }
    case "step":
      return a({ step: { who: whoChoices(w, g)[0] ?? { every: g.types.find(isPlayer)?.id ?? g.types[0]!.id }, dx: 8, dy: 0 } });
    case "send":
      return a({ send: g.messages[0] ?? newMessage(g) });
    case "loseLife":
      return loseLife(g);
    case "nextLevel":
      return nextLevel(g);
    case "win":
      return a({ gameOver: "won" });
    case "lose":
      return a({ gameOver: "lost" });
    case "restartRoom":
      return a({ restartRoom: true });
  }
}

/** Actions that make sense for a trigger in this game (`keep` is always offered, so a select never loses its value). */
function actionKinds(w: KitTrigger, g: KitGame, keep?: ActionKind | null): ActionKind[] {
  const thing = whoChoices(w, g).length > 0;
  const counters = counterIds(g).length > 0;
  return (Object.keys(ACTION_LABELS) as ActionKind[]).filter((k) => {
    if (k === keep) return true;
    if (k === "add" || k === "take" || k === "set") return counters;
    if (k === "turn") return turnWho(g, w) !== null;
    if (k === "turnAll") return turnable(g).length > 1;
    if (k === "loseLife") return g.counters.some((c) => c.id === "lives");
    return true;
  });
}

/** After the trigger changes: drops actions and conditions about things the rule no longer has. */
function fitActions(r: KitRule, g: KitGame) {
  const has = whoChoices(r.when, g);
  const fits = (x: unknown) => [...whosIn(x)].every((who) => has.includes(who as Who));
  if (r.if) {
    r.if = r.if.filter(fits);
    if (!r.if.length) delete r.if;
  }
  r.then = r.then.filter((a) => {
    if (!fits(a)) return false;
    if (!("turn" in a) || !isWho(a.turn.who)) return true;
    const thing = thingOf(r.when, a.turn.who, g);
    const into = turnTarget(g, thing, a.turn.into);
    if (playerId(g, thing) || !into) return false;
    a.turn.into = into;
    return true;
  });
  if (r.then.length === 0) r.then = [act(g, { add: { what: { counter: SCORE }, by: 10 } })];
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(v)));
/** A typed number, clamped; anything that isn't a number counts as `min`. */
const typed = (s: string, min: number, max: number) => clamp(s === "" || Number.isNaN(Number(s)) ? min : Number(s), min, max);

/** A thing a value can read: the rule's "it" or "other", or an action's target. */
interface WhoseChoice {
  who: Whose;
  /** "the Cat's", "its own" */
  poss: string;
  /** The kind it is, for its variables' names. */
  kind: string | null;
}

/** A thing's property, by the kind's own name for its variables ("hp" for a). */
const propName = (g: KitGame, kind: string | null, p: Prop) => ((p === "a" || p === "b") && g.types.find((t) => t.id === kind)?.vars?.[p]?.name) || PROP_LABELS[p];

/**
 * A value in a rule. A plain number is a number box with a button to read
 * something instead; anything else is one select (counters, how many,
 * random, a thing's property, the joystick, facing, walls) plus its
 * modifiers ("× 2", "reversed", "+ 1") when asked for.
 *
 * Labels: the main control is "<of> <name>" (as the editor always had, like
 * "Rule 3 condition 1 value"); the others put their word first, so no label
 * contains another.
 */
function ValueField({
  value,
  onChange,
  of,
  name,
  whose,
  min,
  max,
}: {
  value: KitValue;
  onChange: (v: KitValue, key?: string) => void;
  of: string;
  name: string;
  whose: WhoseChoice[];
  min: number;
  max: number;
}) {
  const game = useKitStore((s) => s.project);
  const [adjusting, setAdjusting] = useState(false);
  const label = `${of} ${name}`;
  const key = `value:${of}:${name}`;
  if (typeof value === "number") {
    return (
      <>
        <input type="number" className="num fit" aria-label={label} min={min} max={max} value={value} onChange={(e) => onChange(typed(e.target.value, min, max), key)} />
        <button
          type="button"
          className="icon"
          aria-label={`Read a value instead: ${of}, ${name}`}
          title="Use a counter, a thing's property, how many there are, or a random number instead"
          onClick={() => onChange(game.counters.length ? { counter: game.counters.find((c) => c.id !== "lives")?.id ?? game.counters[0]!.id } : { random: 9 })}
        >
          ƒ
        </button>
      </>
    );
  }
  const thing = (id: string) => game.types.find((t) => t.id === id)?.label ?? id;
  const counterLabel = (id: string) => (id === SECONDS ? "the seconds" : id === SCORE ? "the score" : id === LEVEL && !game.counters.some((c) => c.id === LEVEL) ? "the level" : (game.counters.find((c) => c.id === id)?.label ?? id));
  const groups: [string, [string, string][]][] = [
    ["", [["@num", "a number"]]],
    ["Counters", [...game.counters.map((c): [string, string] => [c.id, c.label]), [SECONDS, "the seconds"]]],
    ["How many", game.types.map((t): [string, string] => [`@count:${t.id}`, `the number of ${t.label}`])],
    ["Chance", [["@random", "a random number up to"]]],
    ...whose.map((w): [string, [string, string][]] => [
      w.poss,
      [
        ...PROPS.map((p): [string, string] => [`@prop:${w.who}:${p}`, `${w.poss} ${propName(game, w.kind, p)}`]),
        ...["x", "y"].map((axis): [string, string] => [`@facing:${w.who}:${axis}`, `${w.poss} facing ${axis === "x" ? "across" : "down"} (-1, 0 or 1)`]),
        ...SIDES.map((side): [string, string] => [`@contact:${w.who}:${side}`, `${w.poss} wall ${WALL_SIDE[side]} (1 or 0)`]),
      ],
    ]),
    [
      "Joystick",
      [
        ["@joy:x", "the joystick left or right (-1, 0 or 1)"],
        ["@joy:y", "the joystick up or down (-1, 0 or 1)"],
      ],
    ],
  ];
  const current = valueKey(value);
  const known = groups.some(([, opts]) => opts.some(([k]) => k === current));
  const currentLabel =
    "counter" in value ? counterLabel(value.counter) : "count" in value ? `the number of ${thing(value.count)}` : (groups.flatMap(([, o]) => o).find(([k]) => k === current)?.[1] ?? current);
  const mods = modsOf(value);
  const set = (patch: Partial<Mods>, k?: string) => {
    const next = { ...value, ...patch } as Record<string, unknown>;
    for (const m of MOD_KEYS) if (next[m] === undefined || next[m] === 0 || next[m] === false || (m === "times" && next[m] === 1)) delete next[m];
    onChange(next as KitValue, k);
  };
  return (
    <span className="value-field">
      <select aria-label={label} className="fit" style={fit(currentLabel)} value={current} onChange={(e) => onChange(keyValue(e.target.value, value))}>
        {!known && <option value={current}>{currentLabel}</option>}
        {groups.map(([g, opts]) =>
          g ? (
            <optgroup key={g} label={g}>
              {opts.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </optgroup>
          ) : (
            opts.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))
          ),
        )}
      </select>
      {"random" in value && (
        <input
          type="number"
          className="num fit"
          aria-label={`Random up to: ${of}, ${name}`}
          min={1}
          max={255}
          value={value.random}
          onChange={(e) => onChange({ ...value, random: typed(e.target.value, 1, 255) }, key)}
        />
      )}
      {adjusting || Object.keys(mods).length ? (
        <>
          <span className="kw">×</span>
          <select aria-label={`Times: ${of}, ${name}`} className="fit" style={fit(String(mods.times ?? 1))} value={mods.times ?? 1} onChange={(e) => set({ times: Number(e.target.value) })}>
            {Array.from({ length: 16 }, (_, n) => n + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="kw">÷</span>
          <select aria-label={`Divided by: ${of}, ${name}`} className="fit" style={fit(String(mods.div ?? 1))} value={mods.div ?? 1} onChange={(e) => set({ div: Number(e.target.value) === 1 ? undefined : (Number(e.target.value) as 2 | 4 | 8) })}>
            {[1, 2, 4, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button type="button" className="link small" aria-pressed={!!mods.neg} aria-label={`${of}, ${name}: reversed`} onClick={() => set({ neg: mods.neg ? undefined : true })}>
            reversed
          </button>
          <span className="kw">+</span>
          <input type="number" className="num fit" aria-label={`Plus: ${of}, ${name}`} min={-128} max={255} value={mods.plus ?? 0} onChange={(e) => set({ plus: typed(e.target.value, -128, 255) }, `${key}:plus`)} />
        </>
      ) : (
        <button type="button" className="icon" aria-label={`Adjust: ${of}, ${name}`} title="Multiply, divide, reverse or add to it" onClick={() => setAdjusting(true)}>
          ±
        </button>
      )}
    </span>
  );
}

export function KitRulesPanel() {
  const game = useKitStore((s) => s.project);
  const edit = useKitStore((s) => s.edit);
  const ids = useId();
  const [dragging, setDragging] = useState<number | null>(null);
  // Also kept in a ref: drag events can arrive before the state update renders.
  const dragFrom = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [moved, setMoved] = useState("");
  const focusAfterMove = useRef<number | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focusAfterMove.current === null) return;
    list.current?.querySelector<HTMLElement>(`[data-rule-handle="${focusAfterMove.current}"]`)?.focus();
    focusAfterMove.current = null;
  });

  const name = (id: string) => game.types.find((t) => t.id === id)?.label ?? id;
  const counterName = (id: string) => (id === LEVEL && !game.counters.some((c) => c.id === LEVEL) ? "the level" : (game.counters.find((c) => c.id === id)?.label ?? id));
  const setRule = (i: number, recipe: (r: KitRule, d: KitGame) => void, key?: string) => edit((d) => recipe(d.rules[i]!, d), key);
  const setAction = (i: number, j: number, recipe: (a: KitAction) => void, key?: string) => setRule(i, (r) => recipe(r.then[j]!), key);

  const move = (from: number, to: number, focus: boolean) => {
    if (to < 0 || to >= game.rules.length || from === to) return;
    edit((d) => moveRule(d, from, to));
    if (focus) focusAfterMove.current = to;
    setMoved(`Rule ${from + 1} is now rule ${to + 1}.`);
  };

  const thingSelect = (value: string, label: string, onChange: (id: string) => void, only?: string[]) => {
    const choices = game.types.filter((t) => !only || only.includes(t.id) || t.id === value);
    return (
      <select aria-label={label} className="fit" style={fit(name(value))} value={value} onChange={(e) => onChange(e.target.value)}>
        {choices.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    );
  };

  const counterSelect = (value: string, label: string, withSeconds: boolean, onChange: (id: string) => void) => (
    <select aria-label={label} className="fit" style={fit(counterName(value))} value={value} onChange={(e) => onChange(e.target.value)}>
      {game.counters.map((c) => (
        <option key={c.id} value={c.id}>
          {c.label}
        </option>
      ))}
      {!game.counters.some((c) => c.id === value) && <option value={value}>{counterName(value)}</option>}
      {withSeconds && value !== "seconds" && <option value="seconds">the seconds</option>}
    </select>
  );

  /** A message rules send and listen for; "a new message" adds one (message-1, message-2…). */
  const messageSelect = (value: string, label: string, onChange: (m: string, d: KitGame) => void) => (
    <select
      aria-label={label}
      className="fit"
      style={fit(value)}
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        edit((d) => onChange(v === "@new" ? newMessage(d) : v, d));
      }}
    >
      {[...new Set([...game.messages, value])].map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
      {game.messages.length < MAX_MESSAGES && <option value="@new">a new message</option>}
    </select>
  );

  const numInput = (value: number, label: string, min: number, max: number, onChange: (v: number) => void) => (
    <input
      type="number"
      className="num fit"
      aria-label={label}
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(typed(e.target.value, min, max))}
    />
  );

  /** Deletes a rule, says so, and puts focus on the rule that took its place (or Add rule), not on the page. */
  const deleteRule = (i: number) => {
    const left = game.rules.length - 1;
    edit((d) => void d.rules.splice(i, 1));
    setMoved(`Rule ${i + 1} deleted. Undo brings it back.`);
    requestAnimationFrame(() => {
      const next = left > 0 ? list.current?.querySelector<HTMLElement>(`[data-rule-handle="${Math.min(i, left - 1)}"]`) : null;
      (next ?? addButton.current)?.focus();
    });
  };

  return (
    <section className="panel" aria-labelledby="kit-rules-h">
      <h2 id="kit-rules-h" className="visually-hidden">Rules</h2>
      <p className="muted lead">
        Rules say what happens in your game. Each one reads as a sentence: change any underlined word. Rules run from the top, so order can
        matter.
      </p>
      <p id={`${ids}-move`} className="visually-hidden">
        Drag the handle to move a rule, or focus it and press the up and down arrows.
      </p>
      <p role="status" className="visually-hidden">
        {moved}
      </p>
      {game.rules.length === 0 && (
        <p className="empty-state" data-testid="rules-empty">
          No rules yet, so things can move but nothing happens when they meet. Press Add rule to start one, like “When the{" "}
          {game.types.find(isPlayer)?.label ?? game.types[0]!.label} touches something, add 10 points”.
        </p>
      )}
      <ol className="rules" ref={list}>
        {game.rules.map((rule, i) => {
          const n = i + 1;
          const handle = (
            // A span, not a <button>: Chrome won't start dragging a button.
            <span
              role="button"
              tabIndex={0}
              className="rule-handle"
              draggable
              data-rule-handle={i}
              aria-label={`Move rule ${n}`}
              aria-describedby={`${ids}-move`}
              title="Drag to move, or use the up and down arrows"
              onKeyDown={(e) => {
                if (e.metaKey || e.ctrlKey || e.altKey) return;
                const to = { ArrowUp: i - 1, ArrowDown: i + 1, Home: 0, End: game.rules.length - 1 }[e.key];
                if (to === undefined) return;
                e.preventDefault();
                move(i, to, true);
              }}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(i));
                const li = e.currentTarget.closest("li");
                if (li) e.dataTransfer.setDragImage(li, 16, 16);
                dragFrom.current = i;
                setDragging(i);
              }}
              onDragEnd={() => {
                dragFrom.current = null;
                setDragging(null);
                setOver(null);
              }}
            >
              ⠿
            </span>
          );
          const dropProps = {
            onDragOver: (e: React.DragEvent) => {
              if (dragFrom.current === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (over !== i) setOver(i);
            },
            onDrop: (e: React.DragEvent) => {
              e.preventDefault();
              if (dragFrom.current !== null) move(dragFrom.current, i, false);
              dragFrom.current = null;
              setDragging(null);
              setOver(null);
            },
          };
          const liClass = `rule${dragging === i ? " dragging" : ""}${over === i && dragging !== i ? " drop-target" : ""}`;

          if (!editableRule(rule)) {
            return (
              <li key={rule.id} className={liClass} {...dropProps}>
                <div className="rule-row">
                  {handle}
                  <p className="rule-sentence readonly">{ruleSentence(rule, game)}</p>
                </div>
                <div className="rule-tools">
                  <span className="muted small">
                    This rule uses words the rule editor can't change yet (coming soon). It works in the game, and you can move or delete it.
                  </span>
                  <span className="spacer" />
                  <button type="button" className="link danger" onClick={() => deleteRule(i)}>
                    Delete rule {n}
                  </button>
                </div>
              </li>
            );
          }

          const w = rule.when;
          const kind = triggerKind(rule)!;
          const conditions = rule.if ?? [];
          const whoLabel = (who: Who) => {
            const thing = thingOf(w, who, game);
            return thing ? `the ${name(thing)}` : "the thing";
          };
          /** The kind a target is (its "it" or "other" through the trigger). */
          const kindOf = (t: KitTarget) => (isWho(t) ? thingOf(w, t, game) : "every" in t ? t.every : "nearest" in t ? t.nearest : t.random);
          /** Things a value can read here: the rule's own, and the action's target (as "its own"). */
          const whoseHere = (target?: KitTarget | null, own = "its own"): WhoseChoice[] => [
            ...(target ? [{ who: "target" as const, poss: own, kind: kindOf(target) }] : []),
            ...whoChoices(w, game).map((who) => ({ who, poss: `${whoLabel(who)}'s`, kind: thingOf(w, who, game) })),
          ];
          const compareField = (c: KitCompare, of: string, names: [string, string], whose: WhoseChoice[], onChange: (c: KitCompare, key?: string) => void, ops = OPS) => (
            <>
              <ValueField value={c.a} of={of} name={names[0]} whose={whose} min={-128} max={255} onChange={(a, key) => onChange({ ...c, a }, key)} />
              <select
                aria-label={`${of} test`}
                className="fit"
                style={fit(OPS.find((o) => o.op === c.op)!.label)}
                value={c.op}
                onChange={(e) => onChange({ ...c, op: e.target.value as Op })}
              >
                {(ops.some((o) => o.op === c.op) ? ops : OPS).map((o) => (
                  <option key={o.op} value={o.op}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ValueField value={c.b} of={of} name={names[1]} whose={whose} min={-128} max={255} onChange={(b, key) => onChange({ ...c, b }, key)} />
            </>
          );
          /**
           * "the Ship", "the Rock", "every Cat" (optionally whose …), "the nearest Rock" or "a random Bomb".
           * `of` names the action ("Rule 2 action 1"); the select is "<of> which".
           */
          const targetSelect = (
            value: KitTarget,
            of: string,
            onChange: (t: KitTarget) => void,
            opts: { only?: (kind: string | null) => boolean; position?: boolean; isPosition?: boolean; onPosition?: () => void } = {},
          ) => {
            const ok = opts.only ?? (() => true);
            const key = opts.isPosition ? "@xy" : targetKey(value);
            const kinds = game.types.filter((t) => ok(t.id));
            const groups: [string, [string, string][]][] = [
              ["", whoChoices(w, game).filter((who) => ok(thingOf(w, who, game))).map((who): [string, string] => [who, whoLabel(who)])],
              ["Every", kinds.map((t): [string, string] => [`every:${t.id}`, `every ${t.label}`])],
              ["The nearest", kinds.map((t): [string, string] => [`nearest:${t.id}`, `the nearest ${t.label}`])],
              ["A random one", kinds.map((t): [string, string] => [`random:${t.id}`, `a random ${t.label}`])],
            ];
            if (opts.position) groups[0]![1].unshift(["@xy", "a position"]);
            const all = groups.flatMap(([, o]) => o);
            const current = all.find(([k]) => k === key)?.[1] ?? (isWho(value) ? whoLabel(value) : key);
            const where = typeof value === "object" && "every" in value && !opts.isPosition ? value.where : undefined;
            return (
              <>
                <select
                  aria-label={`${of} which`}
                  className="fit"
                  style={fit(current)}
                  value={key}
                  onChange={(e) => {
                    if (e.target.value === "@xy") return opts.onPosition?.();
                    const next = keyTarget(e.target.value);
                    // Another kind of "every": the filter stays.
                    onChange(where && typeof next === "object" && "every" in next ? { ...next, where } : next);
                  }}
                >
                  {!all.some(([k]) => k === key) && <option value={key}>{current}</option>}
                  {groups.map(([g, o]) =>
                    g ? (
                      <optgroup key={g} label={g}>
                        {o.map(([k, l]) => (
                          <option key={k} value={k}>
                            {l}
                          </option>
                        ))}
                      </optgroup>
                    ) : (
                      o.map(([k, l]) => (
                        <option key={k} value={k}>
                          {l}
                        </option>
                      ))
                    ),
                  )}
                </select>
                {typeof value === "object" && "every" in value && !opts.isPosition && filterField(value, of, onChange)}
              </>
            );
          };
          /** "whose x is less than 80" after "every Ghost", or the button that adds it. */
          const filterField = (value: { every: string; where?: KitCompare }, of: string, onChange: (t: KitTarget) => void) =>
            value.where ? (
              <span className="rule-action">
                <span className="kw">whose</span>
                {compareField(value.where, `${of} filter`, ["property", "value"], whoseHere(value, "its"), (where, key) => onChange({ ...value, where }), OPS)}
                <button type="button" className="icon" aria-label={`Every one: ${of}`} title="Every one, not only some" onClick={() => onChange({ every: value.every })}>
                  ×
                </button>
              </span>
            ) : (
              <button type="button" className="link small" aria-label={`${of}: whose…`} onClick={() => onChange({ ...value, where: DEFAULT_FILTER })}>
                + whose…
              </button>
            );
          /** What set, add and take change: a counter ("Keys") or a thing's property ("x of the Cat"). */
          const settableField = (what: KitSettable, of: string, verb: "set" | "add" | "take", onChange: (s: KitSettable) => void) => {
            const kind = "prop" in what ? kindOf(what.of) : null;
            const counters: [string, string][] = [
              ...(verb === "set" ? [] : ([[SCORE, "the score"]] as [string, string][])),
              ...game.counters.map((c): [string, string] => [c.id, c.label]),
            ];
            const props = PROPS.map((p): [string, string] => [`@prop:${p}`, propName(game, kind, p)]);
            const key = "counter" in what ? what.counter : `@prop:${what.prop}`;
            const all = [...counters, ...props];
            const current = all.find(([k]) => k === key)?.[1] ?? counterName(key);
            return (
              <>
                <select
                  aria-label={`${of} ${"counter" in what ? "counter" : "property"}`}
                  className="fit"
                  style={fit(current)}
                  value={key}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v.startsWith("@")) return onChange({ counter: v });
                    onChange({ prop: v.slice(6) as Prop, of: "prop" in what ? what.of : (whoChoices(w, game)[0] ?? { every: game.types[0]!.id }) });
                  }}
                >
                  {!all.some(([k]) => k === key) && <option value={key}>{current}</option>}
                  <optgroup label="Counters">
                    {counters.map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Of a thing">
                    {props.map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </optgroup>
                </select>
                {"prop" in what && (
                  <>
                    <span className="kw">of</span>
                    {targetSelect(what.of, of, (t) => onChange({ prop: what.prop, of: t }))}
                  </>
                )}
              </>
            );
          };
          /** The range a number can take where a settable reads it. */
          const range = (what: KitSettable, verb: "set" | "add" | "take"): [number, number] =>
            "counter" in what ? (what.counter === SCORE ? [0, 9990] : verb === "set" ? [0, 99] : [1, 99]) : [-128, 255];
          const seconds = (value: number | undefined, label: string, set: (s: number | undefined) => void) =>
            value ? (
              <>
                <span className="kw">for</span>
                {numInput(value, `${label} seconds`, 1, 25, set)}
                <span className="kw">seconds</span>
                <button type="button" className="icon" aria-label={`${label}: for good`} title="Keep it changed for good" onClick={() => set(undefined)}>
                  ×
                </button>
              </>
            ) : (
              <button type="button" className="link small" aria-label={`${label}: only for some seconds`} onClick={() => set(5)}>
                + for some seconds
              </button>
            );
          const firstThing = ONE_THING.includes(kind) ? thingOf(w, "it", game) ?? ("test" in w && isCountValue(w.test.a) ? w.test.a.count : null) : null;
          const setFirstThing = (id: string) =>
            setRule(i, (r, d) => {
              const x = r.when;
              if ("test" in x && isCountValue(x.test.a)) x.test.a.count = id;
              if ("edge" in x) x.edge[0] = id;
              if ("leaves" in x) x.leaves = id;
              if ("onTile" in x) x.onTile[0] = id;
              if ("created" in x) x.created = id;
              if ("destroyed" in x) x.destroyed = id;
              if ("timerOut" in x) x.timerOut = id;
              fitActions(r, d);
            });

          return (
            <li key={rule.id} className={liClass} {...dropProps}>
              <div className="rule-row">
                {handle}
                <p className="rule-sentence">
                  <span className="kw">When</span>
                  {"touch" in w && thingSelect(w.touch[0], `Rule ${n} first thing`, (id) => setRule(i, (r, d) => ("touch" in r.when && (r.when.touch[0] = id), fitActions(r, d))))}
                  {firstThing && thingSelect(firstThing, `Rule ${n} thing`, setFirstThing)}
                  {"after" in w && numInput(w.after, `Rule ${n} seconds`, 1, 99, (v) => setRule(i, (r) => void ("after" in r.when && (r.when.after = v)), `timer:${rule.id}`))}
                  {(kind === "reaches" || kind === "counterIs") &&
                    "test" in w &&
                    isCounterValue(w.test.a) &&
                    counterSelect(w.test.a.counter, `Rule ${n} counter`, false, (id) => setRule(i, (r) => void ("test" in r.when && (r.when.test.a = { counter: id }))))}
                  <select
                    aria-label={`Rule ${n} trigger`}
                    className="fit"
                    style={fit(TRIGGERS.find((t) => t.kind === kind)!.label)}
                    value={kind}
                    onChange={(e) =>
                      setRule(i, (r, d) => {
                        const next = defaultTrigger(e.target.value as TriggerKind, d, r);
                        r.when = next.when;
                        if (next.fires) r.fires = next.fires;
                        else delete r.fires;
                        fitActions(r, d);
                      })
                    }
                  >
                    {TRIGGERS.map((t) => (
                      <option key={t.kind} value={t.kind}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  {"touch" in w && thingSelect(w.touch[1], `Rule ${n} second thing`, (id) => setRule(i, (r, d) => ("touch" in r.when && (r.when.touch[1] = id), fitActions(r, d))))}
                  {("touch" in w || "onTile" in w) && (
                    <select
                      aria-label={`Rule ${n} fires`}
                      className="fit"
                      style={fit(FIRES.find((f) => f.fires === (rule.fires ?? "while"))!.label)}
                      value={rule.fires ?? "while"}
                      // "while" is what touching and tiles do by default, so it isn't written down.
                      onChange={(e) => setRule(i, (r) => void (e.target.value === "once" ? (r.fires = "once") : delete r.fires))}
                    >
                      {FIRES.map((f) => (
                        <option key={f.fires} value={f.fires}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {"message" in w && (
                    <>
                      {messageSelect(w.message, `Rule ${n} message`, (m, d) => {
                        const r = d.rules[i]!;
                        if ("message" in r.when) r.when.message = m;
                      })}
                      <span className="kw">is sent</span>
                    </>
                  )}
                  {"every" in w && (
                    <>
                      {numInput(w.every, `Rule ${n} ${w.frames ? "frames" : "seconds"}`, 1, 60, (v) => setRule(i, (r) => void ("every" in r.when && (r.when.every = v)), `every:${rule.id}`))}
                      <select
                        aria-label={`Rule ${n} unit`}
                        className="fit"
                        style={fit(w.frames ? "frames" : "seconds")}
                        value={w.frames ? "frames" : "seconds"}
                        onChange={(e) => setRule(i, (r) => void ("every" in r.when && (e.target.value === "frames" ? (r.when.frames = true) : delete r.when.frames)))}
                      >
                        <option value="seconds">seconds</option>
                        <option value="frames">frames</option>
                      </select>
                    </>
                  )}
                  {kind === "compare" &&
                    "test" in w &&
                    compareField(w.test, `Rule ${n}`, ["first value", "second value"], [], (c, key) => setRule(i, (r) => void ("test" in r.when && (r.when.test = c)), key))}
                  {kind === "counterIs" && "test" in w && (
                    <select
                      aria-label={`Rule ${n} test`}
                      className="fit"
                      style={fit(OPS.find((o) => o.op === w.test.op)!.label)}
                      value={w.test.op}
                      onChange={(e) => setRule(i, (r) => void ("test" in r.when && (r.when.test.op = e.target.value as Op)))}
                    >
                      {OPS.filter((o) => o.op !== "gte").map((o) => (
                        <option key={o.op} value={o.op}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {(kind === "reaches" || kind === "counterIs") &&
                    "test" in w &&
                    typeof w.test.b === "number" &&
                    numInput(w.test.b, `Rule ${n} target`, 0, 99, (v) => setRule(i, (r) => void ("test" in r.when && (r.when.test.b = v)), `reaches:${rule.id}`))}
                  {conditions.map((c, k) => (
                    <span key={k} className="rule-action">
                      <span className="kw">{k === 0 ? ", only if" : "and"}</span>
                      {compareField(c, `Rule ${n} condition ${k + 1}`, [isCounterValue(c.a) ? "counter" : "first value", "value"], whoseHere(), (next, key) =>
                        setRule(i, (r) => void (r.if![k] = next), key && `if:${rule.id}:${k}:${key}`),
                      )}
                      <button
                        type="button"
                        className="icon"
                        aria-label={`Remove condition ${k + 1} from rule ${n}`}
                        title="Remove this condition"
                        onClick={() =>
                          setRule(i, (r) => {
                            r.if!.splice(k, 1);
                            if (r.if!.length === 0) delete r.if;
                          })
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <span className="kw">,</span>
                  {rule.then.map((action, j) => {
                    const ak = actionKind(action)!;
                    const label = `Rule ${n} action ${j + 1}`;
                    return (
                      <span key={action.id} className="rule-action">
                        {j > 0 && <span className="kw">and</span>}
                        <select
                          aria-label={label}
                          className="fit"
                          style={fit(ACTION_LABELS[ak])}
                          value={ak}
                          onChange={(e) => setRule(i, (r, d) => void r.then.splice(j, 1, ...defaultActions(e.target.value as ActionKind, r.when, d)))}
                        >
                          {actionKinds(w, game, ak)
                            .filter((k) => k === ak || !GROUPS.includes(k) || rule.then.length < 10)
                            .map((k) => (
                              <option key={k} value={k}>
                                {ACTION_LABELS[k]}
                              </option>
                            ))}
                        </select>
                        {"destroy" in action && targetSelect(action.destroy, label, (t) => setAction(i, j, (a) => void ("destroy" in a && (a.destroy = t))))}
                        {"toStart" in action && !isEvery(action.toStart) && targetSelect(action.toStart, label, (t) => setAction(i, j, (a) => void ("toStart" in a && (a.toStart = t))))}
                        {"toStart" in action && isEvery(action.toStart) && (
                          <>
                            {thingSelect(action.toStart.every, `${label} which`, (id) => setAction(i, j, (a) => void ("toStart" in a && (a.toStart = { every: id }))))}
                            {filterField(action.toStart, label, (t) => setAction(i, j, (a) => void ("toStart" in a && (a.toStart = t))))}
                          </>
                        )}
                        {ak === "score" && "add" in action && typeof action.add.by === "number" && (
                          <select
                            aria-label={`${label} points`}
                            className="fit"
                            style={fit(String(action.add.by))}
                            value={action.add.by}
                            onChange={(e) => setAction(i, j, (a) => void ("add" in a && (a.add.by = Number(e.target.value))))}
                          >
                            {(POINTS.includes(action.add.by) ? POINTS : [...POINTS, action.add.by].sort((a, b) => a - b)).map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        )}
                        {ak !== "score" &&
                          ("add" in action || "take" in action || "set" in action) &&
                          (() => {
                            const verb = "add" in action ? "add" : "take" in action ? "take" : "set";
                            const op = "add" in action ? action.add : "take" in action ? action.take : action.set;
                            const amount = "to" in op ? op.to : op.by;
                            const [min, max] = range(op.what, verb);
                            const write = (recipe: (s: { what: KitSettable; to?: KitValue; by?: KitValue }) => void, key?: string) =>
                              setAction(i, j, (a) => recipe((a as unknown as Record<string, { what: KitSettable }>)[verb]!), key);
                            const amountField = (
                              <ValueField
                                value={amount}
                                of={label}
                                name="amount"
                                whose={whoseHere("prop" in op.what ? op.what.of : null)}
                                min={min}
                                max={max}
                                onChange={(v, key) => write((s) => void (verb === "set" ? (s.to = v) : (s.by = v)), key && `act:${action.id}:${key}`)}
                              />
                            );
                            const whatField = settableField(op.what, label, verb, (what) =>
                              write((s) => {
                                s.what = what;
                                // A counter can't hold what a property can (and the score only takes points).
                                const v = verb === "set" ? s.to : s.by;
                                const [lo, hi] = range(what, verb);
                                if (typeof v === "number") verb === "set" ? (s.to = clamp(v, lo, hi)) : (s.by = clamp(v, lo, hi));
                              }),
                            );
                            return verb === "set" ? (
                              <>
                                {whatField}
                                <span className="kw">to</span>
                                {amountField}
                              </>
                            ) : (
                              <>
                                {amountField}
                                <span className="kw">{verb === "add" ? "to" : "from"}</span>
                                {whatField}
                              </>
                            );
                          })()}
                        {"step" in action && (
                          <>
                            {targetSelect(action.step.who, label, (t) => setAction(i, j, (a) => void ("step" in a && (a.step.who = t))))}
                            <span className="kw">by</span>
                            <ValueField
                              value={action.step.dx}
                              of={label}
                              name="across"
                              whose={whoseHere(action.step.who)}
                              min={-128}
                              max={127}
                              onChange={(v, key) => setAction(i, j, (a) => void ("step" in a && (a.step.dx = v)), key && `act:${action.id}:${key}`)}
                            />
                            <span className="kw">across and</span>
                            <ValueField
                              value={action.step.dy}
                              of={label}
                              name="down"
                              whose={whoseHere(action.step.who)}
                              min={-128}
                              max={127}
                              onChange={(v, key) => setAction(i, j, (a) => void ("step" in a && (a.step.dy = v)), key && `act:${action.id}:${key}`)}
                            />
                            <span className="kw">down</span>
                          </>
                        )}
                        {"turn" in action && !isEvery(action.turn.who) && (
                          <>
                            {targetSelect(
                              action.turn.who,
                              label,
                              (t) =>
                                setAction(i, j, (a) => {
                                  if (!("turn" in a)) return;
                                  a.turn.who = t;
                                  a.turn.into = turnTarget(game, kindOf(t), a.turn.into) ?? a.turn.into;
                                }),
                              { only: (kind) => !playerId(game, kind) },
                            )}
                            <span className="kw">into a</span>
                            {thingSelect(
                              action.turn.into,
                              `${label} into`,
                              (id) => setAction(i, j, (a) => void ("turn" in a && (a.turn.into = id))),
                              turnable(game).filter((id) => id !== kindOf(action.turn.who)),
                            )}
                          </>
                        )}
                        {"turn" in action && isEvery(action.turn.who) && (
                          <>
                            {thingSelect(
                              action.turn.who.every,
                              `${label} which`,
                              (id) =>
                                setAction(i, j, (a) => {
                                  if (!("turn" in a)) return;
                                  a.turn.who = { every: id };
                                  a.turn.into = turnTarget(game, id, a.turn.into) ?? a.turn.into;
                                }),
                              turnable(game),
                            )}
                            {filterField(action.turn.who, label, (t) => setAction(i, j, (a) => void ("turn" in a && (a.turn.who = t))))}
                            <span className="kw">into a</span>
                            {thingSelect(
                              action.turn.into,
                              `${label} into`,
                              (id) => setAction(i, j, (a) => void ("turn" in a && (a.turn.into = id))),
                              turnable(game).filter((id) => id !== (action.turn.who as { every: string }).every),
                            )}
                          </>
                        )}
                        {"turn" in action &&
                          seconds(action.turn.seconds, label, (s) => setAction(i, j, (a) => void ("turn" in a && (s ? (a.turn.seconds = s) : delete a.turn.seconds)), `secs:${action.id}`))}
                        {"protect" in action && (
                          <>
                            {targetSelect(action.protect.who, label, (t) => setAction(i, j, (a) => void ("protect" in a && (a.protect.who = t))))}
                            <span className="kw">for</span>
                            {numInput(action.protect.tenths, `${label} tenths`, 1, 255, (v) => setAction(i, j, (a) => void ("protect" in a && (a.protect.tenths = v)), `act:${action.id}`))}
                            <span className="kw">tenths of a second</span>
                          </>
                        )}
                        {"create" in action &&
                          (() => {
                            const c = action.create;
                            const at = c.at;
                            const write = (recipe: (c: KitCreate) => void, key?: string) => setAction(i, j, (a) => void ("create" in a && recipe(a.create)), key);
                            const whose = whoseHere(isPosition(at) ? null : at, "its own");
                            const value = (v: KitValue, name: string, min: number, max: number, set: (c: KitCreate, v: KitValue) => void, choices = whose) => (
                              <ValueField value={v} of={label} name={name} whose={choices} min={min} max={max} onChange={(x, key) => write((cc) => set(cc, x), key && `act:${action.id}:${key}`)} />
                            );
                            return (
                              <>
                                <span className="kw">a</span>
                                {thingSelect(c.type, `${label} what`, (id) => write((cc) => void (cc.type = id)))}
                                {isPosition(at) ? (
                                  <span className="kw">at</span>
                                ) : (
                                  <select
                                    aria-label={`${label} where`}
                                    className="fit"
                                    style={fit(PLACES.find((p) => p.place === (c.place ?? "on"))?.label ?? "")}
                                    value={c.place ?? "on"}
                                    onChange={(e) => write((cc) => void (cc.place = e.target.value as (typeof PLACES)[number]["place"]))}
                                  >
                                    {PLACES.map((p) => (
                                      <option key={p.place} value={p.place}>
                                        {p.label}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                {targetSelect(
                                  isPosition(at) ? "it" : at,
                                  label,
                                  (t) =>
                                    write((cc) => {
                                      cc.at = t;
                                      cc.place ??= "above";
                                    }),
                                  {
                                    position: true,
                                    isPosition: isPosition(at),
                                    onPosition: () =>
                                      write((cc) => {
                                        cc.at = { x: 80, y: 100 };
                                        delete cc.place;
                                      }),
                                  },
                                )}
                                {isPosition(at) && (
                                  <>
                                    <span className="kw">x</span>
                                    {value(at.x, "x", 0, 159, (cc, v) => void (isPosition(cc.at) && (cc.at.x = v)), whoseHere())}
                                    <span className="kw">y</span>
                                    {value(at.y, "y", 16, 191, (cc, v) => void (isPosition(cc.at) && (cc.at.y = v)), whoseHere())}
                                  </>
                                )}
                                {c.dx !== undefined || c.dy !== undefined ? (
                                  <>
                                    <span className="kw">moved</span>
                                    {numInput(c.dx ?? 0, `${label} moved across`, -128, 127, (v) => write((cc) => void (cc.dx = v), `act:${action.id}:dx`))}
                                    <span className="kw">across and</span>
                                    {numInput(c.dy ?? 0, `${label} moved down`, -128, 127, (v) => write((cc) => void (cc.dy = v), `act:${action.id}:dy`))}
                                    <span className="kw">down</span>
                                    <button type="button" className="icon" aria-label={`Not moved: ${label}`} title="Don't move it" onClick={() => write((cc) => (delete cc.dx, delete cc.dy))}>
                                      ×
                                    </button>
                                  </>
                                ) : (
                                  <button type="button" className="link small" aria-label={`${label}: moved`} onClick={() => write((cc) => void ((cc.dx = 0), (cc.dy = 0)))}>
                                    + moved
                                  </button>
                                )}
                                {c.vx !== undefined || c.vy !== undefined ? (
                                  <>
                                    <span className="kw">moving</span>
                                    {value(c.vx ?? 0, "speed across", -112, 112, (cc, v) => void (cc.vx = v))}
                                    <span className="kw">across and</span>
                                    {value(c.vy ?? 0, "speed down", -112, 112, (cc, v) => void (cc.vy = v))}
                                    <span className="kw">down</span>
                                    <button type="button" className="icon" aria-label={`Its own speed: ${label}`} title="Start at its own speed" onClick={() => write((cc) => (delete cc.vx, delete cc.vy))}>
                                      ×
                                    </button>
                                  </>
                                ) : (
                                  <button type="button" className="link small" aria-label={`${label}: moving`} onClick={() => write((cc) => void ((cc.vx = 0), (cc.vy = 0)))}>
                                    + moving
                                  </button>
                                )}
                              </>
                            );
                          })()}
                        {"send" in action && messageSelect(action.send, `${label} message`, (m, d) => {
                          const a = d.rules[i]!.then[j]!;
                          if ("send" in a) a.send = m;
                        })}
                        {"sound" in action && (
                          <select
                            aria-label={`${label} sound`}
                            className="fit"
                            style={fit(SOUND_LIBRARY.find((x) => x.id === action.sound)?.label ?? "")}
                            value={action.sound}
                            onChange={(e) => setAction(i, j, (a) => void ("sound" in a && (a.sound = e.target.value)))}
                          >
                            {SOUND_LIBRARY.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        )}
                        {rule.then.length > 1 && (
                          <button
                            type="button"
                            className="icon"
                            aria-label={`Remove action ${j + 1} from rule ${n}`}
                            title="Remove this action"
                            onClick={() => setRule(i, (r) => void r.then.splice(j, 1))}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    );
                  })}
                  <span className="kw">.</span>
                </p>
              </div>
              <div className="rule-tools">
                {rule.then.length < 12 && (
                  <button type="button" className="link" onClick={() => setRule(i, (r, d) => void r.then.push(act(d, { add: { what: { counter: SCORE }, by: 10 } })))}>
                    + another action
                  </button>
                )}
                {conditions.length < 3 && (
                  <button
                    type="button"
                    className="link"
                    onClick={() =>
                      setRule(i, (r, d) => void (r.if ??= []).push({ a: { counter: d.counters.find((c) => c.id !== "lives")?.id ?? d.counters[0]?.id ?? "seconds" }, op: "gte", b: 1 }))
                    }
                  >
                    {conditions.length ? "+ and only if" : "+ only if"}
                  </button>
                )}
                <span className="spacer" />
                <button type="button" className="link danger" onClick={() => deleteRule(i)}>
                  Delete rule {n}
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <button
        ref={addButton}
        type="button"
        className="secondary"
        disabled={game.rules.length >= 24 || game.types.length === 0}
        onClick={() =>
          edit((d) => {
            const first = d.types.find(isPlayer)?.id ?? d.types[0]!.id;
            const second = d.types.find((t) => t.id !== first)?.id ?? first;
            d.rules.push({ id: newId(d, "r"), when: { touch: [first, second] }, then: [act(d, { add: { what: { counter: SCORE }, by: 10 } })] });
          })
        }
      >
        Add rule
      </button>
    </section>
  );
}
