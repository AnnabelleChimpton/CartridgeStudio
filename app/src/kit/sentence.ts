// Rules as plain sentences: for the print kit's manual, the generated code's
// rem lines, and any rule the rule editor can't change yet (it shows the
// sentence instead). Every rule the schema allows has a sentence.

import { SOUND_LIBRARY } from "../project/templates.ts";
import { SCORE, SECONDS, type KitAction, type KitCompare, type KitGame, type KitRule, type KitTarget, type KitTrigger, type KitValue } from "./schema.ts";
import { itTypes, stateDefault, triggerThing } from "./ir.ts";

const OPS: Record<KitCompare["op"], string> = { eq: "is", ne: "isn't", gt: "is more than", gte: "is at least", lt: "is less than", lte: "is at most" };
const SIDE: Record<string, string> = {
  left: "the left edge",
  right: "the right edge",
  top: "the top edge",
  bottom: "the bottom edge",
  sides: "the left or right edge",
  any: "an edge",
};
const WALL_SIDE: Record<string, string> = { left: "on its left", right: "on its right", top: "above it", bottom: "below it", any: "" };
const PROP: Record<string, string> = { x: "x", y: "y", vx: "speed across", vy: "speed down", facing: "facing", a: "a", b: "b", timer: "timer" };

const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : (xs[0] ?? ""));

