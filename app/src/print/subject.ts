// What the print kit shows, from either kind of game: a template project (its
// sprites by role and its manifest's manual) or a kit game (its player, its
// most numerous thing, and rules read as sentences).

import { EASIER_EXTRA_LIVES, easierOn } from "../kit/assist.ts";
import { isPlayer, launchedBy, livesOf, placements, shootsOf } from "../kit/edit.ts";
import { LEVEL, SCORE } from "../kit/schema.ts";
import type { KitGame, KitRule, KitType } from "../kit/schema.ts";
import { ruleSentence } from "../kit/sentence.ts";
import type { Project, Template } from "../project/schema.ts";
import { manualFacts, manualText } from "./manual.ts";
import type { PrintSprite, PrintSubject } from "./pdf.ts";

export function templatePrintSubject(project: Project, template: Template): PrintSubject {
  const sprite = (role: string): PrintSprite | undefined => {
    const s = project.sprites.find((x) => x.role === role);
    if (!s) return undefined;
    const colors = project.palettes.find((p) => p.id === s.palette)?.colors ?? ["$0F", "$0F", "$0F"];
    return { width: s.width, height: s.height, frames: s.frames, colors };
  };
  return {
    title: project.title,
    background: project.background.color,
    hero: sprite("player"),
    crowd: sprite("enemy"),
    extra: sprite("shot"),
    cast: ["player", "enemy", "shot", "bomb"].map(sprite).filter((s): s is PrintSprite => !!s),
    intro: template.manifest.manual?.intro ?? template.manifest.description,
    facts: manualFacts(project, template),
    manual: manualText(project, template),
    controls: (template.manifest.manual?.controls ?? []).map((c): [string, string] => ["", c]),
    scoring: [],
  };
}

const kitSprite = (g: KitGame, t: KitType): PrintSprite => ({
  width: t.width,
  height: t.height,
  frames: t.frames,
  colors: g.palettes.find((p) => p.id === t.palette)?.colors ?? ["$0F", "$0F", "$0F"],
});

/** Shots, bombs and the like: things rules create that aren't placed. */
const isLaunched = (g: KitGame, t: KitType) => !placements(g).some((p) => g.types[p.type] === t) && !!launchedBy(g, t.id);

/** The kit game's player type, if it has one. */
const heroOf = (g: KitGame) => g.types.find(isPlayer);

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const inWords = (n: number) => WORDS[n] ?? String(n);
const labelOf = (g: KitGame, id: string) => g.types.find((t) => t.id === id)?.label ?? id;

/** The level a game is won at, from a "when Level is at least N: win" rule. */
function winLevel(g: KitGame): number | null {
  for (const r of g.rules) {
    const w = r.when;
    if (!("test" in w) || !r.then.some((a) => "gameOver" in a && a.gameOver === "won")) continue;
    const { a, op, b } = w.test;
    if (typeof a === "object" && "counter" in a && a.counter === LEVEL && typeof b === "number") return op === "gte" ? b : op === "gt" ? b + 1 : op === "eq" ? b : null;
  }
  return null;
}

/** The goal in a few words, from the rule that wins or moves on when a kind is all gone ("Clear every Yarn ball three times to win."). */
function goalOf(g: KitGame): string | null {
  for (const r of g.rules) {
    const ends = r.then.some((a) => ("gameOver" in a ? a.gameOver === "won" : "nextRoom" in a || "goRoom" in a || "restartRoom" in a));
    const w = r.when;
    if (!ends || !("test" in w)) continue;
    const { a, op, b } = w.test;
    if (typeof a !== "object" || !("count" in a) || op !== "eq" || b !== 0) continue;
    const what = `Clear every ${labelOf(g, a.count)}`;
    const levelsUp = r.then.some((x) => "add" in x && "counter" in x.add.what && x.add.what.counter === LEVEL);
    const won = winLevel(g);
    const start = g.counters.find((c) => c.id === LEVEL)?.start ?? 1;
    if (levelsUp && won !== null && won - start > 1) return `${what} ${inWords(won - start)} times to win.`;
    const rooms = g.rooms.length + 1;
    return `${what}${rooms > 1 ? ` from all ${inWords(rooms)} rooms` : ""}.`;
  }
  return null;
}

/** A timed turn the player sets off by touching something: "Touch the Catnip and every Ghost turns into a Scared ghost for 6 seconds." */
function turnOf(g: KitGame, hero: KitType): string | null {
  for (const r of g.rules) {
    if (!("touch" in r.when) || r.when.touch[0] !== hero.id) continue;
    for (const a of r.then) {
      if ("turn" in a && a.turn.seconds && typeof a.turn.who === "object" && "every" in a.turn.who) {
        return `Touch the ${labelOf(g, r.when.touch[1])} and every ${labelOf(g, a.turn.who.every)} turns into a ${labelOf(g, a.turn.into)} for ${a.turn.seconds} seconds.`;
      }
    }
  }
  return null;
}

/** The box back's paragraph: who you are, the goal and the most distinctive rule, all read from the game. */
function kitIntro(g: KitGame): string {
  const hero = heroOf(g);
  if (!hero) return "Learn the rules below, then see how far you can get.";
  return [`You are the ${hero.label}.`, goalOf(g), turnOf(g, hero)].filter(Boolean).join(" ");
}

/** Every distinct NTSC color the game uses: its palettes and the background. */
export function kitColorCount(g: KitGame): number {
  return new Set([g.background, ...g.palettes.flatMap((p) => p.colors)].map((c) => c.toUpperCase())).size;
}

