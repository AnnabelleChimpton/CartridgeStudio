// Rules for kit games: "When <trigger>, only if <conditions>, <actions>",
// over the game's own things and counters. Only valid combinations are
// offered (e.g. "the second thing" only exists when two things touch), and
// the rarer parts ("only if", "for N seconds") appear when asked for.

import { useEffect, useId, useRef, useState } from "react";
import { SOUND_LIBRARY } from "../project/templates.ts";
import { isPlayer, moveRule } from "./edit.ts";
import { ruleThing } from "./generate.ts";
import { LEVEL, type KitAction, type KitCondition, type KitGame, type KitRule, type KitTrigger } from "./schema.ts";
import { editableRule, ruleSentence } from "./sentence.ts";
import { useKitStore } from "./store.ts";

type TriggerKind = "touch" | "allGone" | "reachesBottom" | "onHazard" | "onGoal" | "timer" | "every" | "reaches";
type ActionKind =
  | "remove"
  | "respawn"
  | "score"
  | "add"
  | "take"
  | "set"
  | "turn"
  | "turnAll"
  | "loseLife"
  | "win"
  | "lose"
  | "restartRoom"
  | "nextLevel"
  | "sound";
type Who = "first" | "second";

const TRIGGERS: { kind: TriggerKind; label: string }[] = [
  { kind: "touch", label: "touches" },
  { kind: "allGone", label: "are all gone" },
  { kind: "reachesBottom", label: "reaches the bottom" },
  { kind: "onHazard", label: "is on spikes" },
  { kind: "onGoal", label: "is on a goal" },
  { kind: "timer", label: "seconds have passed" },
  { kind: "every", label: "every" },
  { kind: "reaches", label: "reaches" },
];

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
  loseLife: "lose a life",
  win: "win the game",
  lose: "lose the game",
  restartRoom: "start the room again",
  nextLevel: "go to the next level",
  sound: "play a sound",
};

const OPS: { op: KitCondition["op"]; label: string }[] = [
  { op: "eq", label: "is" },
  { op: "ne", label: "isn't" },
  { op: "gte", label: "is at least" },
  { op: "lte", label: "is at most" },
];

const POINTS = [10, 20, 50, 100, 200, 300, 500];

/** Sizes a select to its chosen option, so rules read as sentences without cut-off words. */
const fit = (text: string) => ({ width: `calc(${text.length}ch + 36px)` });

function triggerKind(w: KitTrigger): TriggerKind {
  if ("onTile" in w) return w.onTile[1] === "hazard" ? "onHazard" : "onGoal";
  return Object.keys(w)[0] as TriggerKind;
}
const actionKind = (a: KitAction): ActionKind => Object.keys(a)[0] as ActionKind;

/** The things a rule's actions can point at: both when two touch, one when a single thing triggers it. */
const whoChoices = (w: KitTrigger): Who[] => ("touch" in w ? ["first", "second"] : ruleThing(w, "first") ? ["first"] : []);

const actionWho = (a: KitAction): Who | null => ("remove" in a ? a.remove : "respawn" in a ? a.respawn : "turn" in a ? a.turn.who : null);

/** Kinds of thing that can change into other kinds (never the player). */
const turnable = (g: KitGame) => g.types.filter((t) => !isPlayer(t)).map((t) => t.id);
const playerId = (g: KitGame, id: string | null) => !!id && g.types.some((t) => t.id === id && isPlayer(t));

function defaultTrigger(kind: TriggerKind, g: KitGame, from: KitTrigger): KitTrigger {
  const first = ruleThing(from, "first") ?? ("allGone" in from ? from.allGone : null) ?? g.types[0]!.id;
  const second = g.types.find((t) => t.id !== first)?.id ?? first;
  switch (kind) {
    case "touch":
      return { touch: [first, second] };
    case "allGone":
      return { allGone: first };
    case "reachesBottom":
      return { reachesBottom: first };
    case "onHazard":
    case "onGoal":
      // Usually the player stepping on spikes or reaching the goal.
      return { onTile: [g.types.find(isPlayer)?.id ?? first, kind === "onHazard" ? "hazard" : "goal"] };
    case "timer":
      return { timer: 30 };
    case "every":
      return { every: 10 };
    case "reaches":
      return { reaches: [g.counters[0]?.id ?? LEVEL, 3] };
  }
}

/** A thing to turn `from` into, or null when there's nothing else it could become. */
const turnTarget = (g: KitGame, from: string | null, prefer?: string) => {
  const options = turnable(g).filter((id) => id !== from);
  return prefer && options.includes(prefer) ? prefer : (options[0] ?? null);
};

