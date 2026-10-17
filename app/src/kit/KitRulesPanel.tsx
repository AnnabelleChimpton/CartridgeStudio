// Rules for kit games: "When <trigger>, only if <conditions>, <actions>",
// over the game's own things and counters. Only valid combinations are
// offered (e.g. "the second thing" only exists when two things touch), and
// the rarer parts ("only if", "for N seconds") appear when asked for.
//
// Kit rules can say more than these menus offer (targets like "the
// nearest X", values, messages…). The editor recognises the shapes it can
// edit; any other rule shows as its sentence, still in the game and movable,
// with a note that editing it here is coming. Lists are keyed on the rules'
// stable ids, so focus and drag state stay with the right rule.

import { useEffect, useId, useRef, useState } from "react";
import { SOUND_LIBRARY } from "../project/templates.ts";
import { act, isPlayer, loseLife, moveRule, newId, nextLevel } from "./edit.ts";
import { triggerThing } from "./ir.ts";
import { LEVEL, SCORE, type KitAction, type KitCompare, type KitGame, type KitRule, type KitTarget, type KitTrigger } from "./schema.ts";
import { ruleSentence } from "./sentence.ts";
import { useKitStore } from "./store.ts";

type TriggerKind = "touch" | "allGone" | "reachesBottom" | "leaves" | "onHazard" | "onGoal" | "fire" | "timer" | "every" | "reaches" | "counterIs" | "roomStart";
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
  | "loseLife"
  | "win"
  | "lose"
  | "restartRoom"
  | "nextLevel"
  | "sound";
type Who = "it" | "other";
type Op = KitCompare["op"];

const TRIGGERS: { kind: TriggerKind; label: string }[] = [
  { kind: "touch", label: "touches" },
  { kind: "allGone", label: "are all gone" },
  { kind: "reachesBottom", label: "reaches the bottom" },
  { kind: "leaves", label: "leaves the screen" },
  { kind: "onHazard", label: "is on spikes" },
  { kind: "onGoal", label: "is on a goal" },
  { kind: "fire", label: "fire is pressed" },
  { kind: "timer", label: "seconds have passed" },
  { kind: "every", label: "every" },
  { kind: "reaches", label: "reaches" },
  { kind: "counterIs", label: "is" },
  { kind: "roomStart", label: "the room starts" },
];
/** Triggers that name one thing first ("When the Rock …"). */
const ONE_THING: TriggerKind[] = ["allGone", "reachesBottom", "leaves", "onHazard", "onGoal"];

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

/** Sizes a select to its chosen option, so rules read as sentences without cut-off words. */
const fit = (text: string) => ({ width: `calc(${text.length}ch + 36px)` });

const isCounterValue = (v: unknown): v is { counter: string } => typeof v === "object" && v !== null && Object.keys(v).length === 1 && "counter" in v;
const isCountValue = (v: unknown): v is { count: string } => typeof v === "object" && v !== null && Object.keys(v).length === 1 && "count" in v;
const isWho = (t: KitTarget): t is Who => t === "it" || t === "other";
const isEvery = (t: KitTarget): t is { every: string } => typeof t === "object" && "every" in t && !t.where;

/** The editor's name for a trigger, or null when this rule's trigger is one it can't edit yet. */
function triggerKind(r: KitRule): TriggerKind | null {
  const w = r.when;
  const fires = r.fires;
  if (r.any) return null;
  if ("touch" in w) return !fires || fires === "while" ? "touch" : null;
  if ("onTile" in w) return !fires || fires === "while" ? (w.onTile[1] === "hazard" ? "onHazard" : "onGoal") : null;
  if ("edge" in w) return w.edge[1] === "bottom" && fires === "while" ? "reachesBottom" : null;
  if ("leaves" in w) return "leaves";
  if ("button" in w) return w.button.joy === 1 && w.button.button === 1 && !w.button.released ? "fire" : null;
  if ("after" in w) return "timer";
  if ("every" in w) return w.frames ? null : "every";
  if ("roomStart" in w) return "roomStart";
  if ("test" in w && (!fires || fires === "once")) {
    const t = w.test;
    if (isCountValue(t.a) && t.op === "eq" && t.b === 0) return "allGone";
    if (isCounterValue(t.a) && typeof t.b === "number" && t.a.counter !== SCORE) return t.op === "gte" ? "reaches" : "counterIs";
  }
  return null;
}