export function ruleSentence(r: KitRule, g: KitGame): string {
  const name = (id: string) => g.types.find((t) => t.id === id)?.label ?? id;
  const counter = (id: string) => (id === SCORE ? "the score" : id === SECONDS ? "the seconds" : id === "room" ? "the room number" : (g.counters.find((c) => c.id === id)?.label ?? id));
  const w: KitTrigger = r.when;
  const its = itTypes(w, g);
  const other = triggerThing(w, "other");
  const itName = its.length === 1 ? `the ${name(its[0]!)}` : "it";
  const varName = (t: KitGame["types"][number] | undefined, p: "a" | "b") => t?.vars?.[p]?.name;
  /** "its x", "the Ghost's speed across", "every Vacuum's …" */
  const whose = (of: "it" | "other" | "target", prop: string, targetName?: string) => {
    const kind = of === "it" ? its[0] : of === "other" ? other : undefined;
    const label = (prop === "a" || prop === "b" ? varName(g.types.find((t) => t.id === kind), prop) : undefined) ?? PROP[prop] ?? prop;
    if (of === "it") return its.length === 1 && other ? `the ${name(its[0]!)}'s ${label}` : `its ${label}`;
    if (of === "other") return other ? `the ${name(other)}'s ${label}` : `the other's ${label}`;
    return targetName ? `${targetName}'s ${label}` : `its ${label}`;
  };
  const value = (v: KitValue): string => {
    if (typeof v === "number") return String(v);
    let s: string;
    if ("counter" in v) s = counter(v.counter);
    else if ("prop" in v) s = whose(v.of, v.prop);
    else if ("count" in v) s = `the number of ${name(v.count)}`;
    else if ("random" in v) s = `a random number up to ${v.random}`;
    else if ("joy" in v) s = `joystick ${v.joy}'s ${v.axis === "x" ? "left-right" : "up-down"} push`;
    else if ("facing" in v) s = `${whose(v.of, "facing")} ${v.facing === "x" ? "across" : "down"}`;
    else s = `${v.of === "it" ? "it" : v.of === "other" ? "the other" : "it"} being against a wall ${WALL_SIDE[v.contact]} (1 or 0)`;
    if (v.times && v.times > 1) s += ` × ${v.times}`;
    if (v.div) s += ` ÷ ${v.div}`;
    if (v.neg) s += ", reversed";
    if (v.plus) s += v.plus > 0 ? ` + ${v.plus}` : ` − ${-v.plus}`;
    return s;
  };
  const compare = (c: KitCompare) => `${value(c.a)} ${OPS[c.op]} ${value(c.b)}`;
  const target = (t: KitTarget): string => {
    if (t === "it") return itName;
    if (t === "other") return other ? `the ${name(other)}` : "the other";
    if ("every" in t) return `every ${name(t.every)}${t.where ? ` whose ${compare(t.where).replace(/^its /, "")}` : ""}`;
    if ("nearest" in t) return `the nearest ${name(t.nearest)}`;
    return `a random ${name(t.random)}`;
  };
  const targetKind = (t: KitTarget) => (t === "it" ? its[0] : t === "other" ? other : "every" in t ? t.every : "nearest" in t ? t.nearest : t.random);
  const owner = (t: KitTarget) => {
    const s = target(t);
    return s === "it" ? "its" : `${s}'s`;
  };

  const fires = r.fires ?? stateDefault(w);
  const any = r.any ? "any " : "a ";
  let when: string;
  if ("touch" in w) when = `${r.any ? "any " : ""}${name(w.touch[0])} touches ${name(w.touch[1])}`;
  else if ("onTile" in w) when = `${any}${name(w.onTile[0])} is on ${w.onTile[1] === "hazard" ? "spikes" : "a goal"}`;
  else if ("edge" in w) when = `${any}${name(w.edge[0])} reaches ${SIDE[w.edge[1]]}`;
  else if ("wall" in w) when = `${any}${name(w.wall[0])} is against a wall${WALL_SIDE[w.wall[1]] ? ` ${WALL_SIDE[w.wall[1]]}` : ""}`;
  else if ("leaves" in w) when = `a ${name(w.leaves)} leaves the screen`;
  else if ("timerOut" in w) when = `a ${name(w.timerOut)}'s timer runs out`;
  else if ("created" in w) when = `a ${name(w.created)} appears`;
  else if ("destroyed" in w) when = `a ${name(w.destroyed)} is removed`;
  else if ("button" in w) when = `button ${w.button.button} is ${w.button.released ? "let go" : "pressed"}${w.button.joy === 2 ? " on joystick 2" : ""}`;
  else if ("pushed" in w) when = `joystick ${w.pushed.joy} is pushed${w.pushed.dir === "any" ? "" : ` ${w.pushed.dir}`}`;
  else if ("every" in w) when = w.every === 1 ? `every ${w.frames ? "frame" : "second"}` : `every ${w.every} ${w.frames ? "frames" : "seconds"}`;
  else if ("after" in w) when = `${w.after} seconds have passed`;
  else if ("roomStart" in w) when = "the room starts";
  else if ("test" in w) when = compare(w.test);
  else when = `the message "${w.message}" is sent`;

  const secs = (s?: number) => (s ? ` for ${s} seconds` : "");
  const action = (a: KitAction): string => {
    const settable = (verb: "set" | "add" | "take", what: { counter: string } | { prop: string; of: KitTarget }, v: KitValue) => {
      if ("counter" in what) {
        if (what.counter === SCORE) return verb === "add" ? `add ${value(v)} points` : verb === "take" ? `take ${value(v)} points` : "set the score to 0";
        return verb === "set" ? `set ${counter(what.counter)} to ${value(v)}` : verb === "add" ? `add ${value(v)} to ${counter(what.counter)}` : `take ${value(v)} from ${counter(what.counter)}`;
      }
      const label = what.prop === "a" || what.prop === "b" ? (varName(g.types.find((t) => t.id === targetKind(what.of)), what.prop) ?? what.prop) : (PROP[what.prop] ?? what.prop);
      // "every Weaver whose …'s x" doesn't read: "the x of every Weaver whose …" does.
      const thing = typeof what.of === "object" && "every" in what.of && what.of.where ? `the ${label} of ${target(what.of)}` : `${owner(what.of)} ${label}`;
      return verb === "set" ? `set ${thing} to ${value(v)}` : verb === "add" ? `add ${value(v)} to ${thing}` : `take ${value(v)} from ${thing}`;
    };
    if ("set" in a) return settable("set", a.set.what, a.set.to);
    if ("add" in a) return settable("add", a.add.what, a.add.by);
    if ("take" in a) return settable("take", a.take.what, a.take.by);
    if ("step" in a) return `step ${target(a.step.who)} by (${value(a.step.dx)}, ${value(a.step.dy)})`;
    if ("create" in a) {
      const c = a.create;
      const at =
        typeof c.at === "object" && "x" in c.at
          ? `at (${value(c.at.x)}, ${value(c.at.y)})`
          : `${c.place === "above" ? "above" : c.place === "below" ? "below" : c.place === "centre" ? "in the middle of" : "at"} ${target(c.at as KitTarget)}`;
      const off = c.dx || c.dy ? `, moved (${c.dx ?? 0}, ${c.dy ?? 0})` : "";
      const vel = c.vx !== undefined || c.vy !== undefined ? `, moving (${c.vx !== undefined ? value(c.vx) : 0}, ${c.vy !== undefined ? value(c.vy) : 0})` : "";
      return `create a ${name(c.type)} ${at}${off}${vel}`;
    }
    if ("destroy" in a) return `remove ${target(a.destroy)}`;
    if ("turn" in a) return `turn ${target(a.turn.who)} into a ${name(a.turn.into)}${secs(a.turn.seconds)}`;
    if ("toStart" in a) return `send ${target(a.toStart)} back to start`;
    if ("startHere" in a) return `make this ${target(a.startHere).replace(/^the /, "the ")}'s start`;
    if ("protect" in a) return `protect ${target(a.protect.who)} for ${a.protect.tenths / 10} seconds`;
    if ("sound" in a) return `play ${SOUND_LIBRARY.find((s) => s.id === a.sound)?.label ?? a.sound}`;
    if ("send" in a) return `send the message "${a.send}"`;
    if ("restartRoom" in a) return "start the room again";
    if ("goRoom" in a) return `go to room ${a.goRoom}`;
    if ("nextRoom" in a) return "go to the next room";
    if ("resetTaken" in a) return "bring back the things taken from every room";
    if ("gameOver" in a) return a.gameOver === "won" ? "win the game" : "lose the game";
    return `run your code "${a.run}"`;
  };
  const only = r.if?.length ? `, only if ${r.if.map(compare).join(" and ")}` : "";
  const lead = "every" in w ? "" : fires === "while" && !("touch" in w || "onTile" in w) ? "While " : "When ";
  const once = fires === "once" && ("touch" in w || "onTile" in w) ? " (once)" : "";
  const whenText = "every" in w ? when.charAt(0).toUpperCase() + when.slice(1) : when;
  return `${lead}${whenText}${once}${only}: ${list(r.then.map(action))}.`;
}