/** Who a "turn" action can change: a thing in the rule that isn't the player and has something to become. */
const turnWho = (g: KitGame, w: KitTrigger): Who | null => {
  const ok = whoChoices(w).filter((who) => {
    const from = ruleThing(w, who);
    return !playerId(g, from) && turnTarget(g, from) !== null;
  });
  return ok.includes("second") ? "second" : (ok[0] ?? null);
};

function defaultAction(kind: ActionKind, w: KitTrigger, g: KitGame): KitAction {
  const counter = g.counters[0]?.id ?? "";
  switch (kind) {
    case "remove":
      return { remove: "touch" in w ? "second" : "first" };
    case "respawn":
      return { respawn: "touch" in w ? "second" : "first" };
    case "score":
      return { score: 10 };
    case "sound":
      return { sound: SOUND_LIBRARY[0]!.id };
    case "add":
      return { add: [counter, 1] };
    case "take":
      return { take: [counter, 1] };
    case "set":
      return { set: [counter, 0] };
    case "turn": {
      const who = turnWho(g, w) ?? "first";
      return { turn: { who, into: turnTarget(g, ruleThing(w, who))! } };
    }
    case "turnAll": {
      const type = turnable(g)[0]!;
      return { turnAll: { type, into: turnTarget(g, type)! } };
    }
    default:
      return { [kind]: true } as KitAction;
  }
}

/** Actions that make sense for a trigger in this game (`keep` is always offered, so a select never loses its value). */
function actionKinds(w: KitTrigger, g: KitGame, keep?: ActionKind): ActionKind[] {
  const thing = whoChoices(w).length > 0;
  return (Object.keys(ACTION_LABELS) as ActionKind[]).filter((k) => {
    if (k === keep) return true;
    if (k === "remove" || k === "respawn") return thing;
    if (k === "add" || k === "take" || k === "set") return g.counters.length > 0;
    if (k === "turn") return turnWho(g, w) !== null;
    if (k === "turnAll") return turnable(g).length > 1;
    return true;
  });
}

