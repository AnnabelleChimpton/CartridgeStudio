// Rules for kit games: "When <trigger>, <actions>", over the game's own things.
// Only valid combinations are offered (e.g. "the second thing" only exists
// when two things touch).

import { SOUND_LIBRARY } from "../project/templates.ts";
import type { KitAction, KitGame, KitRule, KitTrigger } from "./schema.ts";
import { editableRule, ruleSentence } from "./sentence.ts";
import { useKitStore } from "./store.ts";

type TriggerKind = "touch" | "allGone" | "reachesBottom" | "timer";
type ActionKind = "remove" | "respawn" | "score" | "loseLife" | "win" | "lose" | "restartRoom" | "sound";

const TRIGGERS: { kind: TriggerKind; label: string }[] = [
  { kind: "touch", label: "touches" },
  { kind: "allGone", label: "are all gone" },
  { kind: "reachesBottom", label: "reaches the bottom" },
  { kind: "timer", label: "seconds have passed" },
];

// Lower case: they're read mid-sentence ("When …, remove the yarn ball").
const ACTION_LABELS: Record<ActionKind, string> = {
  remove: "remove",
  respawn: "send back to start",
  score: "add points",
  loseLife: "lose a life",
  win: "win the game",
  lose: "lose the game",
  restartRoom: "start the room again",
  sound: "play a sound",
};

/** Sizes a select to its chosen option, so rules read as sentences without cut-off words. */
const fit = (text: string) => ({ width: `calc(${text.length}ch + 30px)` });

const triggerKind = (w: KitTrigger): TriggerKind => Object.keys(w)[0] as TriggerKind;
const actionKind = (a: KitAction): ActionKind => Object.keys(a)[0] as ActionKind;

function defaultTrigger(kind: TriggerKind, g: KitGame, from: KitTrigger): KitTrigger {
  const first = ("touch" in from ? from.touch[0] : "allGone" in from ? from.allGone : "reachesBottom" in from ? from.reachesBottom : null) ?? g.types[0]!.id;
  const second = g.types.find((t) => t.id !== first)?.id ?? first;
  if (kind === "touch") return { touch: [first, second] };
  if (kind === "allGone") return { allGone: first };
  if (kind === "reachesBottom") return { reachesBottom: first };
  return { timer: 30 };
}

function defaultAction(kind: ActionKind, w: KitTrigger): KitAction {
  switch (kind) {
    case "remove":
      return { remove: "touch" in w ? "second" : "first" };
    case "respawn":
      return { respawn: "touch" in w ? "second" : "first" };
    case "score":
      return { score: 10 };
    case "sound":
      return { sound: SOUND_LIBRARY[0]!.id };
    default:
      return { [kind]: true } as KitAction;
  }
}

/** Actions that make sense for a trigger (things to remove only exist when a thing is involved). */
function actionKinds(w: KitTrigger): ActionKind[] {
  const all = Object.keys(ACTION_LABELS) as ActionKind[];
  return "touch" in w || "reachesBottom" in w ? all : all.filter((k) => k !== "remove" && k !== "respawn");
}

