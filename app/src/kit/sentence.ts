// Rules as plain sentences: for the print kit's manual, and for any rule
// shape the rule editor doesn't know.

import { SOUND_LIBRARY } from "../project/templates.ts";
import { LEVEL, type KitAction, type KitCondition, type KitGame, type KitRule, type KitTrigger } from "./schema.ts";

const OPS: Record<KitCondition["op"], string> = { eq: "is", ne: "isn't", gte: "is at least", lte: "is at most" };

const TRIGGER_KEYS = ["touch", "allGone", "reachesBottom", "timer", "every", "reaches", "onTile"];
const ACTION_KEYS = ["remove", "respawn", "score", "loseLife", "win", "lose", "restartRoom", "sound", "add", "take", "set", "turn", "turnAll", "nextLevel"];

/** True when every part of the rule is something the rule editor offers (all of today's schema; a guard for newer files). */
export function editableRule(r: KitRule): boolean {
  const known = (o: object, keys: string[]) => Object.keys(o).length === 1 && keys.includes(Object.keys(o)[0]!);
  return known(r.when, TRIGGER_KEYS) && r.then.every((a) => known(a, ACTION_KEYS));
}

export function ruleSentence(r: KitRule, g: KitGame): string {
  const name = (id: string) => g.types.find((t) => t.id === id)?.label ?? id;
  const counter = (id: string) => (id === LEVEL ? "the level" : (g.counters.find((c) => c.id === id)?.label ?? id));
  const w: KitTrigger = r.when;
  const thing = (who: "first" | "second") =>
    "touch" in w ? `the ${name(w.touch[who === "first" ? 0 : 1])}` : "reachesBottom" in w ? `the ${name(w.reachesBottom)}` : "onTile" in w ? `the ${name(w.onTile[0])}` : "it";
  const when =
    "touch" in w
      ? `${name(w.touch[0])} touches ${name(w.touch[1])}`
      : "allGone" in w
        ? `every ${name(w.allGone)} is gone`
        : "reachesBottom" in w
          ? `a ${name(w.reachesBottom)} reaches the bottom`
          : "timer" in w
            ? `${w.timer} seconds have passed`
            : "every" in w
              ? `every ${w.every} seconds`
              : "reaches" in w
                ? `${counter(w.reaches[0])} reaches ${w.reaches[1]}`
                : `a ${name(w.onTile[0])} is on ${w.onTile[1] === "hazard" ? "spikes" : "a goal"}`;
  const secs = (s?: number) => (s ? ` for ${s} seconds` : "");
  const action = (a: KitAction): string => {
    if ("remove" in a) return `remove ${thing(a.remove)}`;
    if ("respawn" in a) return `send ${thing(a.respawn)} back to start`;
    if ("score" in a) return `add ${a.score} points`;
    if ("loseLife" in a) return "lose a life";
    if ("win" in a) return "win the game";
    if ("lose" in a) return "lose the game";
    if ("restartRoom" in a) return "start the room again";
    if ("sound" in a) return `play ${SOUND_LIBRARY.find((s) => s.id === a.sound)?.label ?? a.sound}`;
    if ("add" in a) return `add ${a.add[1]} to ${counter(a.add[0])}`;
    if ("take" in a) return `take ${a.take[1]} from ${counter(a.take[0])}`;
    if ("set" in a) return `set ${counter(a.set[0])} to ${a.set[1]}`;
    if ("turn" in a) return `turn ${thing(a.turn.who)} into a ${name(a.turn.into)}${secs(a.turn.seconds)}`;
    if ("turnAll" in a) return `turn every ${name(a.turnAll.type)} into a ${name(a.turnAll.into)}${secs(a.turnAll.seconds)}`;
    return "go to the next level";
  };
  const only = r.if?.length ? `, only if ${r.if.map((c) => `${counter(c.counter)} ${OPS[c.op]} ${c.value}`).join(" and ")}` : "";
  const acts = r.then.map(action);
  const list = acts.length > 1 ? `${acts.slice(0, -1).join(", ")} and ${acts.at(-1)}` : acts[0];
  return `${"every" in w ? "Every" : "When"} ${"every" in w ? when.replace(/^every /, "") : when}${only}: ${list}.`;
}