/** After the trigger changes: drops actions about things the rule no longer has. */
function fitActions(r: KitRule, g: KitGame) {
  r.then = r.then.filter((a) => {
    const who = actionWho(a);
    if (!who) return true;
    const thing = ruleThing(r.when, who);
    if (!thing) return false;
    if (!("turn" in a)) return true;
    const into = turnTarget(g, thing, a.turn.into);
    if (playerId(g, thing) || !into) return false;
    a.turn.into = into;
    return true;
  });
  if (r.then.length === 0) r.then = [{ score: 10 }];
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
  const counterName = (id: string) => (id === LEVEL ? "the level" : (game.counters.find((c) => c.id === id)?.label ?? id));
  const setRule = (i: number, recipe: (r: KitRule) => void, key?: string) => edit((d) => recipe(d.rules[i]!), key);
  const setAction = <K extends ActionKind>(i: number, j: number, kind: K, recipe: (a: Extract<KitAction, Record<K, unknown>>) => void, key?: string) =>
    setRule(
      i,
      (r) => {
        const a = r.then[j]!;
        if (kind in a) recipe(a as Extract<KitAction, Record<K, unknown>>);
      },
      key,
    );

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

  const counterSelect = (value: string, label: string, withLevel: boolean, onChange: (id: string) => void) => (
    <select aria-label={label} className="fit" style={fit(counterName(value))} value={value} onChange={(e) => onChange(e.target.value)}>
      {game.counters.map((c) => (
        <option key={c.id} value={c.id}>
          {c.label}
        </option>
      ))}
      {(withLevel || value === LEVEL) && <option value={LEVEL}>the level</option>}
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
              <li key={i} className={liClass} {...dropProps}>
                <div className="rule-row">
                  {handle}
                  <p className="rule-sentence readonly">{ruleSentence(rule, game)}</p>
                </div>
                <div className="rule-tools">
                  <span className="muted small">This rule came from a newer Cartridge Studio, so it can't be changed here. It still works in the game.</span>
                  <span className="spacer" />
                  <button type="button" className="link danger" onClick={() => deleteRule(i)}>
                    Delete rule {n}
                  </button>
                </div>
              </li>
            );
          }

          const w = rule.when;
          const kind = triggerKind(w);
          const conditions = rule.if ?? [];
          const whoLabel = (who: Who) => {
            const thing = ruleThing(w, who);
            return thing ? `the ${name(thing)}` : "the thing";
          };
          const whoSelect = (value: Who, label: string, onChange: (who: Who) => void, choices = whoChoices(w)) => (
            <select aria-label={label} className="fit" style={fit(whoLabel(value))} value={value} onChange={(e) => onChange(e.target.value as Who)}>
              {(choices.includes(value) ? choices : [value, ...choices]).map((who) => (
                <option key={who} value={who}>
                  {whoLabel(who)}
                </option>
              ))}
            </select>
          );
          const seconds = (value: number | undefined, label: string, set: (s: number | undefined) => void) =>
            value ? (
              <>
                <span className="kw">for</span>
                {numInput(value, `${label} seconds`, 1, 60, set)}
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

          return (
            <li key={i} className={liClass} {...dropProps}>
              <div className="rule-row">
                {handle}
                <p className="rule-sentence">
                  <span className="kw">When</span>
                  {"touch" in w &&
                    thingSelect(w.touch[0], `Rule ${n} first thing`, (id) => setRule(i, (r) => ("touch" in r.when && (r.when.touch[0] = id), fitActions(r, game))))}
                  {"allGone" in w && thingSelect(w.allGone, `Rule ${n} thing`, (id) => setRule(i, (r) => void ("allGone" in r.when && (r.when.allGone = id))))}
                  {"reachesBottom" in w &&
                    thingSelect(w.reachesBottom, `Rule ${n} thing`, (id) => setRule(i, (r) => ("reachesBottom" in r.when && (r.when.reachesBottom = id), fitActions(r, game))))}
                  {"onTile" in w &&
                    thingSelect(w.onTile[0], `Rule ${n} thing`, (id) => setRule(i, (r) => ("onTile" in r.when && (r.when.onTile[0] = id), fitActions(r, game))))}
                  {"timer" in w &&
                    numInput(w.timer, `Rule ${n} seconds`, 1, 99, (v) => setRule(i, (r) => void ("timer" in r.when && (r.when.timer = v)), `timer:${i}`))}
                  {"reaches" in w &&
                    counterSelect(w.reaches[0], `Rule ${n} counter`, true, (id) => setRule(i, (r) => void ("reaches" in r.when && (r.when.reaches[0] = id))))}
                  <select
                    aria-label={`Rule ${n} trigger`}
                    className="fit"
                    style={fit(TRIGGERS.find((t) => t.kind === kind)!.label)}
                    value={kind}
                    onChange={(e) =>
                      setRule(i, (r) => {
                        r.when = defaultTrigger(e.target.value as TriggerKind, game, r.when);
                        fitActions(r, game);
                      })
                    }
                  >
                    {TRIGGERS.map((t) => (
                      <option key={t.kind} value={t.kind}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  {"touch" in w &&
                    thingSelect(w.touch[1], `Rule ${n} second thing`, (id) => setRule(i, (r) => ("touch" in r.when && (r.when.touch[1] = id), fitActions(r, game))))}
                  {"every" in w && (
                    <>
                      {numInput(w.every, `Rule ${n} seconds`, 1, 60, (v) => setRule(i, (r) => void ("every" in r.when && (r.when.every = v)), `every:${i}`))}
                      <span className="kw">seconds</span>
                    </>
                  )}
                  {"reaches" in w &&
                    numInput(w.reaches[1], `Rule ${n} target`, 0, 99, (v) => setRule(i, (r) => void ("reaches" in r.when && (r.when.reaches[1] = v)), `reaches:${i}`))}
                  {conditions.map((c, k) => (
                    <span key={k} className="rule-action">
                      <span className="kw">{k === 0 ? ", only if" : "and"}</span>
                      {counterSelect(c.counter, `Rule ${n} condition ${k + 1} counter`, true, (id) => setRule(i, (r) => void (r.if![k]!.counter = id)))}
                      <select
                        aria-label={`Rule ${n} condition ${k + 1} test`}
                        className="fit"
                        style={fit(OPS.find((o) => o.op === c.op)!.label)}
                        value={c.op}
                        onChange={(e) => setRule(i, (r) => void (r.if![k]!.op = e.target.value as KitCondition["op"]))}
                      >
                        {OPS.map((o) => (
                          <option key={o.op} value={o.op}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {numInput(c.value, `Rule ${n} condition ${k + 1} value`, 0, 99, (v) => setRule(i, (r) => void (r.if![k]!.value = v), `if:${i}:${k}`))}
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
                    const ak = actionKind(action);
                    const label = `Rule ${n} action ${j + 1}`;
                    return (
                      <span key={j} className="rule-action">
                        {j > 0 && <span className="kw">and</span>}
                        <select
                          aria-label={label}
                          className="fit"
                          style={fit(ACTION_LABELS[ak])}
                          value={ak}
                          onChange={(e) => setRule(i, (r) => void (r.then[j] = defaultAction(e.target.value as ActionKind, r.when, game)))}
                        >
                          {actionKinds(w, game, ak).map((k) => (
                            <option key={k} value={k}>
                              {ACTION_LABELS[k]}
                            </option>
                          ))}
                        </select>
                        {"remove" in action &&
                          whoSelect(action.remove, `${label} which`, (who) => setAction(i, j, "remove", (a) => void (a.remove = who)))}
                        {"respawn" in action &&
                          whoSelect(action.respawn, `${label} which`, (who) => setAction(i, j, "respawn", (a) => void (a.respawn = who)))}
                        {"score" in action && (
                          <select
                            aria-label={`${label} points`}
                            className="fit"
                            style={fit(String(action.score))}
                            value={action.score}
                            onChange={(e) => setAction(i, j, "score", (a) => void (a.score = Number(e.target.value)))}
                          >
                            {(POINTS.includes(action.score) ? POINTS : [...POINTS, action.score].sort((a, b) => a - b)).map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        )}
                        {"add" in action && (
                          <>
                            {numInput(action.add[1], `${label} amount`, 1, 99, (v) => setAction(i, j, "add", (a) => void (a.add[1] = v), `act:${i}:${j}`))}
                            <span className="kw">to</span>
                            {counterSelect(action.add[0], `${label} counter`, false, (id) => setAction(i, j, "add", (a) => void (a.add[0] = id)))}
                          </>
                        )}
                        {"take" in action && (
                          <>
                            {numInput(action.take[1], `${label} amount`, 1, 99, (v) => setAction(i, j, "take", (a) => void (a.take[1] = v), `act:${i}:${j}`))}
                            <span className="kw">from</span>
                            {counterSelect(action.take[0], `${label} counter`, false, (id) => setAction(i, j, "take", (a) => void (a.take[0] = id)))}
                          </>
                        )}
                        {"set" in action && (
                          <>
                            {counterSelect(action.set[0], `${label} counter`, false, (id) => setAction(i, j, "set", (a) => void (a.set[0] = id)))}
                            <span className="kw">to</span>
                            {numInput(action.set[1], `${label} amount`, 0, 99, (v) => setAction(i, j, "set", (a) => void (a.set[1] = v), `act:${i}:${j}`))}
                          </>
                        )}
                        {"turn" in action && (
                          <>
                            {whoSelect(
                              action.turn.who,
                              `${label} which`,
                              (who) =>
                                setAction(i, j, "turn", (a) => {
                                  a.turn.who = who;
                                  a.turn.into = turnTarget(game, ruleThing(w, who), a.turn.into) ?? a.turn.into;
                                }),
                              whoChoices(w).filter((who) => !playerId(game, ruleThing(w, who))),
                            )}
                            <span className="kw">into a</span>
                            {thingSelect(
                              action.turn.into,
                              `${label} into`,
                              (id) => setAction(i, j, "turn", (a) => void (a.turn.into = id)),
                              turnable(game).filter((id) => id !== ruleThing(w, action.turn.who)),
                            )}
                            {seconds(
                              action.turn.seconds,
                              label,
                              (s) => setAction(i, j, "turn", (a) => (s ? (a.turn.seconds = s) : delete a.turn.seconds), `secs:${i}:${j}`),
                            )}
                          </>
                        )}
                        {"turnAll" in action && (
                          <>
                            {thingSelect(
                              action.turnAll.type,
                              `${label} which`,
                              (id) =>
                                setAction(i, j, "turnAll", (a) => {
                                  a.turnAll.type = id;
                                  a.turnAll.into = turnTarget(game, id, a.turnAll.into) ?? a.turnAll.into;
                                }),
                              turnable(game),
                            )}
                            <span className="kw">into a</span>
                            {thingSelect(
                              action.turnAll.into,
                              `${label} into`,
                              (id) => setAction(i, j, "turnAll", (a) => void (a.turnAll.into = id)),
                              turnable(game).filter((id) => id !== action.turnAll.type),
                            )}
                            {seconds(
                              action.turnAll.seconds,
                              label,
                              (s) => setAction(i, j, "turnAll", (a) => (s ? (a.turnAll.seconds = s) : delete a.turnAll.seconds), `secs:${i}:${j}`),
                            )}
                          </>
                        )}
                        {"sound" in action && (
                          <select
                            aria-label={`${label} sound`}
                            className="fit"
                            style={fit(SOUND_LIBRARY.find((x) => x.id === action.sound)?.label ?? "")}
                            value={action.sound}
                            onChange={(e) => setAction(i, j, "sound", (a) => void (a.sound = e.target.value))}
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
                {rule.then.length < 6 && (
                  <button type="button" className="link" onClick={() => setRule(i, (r) => void r.then.push({ score: 10 }))}>
                    + another action
                  </button>
                )}
                {conditions.length < 2 && (
                  <button
                    type="button"
                    className="link"
                    onClick={() => setRule(i, (r) => void (r.if ??= []).push({ counter: game.counters[0]?.id ?? LEVEL, op: "gte", value: 1 }))}
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
        disabled={game.rules.length >= 16 || game.types.length === 0}
        onClick={() => edit((d) => void d.rules.push({ when: defaultTrigger("touch", d, { allGone: d.types[0]!.id }), then: [{ score: 10 }] }))}
      >
        Add rule
      </button>
    </section>
  );
}