export function KitRulesPanel() {
  const game = useKitStore((s) => s.project);
  const edit = useKitStore((s) => s.edit);
  const name = (id: string) => game.types.find((t) => t.id === id)?.label ?? id;
  const setRule = (i: number, recipe: (r: KitRule) => void, key?: string) => edit((d) => recipe(d.rules[i]!), key);

  const thingSelect = (value: string, label: string, onChange: (id: string) => void) => (
    <select aria-label={label} className="fit" style={fit(name(value))} value={value} onChange={(e) => onChange(e.target.value)}>
      {game.types.map((t) => (
        <option key={t.id} value={t.id}>
          {t.label}
        </option>
      ))}
    </select>
  );

  return (
    <section className="panel" aria-labelledby="kit-rules-h">
      <h2 id="kit-rules-h" className="visually-hidden">Rules</h2>
      <p className="muted lead">Rules say what happens in your game. Each one reads as a sentence: change any underlined word.</p>
      <ol className="rules">
        {game.rules.map((rule, i) => {
          if (!editableRule(rule)) {
            return (
              <li key={i} className="rule">
                <p className="rule-sentence readonly">{ruleSentence(rule, game)}</p>
                <div className="rule-tools">
                  <span className="muted small">Uses newer rule words the editor can't change yet.</span>
                  <span className="spacer" />
                  <button type="button" className="link danger" onClick={() => edit((d) => void d.rules.splice(i, 1))}>
                    Delete rule {i + 1}
                  </button>
                </div>
              </li>
            );
          }
          const w = rule.when;
          const kind = triggerKind(w);
          const n = i + 1;
          return (
            <li key={i} className="rule">
              <p className="rule-sentence">
                <span className="kw">When</span>
                {"touch" in w &&
                  thingSelect(w.touch[0], `Rule ${n} first thing`, (id) => setRule(i, (r) => void ("touch" in r.when && (r.when.touch[0] = id))))}
                {"allGone" in w && thingSelect(w.allGone, `Rule ${n} thing`, (id) => setRule(i, (r) => void ("allGone" in r.when && (r.when.allGone = id))))}
                {"reachesBottom" in w &&
                  thingSelect(w.reachesBottom, `Rule ${n} thing`, (id) => setRule(i, (r) => void ("reachesBottom" in r.when && (r.when.reachesBottom = id))))}
                {"timer" in w && (
                  <input
                    type="number"
                    className="num fit"
                    aria-label={`Rule ${n} seconds`}
                    min={1}
                    max={99}
                    value={w.timer}
                    onChange={(e) =>
                      setRule(i, (r) => void ("timer" in r.when && (r.when.timer = Math.max(1, Math.min(99, Number(e.target.value) || 1)))), `timer:${i}`)
                    }
                  />
                )}
                <select
                  aria-label={`Rule ${n} trigger`}
                  className="fit"
                  style={fit(TRIGGERS.find((t) => t.kind === kind)!.label)}
                  value={kind}
                  onChange={(e) =>
                    setRule(i, (r) => {
                      r.when = defaultTrigger(e.target.value as TriggerKind, game, r.when);
                      // Drop actions the new trigger can't do.
                      const allowed = actionKinds(r.when);
                      r.then = r.then.filter((a) => allowed.includes(actionKind(a)) && !("remove" in a && a.remove === "second" && !("touch" in r.when)) && !("respawn" in a && a.respawn === "second" && !("touch" in r.when)));
                      if (r.then.length === 0) r.then = [{ score: 10 }];
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
                  thingSelect(w.touch[1], `Rule ${n} second thing`, (id) => setRule(i, (r) => void ("touch" in r.when && (r.when.touch[1] = id))))}
                <span className="kw">,</span>
              {rule.then.map((action, j) => {
                const ak = actionKind(action);
                const whichLabel =
                  "remove" in action || "respawn" in action
                    ? `the ${"touch" in w ? name(w.touch[("remove" in action ? action.remove : action.respawn) === "second" ? 1 : 0]) : "reachesBottom" in w ? name(w.reachesBottom) : "thing"}`
                    : "";
                return (
                  <span key={j} className="rule-action">
                    {j > 0 && <span className="kw">and</span>}
                    <select
                      aria-label={`Rule ${n} action ${j + 1}`}
                      className="fit"
                      style={fit(ACTION_LABELS[ak])}
                      value={ak}
                      onChange={(e) => setRule(i, (r) => void (r.then[j] = defaultAction(e.target.value as ActionKind, r.when)))}
                    >
                      {actionKinds(w).map((k) => (
                        <option key={k} value={k}>
                          {ACTION_LABELS[k]}
                        </option>
                      ))}
                    </select>
                    {("remove" in action || "respawn" in action) && (
                      <select
                        aria-label={`Rule ${n} action ${j + 1} which`}
                        className="fit"
                        style={fit(whichLabel)}
                        value={"remove" in action ? action.remove : action.respawn}
                        onChange={(e) =>
                          setRule(i, (r) => {
                            const a = r.then[j]!;
                            const who = e.target.value as "first" | "second";
                            if ("remove" in a) a.remove = who;
                            if ("respawn" in a) a.respawn = who;
                          })
                        }
                      >
                        {"touch" in w ? (
                          <>
                            <option value="first">the {name(w.touch[0])}</option>
                            <option value="second">the {name(w.touch[1])}</option>
                          </>
                        ) : (
                          <option value="first">the {"reachesBottom" in w ? name(w.reachesBottom) : "thing"}</option>
                        )}
                      </select>
                    )}
                    {"score" in action && (
                      <select
                        aria-label={`Rule ${n} action ${j + 1} points`}
                        className="fit"
                        style={fit(String(action.score))}
                        value={action.score}
                        onChange={(e) => setRule(i, (r) => void ("score" in r.then[j]! && ((r.then[j] as { score: number }).score = Number(e.target.value))))}
                      >
                        {[10, 20, 50, 100, 200, 500].map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    )}
                    {"sound" in action && (
                      <select
                        aria-label={`Rule ${n} action ${j + 1} sound`}
                        className="fit"
                        style={fit(SOUND_LIBRARY.find((x) => x.id === action.sound)?.label ?? "")}
                        value={action.sound}
                        onChange={(e) => setRule(i, (r) => void ("sound" in r.then[j]! && ((r.then[j] as { sound: string }).sound = e.target.value)))}
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
              <div className="rule-tools">
                {rule.then.length < 6 && (
                  <button type="button" className="link" onClick={() => setRule(i, (r) => void r.then.push({ score: 10 }))}>
                    + another action
                  </button>
                )}
                <span className="spacer" />
                <button type="button" className="link danger" onClick={() => edit((d) => void d.rules.splice(i, 1))}>
                  Delete rule {n}
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <button
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