/** The game's real inputs, for the manual's controls table: joystick, fire button and console switches. */
export function kitControls(g: KitGame): [string, string][] {
  const hero = heroOf(g);
  const rows: [string, string][] = [];
  if (hero?.control) {
    const c = hero.control;
    const how = c.axes === "lr" ? "Joystick left and right" : c.axes === "ud" ? "Joystick up and down" : c.axes === "4way" ? "Joystick, four ways" : "Joystick, eight ways";
    rows.push([how, c.mode === "keep" ? `Moves the ${hero.label}, who keeps going the last way you pushed` : `Moves the ${hero.label}`]);
    const shot = shootsOf(g, hero.id);
    if (shot) rows.push(["Fire button", `Fires a ${labelOf(g, shot)}`]);
  }
  if (g.flow.title) rows.push(["Fire button on the title screen", "Starts a game"]);
  rows.push(["Pause", "Pauses the game; press again to carry on"], ["Reset", "Back to the title screen"]);
  if (easierOn(g)) rows.push(["Left difficulty switch", `B: everything but you moves at half speed, and you get ${inWords(EASIER_EXTRA_LIVES)} extra lives. A: as made.`]);
  return rows;
}

/** What scores, from every rule that adds a fixed number of points. */
export function kitScoring(g: KitGame): [string, string][] {
  const hero = heroOf(g);
  const rows = new Map<string, number>();
  const what = (r: KitRule): string => {
    const w = r.when;
    if ("touch" in w) {
      const [a, b] = w.touch;
      if (hero && a === hero.id) return labelOf(g, b);
      if (hero && b === hero.id) return labelOf(g, a);
      return `${labelOf(g, a)} meets ${labelOf(g, b)}`;
    }
    if ("destroyed" in w) return `A ${labelOf(g, w.destroyed)} goes`;
    if ("onTile" in w) return w.onTile[1] === "goal" ? "Reaching a goal square" : "Stepping on spikes";
    if ("every" in w) return `Every ${w.every === 1 ? "second" : `${w.every} seconds`}`;
    if ("leaves" in w) return `A ${labelOf(g, w.leaves)} leaves the screen`;
    return ruleSentence(r, g);
  };
  for (const r of g.rules) {
    for (const a of r.then) {
      if ("add" in a && "counter" in a.add.what && a.add.what.counter === SCORE && typeof a.add.by === "number" && a.add.by > 0) {
        const key = what(r);
        if (!rows.has(key)) rows.set(key, a.add.by);
      }
    }
  }
  return [...rows].map(([k, n]) => [k, `${n} ${n === 1 ? "point" : "points"}`]);
}

export function kitFacts(g: KitGame): string[] {
  const actions = g.rules.flatMap((r) => r.then);
  const lives = livesOf(g);
  const facts = lives === null ? [] : [`You start with ${lives} ${lives === 1 ? "life" : "lives"}.`];
  const levels = actions.some((a) => "add" in a && "counter" in a.add.what && a.add.what.counter === LEVEL);
  const pace = g.types.some((t) => t.move.pace || t.steer?.speed.plus || t.control?.speed.plus);
  if (levels) facts.push(pace ? "Clear a level to reach the next one: things get faster as the levels go up." : "Clear a level to reach the next one.");
  if (g.hud.some((h) => h.show === "seconds")) facts.push("Keep an eye on the clock at the top of the screen.");
  for (const h of g.hud) {
    const shown = g.counters.find((c) => c.id === h.show && c.id !== "lives");
    if (shown) facts.push(`Your ${shown.label} is shown at the top of the screen.`);
  }
  if (g.rooms.length) facts.push(`There are ${g.rooms.length + 1} rooms to explore.`);
  return facts;
}

/** The manual written from the game: controls, every rule as a sentence, and a few facts. */
/** The manual written from the game: every rule as a sentence, and a few facts. The controls are the printed table's job. */
export function draftKitManual(g: KitGame): string {
  const out = ["# How to play", kitIntro(g), ""];
  if (g.rules.length) out.push("# Rules", ...g.rules.map((r) => `- ${ruleSentence(r, g)}`), "");
  const facts = kitFacts(g);
  if (facts.length) out.push("# Good to know", ...facts.map((f) => `- ${f}`));
  return out.join("\n").trim() + "\n";
}

export const kitManualText = (g: KitGame) => g.cartridge.manualText ?? draftKitManual(g);

export function kitPrintSubject(g: KitGame): PrintSubject {
  const hero = heroOf(g);
  // The crowd is the most numerous placed thing that isn't the player.
  const counts = new Map<number, number>();
  for (const p of placements(g)) if (!isPlayer(g.types[p.type]!)) counts.set(p.type, (counts.get(p.type) ?? 0) + 1);
  const crowdIndex = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  const crowd = crowdIndex === undefined ? undefined : g.types[crowdIndex];
  const shot = hero && shootsOf(g, hero.id);
  const extra = (shot && g.types.find((t) => t.id === shot)) || g.types.find((t) => t !== hero && t !== crowd && !isLaunched(g, t));
  const cast = [hero, ...g.types.filter((t) => t !== hero && !isLaunched(g, t))].filter((t): t is KitType => !!t).slice(0, 4);
  return {
    title: g.title,
    ...(g.madeBy?.trim() ? { madeBy: g.madeBy.trim() } : {}),
    background: g.background,
    hero: hero && kitSprite(g, hero),
    crowd: crowd && kitSprite(g, crowd),
    extra: extra ? kitSprite(g, extra) : undefined,
    cast: cast.map((t) => kitSprite(g, t)),
    intro: kitIntro(g),
    facts: kitFacts(g),
    manual: kitManualText(g),
    controls: kitControls(g),
    scoring: kitScoring(g),
  };
}