/** The editor's name for an action, or null when it can't edit it yet. */
function actionKind(a: KitAction): ActionKind | null {
  if ("destroy" in a) return isWho(a.destroy) ? "remove" : null;
  if ("toStart" in a) return isWho(a.toStart) ? "respawn" : isEvery(a.toStart) ? "respawnAll" : null;
  const counterOp = (s: { what: object; by?: unknown; to?: unknown }) => "counter" in s.what && typeof (s.by ?? s.to) === "number";
  if ("add" in a) return counterOp(a.add) ? ((a.add.what as { counter: string }).counter === SCORE ? "score" : "add") : null;
  if ("take" in a) return counterOp(a.take) && (a.take.what as { counter: string }).counter !== SCORE ? "take" : null;
  if ("set" in a) return counterOp(a.set) && (a.set.what as { counter: string }).counter !== SCORE ? "set" : null;
  if ("turn" in a) return isWho(a.turn.who) ? "turn" : isEvery(a.turn.who) ? "turnAll" : null;
  if ("protect" in a) return isWho(a.protect.who) || isEvery(a.protect.who) ? "protect" : null;
  if ("create" in a) {
    const c = a.create;
    return typeof c.at === "string" && c.place !== undefined && c.dx === undefined && c.dy === undefined && c.vx === undefined && c.vy === undefined ? "create" : null;
  }
  if ("gameOver" in a) return a.gameOver === "won" ? "win" : "lose";
  if ("restartRoom" in a) return "restartRoom";
  if ("sound" in a) return "sound";
  return null;
}

/** True when every part of the rule is something these menus offer. */
export function editableRule(r: KitRule): boolean {
  if (!triggerKind(r)) return false;
  if ((r.if ?? []).some((c) => !isCounterValue(c.a) || typeof c.b !== "number" || c.a.counter === SCORE)) return false;
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
      return a({ destroy: "touch" in w ? "other" : "it" });
    case "respawn":
      return a({ toStart: "touch" in w ? "other" : "it" });
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
      return a({ create: { type, at: at ?? "it", place: "above" } });
    }
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
    if (k === "remove" || k === "respawn" || k === "create") return thing;
    if (k === "add" || k === "take" || k === "set") return counters;
    if (k === "turn") return turnWho(g, w) !== null;
    if (k === "turnAll") return turnable(g).length > 1;
    if (k === "loseLife") return g.counters.some((c) => c.id === "lives");
    return true;
  });
}

/** After the trigger changes: drops actions about things the rule no longer has. */
function fitActions(r: KitRule, g: KitGame) {
  r.then = r.then.filter((a) => {
    const who = "destroy" in a ? a.destroy : "toStart" in a ? a.toStart : "turn" in a ? a.turn.who : "protect" in a ? a.protect.who : "create" in a ? a.create.at : null;
    if (who === null || !isWho(who as KitTarget)) return true;
    const thing = thingOf(r.when, who as Who, g);
    if (!thing) return false;
    if (!("turn" in a)) return true;
    const into = turnTarget(g, thing, a.turn.into);
    if (playerId(g, thing) || !into) return false;
    a.turn.into = into;
    return true;
  });
  if (r.then.length === 0) r.then = [act(g, { add: { what: { counter: SCORE }, by: 10 } })];
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(v)));

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

  const numInput = (value: number, label: string, min: number, max: number, onChange: (v: number) => void) => (
    <input
      type="number"
      className="num fit"
      aria-label={label}
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(clamp(Number(e.target.value) || min, min, max))}
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
          const whoSelect = (value: Who, label: string, onChange: (who: Who) => void, choices = whoChoices(w, game)) => (
            <select aria-label={label} className="fit" style={fit(whoLabel(value))} value={value} onChange={(e) => onChange(e.target.value as Who)}>
              {(choices.includes(value) ? choices : [value, ...choices]).map((who) => (
                <option key={who} value={who}>
                  {whoLabel(who)}
                </option>
              ))}
            </select>
          );
          /** "the Ship", "the Rock" or "every Cat". */
          const targetSelect = (value: Who | { every: string }, label: string, onChange: (t: Who | { every: string }) => void) => {
            const key = typeof value === "string" ? value : `every:${value.every}`;
            const options: [string, string][] = [...whoChoices(w, game).map((who): [string, string] => [who, whoLabel(who)]), ...game.types.map((t): [string, string] => [`every:${t.id}`, `every ${t.label}`])];
            return (
              <select
                aria-label={label}
                className="fit"
                style={fit(options.find(([k]) => k === key)?.[1] ?? "")}
                value={key}
                onChange={(e) => onChange(e.target.value.startsWith("every:") ? { every: e.target.value.slice(6) } : (e.target.value as Who))}
              >
                {options.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            );
          };
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
                  {"every" in w && (
                    <>
                      {numInput(w.every, `Rule ${n} seconds`, 1, 60, (v) => setRule(i, (r) => void ("every" in r.when && (r.when.every = v)), `every:${rule.id}`))}
                      <span className="kw">seconds</span>
                    </>
                  )}
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
                      {isCounterValue(c.a) && counterSelect(c.a.counter, `Rule ${n} condition ${k + 1} counter`, true, (id) => setRule(i, (r) => void (r.if![k]!.a = { counter: id })))}
                      <select
                        aria-label={`Rule ${n} condition ${k + 1} test`}
                        className="fit"
                        style={fit(OPS.find((o) => o.op === c.op)!.label)}
                        value={c.op}
                        onChange={(e) => setRule(i, (r) => void (r.if![k]!.op = e.target.value as Op))}
                      >
                        {OPS.map((o) => (
                          <option key={o.op} value={o.op}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {typeof c.b === "number" &&
                        numInput(c.b, `Rule ${n} condition ${k + 1} value`, 0, 99, (v) => setRule(i, (r) => void (r.if![k]!.b = v), `if:${rule.id}:${k}`))}
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
                        {"destroy" in action && isWho(action.destroy) && whoSelect(action.destroy, `${label} which`, (who) => setAction(i, j, (a) => void ("destroy" in a && (a.destroy = who))))}
                        {"toStart" in action && isWho(action.toStart) && whoSelect(action.toStart, `${label} which`, (who) => setAction(i, j, (a) => void ("toStart" in a && (a.toStart = who))))}
                        {"toStart" in action && isEvery(action.toStart) && thingSelect(action.toStart.every, `${label} which`, (id) => setAction(i, j, (a) => void ("toStart" in a && (a.toStart = { every: id }))))}
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
                        {ak === "add" && "add" in action && "counter" in action.add.what && typeof action.add.by === "number" && (
                          <>
                            {numInput(action.add.by, `${label} amount`, 1, 99, (v) => setAction(i, j, (a) => void ("add" in a && (a.add.by = v)), `act:${action.id}`))}
                            <span className="kw">to</span>
                            {counterSelect(action.add.what.counter, `${label} counter`, false, (id) => setAction(i, j, (a) => void ("add" in a && (a.add.what = { counter: id }))))}
                          </>
                        )}
                        {ak === "take" && "take" in action && "counter" in action.take.what && typeof action.take.by === "number" && (
                          <>
                            {numInput(action.take.by, `${label} amount`, 1, 99, (v) => setAction(i, j, (a) => void ("take" in a && (a.take.by = v)), `act:${action.id}`))}
                            <span className="kw">from</span>
                            {counterSelect(action.take.what.counter, `${label} counter`, false, (id) => setAction(i, j, (a) => void ("take" in a && (a.take.what = { counter: id }))))}
                          </>
                        )}
                        {ak === "set" && "set" in action && "counter" in action.set.what && typeof action.set.to === "number" && (
                          <>
                            {counterSelect(action.set.what.counter, `${label} counter`, false, (id) => setAction(i, j, (a) => void ("set" in a && (a.set.what = { counter: id }))))}
                            <span className="kw">to</span>
                            {numInput(action.set.to, `${label} amount`, 0, 99, (v) => setAction(i, j, (a) => void ("set" in a && (a.set.to = v)), `act:${action.id}`))}
                          </>
                        )}
                        {"turn" in action && isWho(action.turn.who) && (
                          <>
                            {whoSelect(
                              action.turn.who,
                              `${label} which`,
                              (who) =>
                                setAction(i, j, (a) => {
                                  if (!("turn" in a)) return;
                                  a.turn.who = who;
                                  a.turn.into = turnTarget(game, thingOf(w, who, game), a.turn.into) ?? a.turn.into;
                                }),
                              whoChoices(w, game).filter((who) => !playerId(game, thingOf(w, who, game))),
                            )}
                            <span className="kw">into a</span>
                            {thingSelect(
                              action.turn.into,
                              `${label} into`,
                              (id) => setAction(i, j, (a) => void ("turn" in a && (a.turn.into = id))),
                              turnable(game).filter((id) => id !== thingOf(w, action.turn.who as Who, game)),
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
                        {"protect" in action && (isWho(action.protect.who) || isEvery(action.protect.who)) && (
                          <>
                            {targetSelect(action.protect.who, `${label} which`, (t) => setAction(i, j, (a) => void ("protect" in a && (a.protect.who = t))))}
                            <span className="kw">for</span>
                            {numInput(action.protect.tenths, `${label} tenths`, 1, 255, (v) => setAction(i, j, (a) => void ("protect" in a && (a.protect.tenths = v)), `act:${action.id}`))}
                            <span className="kw">tenths of a second</span>
                          </>
                        )}
                        {"create" in action && isWho(action.create.at as KitTarget) && (
                          <>
                            <span className="kw">a</span>
                            {thingSelect(action.create.type, `${label} what`, (id) => setAction(i, j, (a) => void ("create" in a && (a.create.type = id))))}
                            <select
                              aria-label={`${label} where`}
                              className="fit"
                              style={fit(PLACES.find((p) => p.place === action.create.place)?.label ?? "")}
                              value={action.create.place}
                              onChange={(e) => setAction(i, j, (a) => void ("create" in a && (a.create.place = e.target.value as (typeof PLACES)[number]["place"])))}
                            >
                              {PLACES.map((p) => (
                                <option key={p.place} value={p.place}>
                                  {p.label}
                                </option>
                              ))}
                            </select>
                            {whoSelect(action.create.at as Who, `${label} which`, (who) => setAction(i, j, (a) => void ("create" in a && (a.create.at = who))))}
                          </>
                        )}
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
