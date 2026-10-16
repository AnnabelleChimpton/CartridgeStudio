// What the print kit shows, from either kind of game: a template project (its
// sprites by role and its manifest's manual) or a kit game (its player, its
// most numerous thing, and rules read as sentences).

import { isPlayer, launchedBy, livesOf, placements, shootsOf } from "../kit/edit.ts";
import { LEVEL } from "../kit/schema.ts";
import type { KitGame, KitType } from "../kit/schema.ts";
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
    hero: sprite("player"),
    crowd: sprite("enemy"),
    extra: sprite("shot"),
    cast: ["player", "enemy", "shot", "bomb"].map(sprite).filter((s): s is PrintSprite => !!s),
    intro: template.manifest.manual?.intro ?? template.manifest.description,
    facts: manualFacts(project, template),
    manual: manualText(project, template),
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

function kitIntro(g: KitGame): string {
  const hero = heroOf(g);
  return hero
    ? `You are the ${hero.label}. Learn the rules below, then see how far you can get.`
    : "Learn the rules below, then see how far you can get.";
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
export function draftKitManual(g: KitGame): string {
  const hero = heroOf(g);
  const out = ["# How to play", kitIntro(g), "", "# Controls"];
  if (hero) {
    const how = hero.control?.axes === "lr" ? "left and right" : hero.control?.axes === "ud" ? "up and down" : "around";
    out.push(`- Move the ${hero.label} ${how} with the joystick (or the arrow keys).`);
    const shot = shootsOf(g, hero.id);
    if (shot) out.push(`- Press the fire button (or Space) to fire a ${g.types.find((t) => t.id === shot)?.label ?? "shot"}.`);
  }
  out.push("- Press fire to start, and again after the game ends.", "");
  if (g.rules.length) out.push("# Rules", ...g.rules.map((r) => `- ${ruleSentence(r, g)}`), "");
  out.push("# Good to know", ...kitFacts(g).map((f) => `- ${f}`));
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
    hero: hero && kitSprite(g, hero),
    crowd: crowd && kitSprite(g, crowd),
    extra: extra ? kitSprite(g, extra) : undefined,
    cast: cast.map((t) => kitSprite(g, t)),
    intro: kitIntro(g),
    facts: kitFacts(g),
    manual: kitManualText(g),
  };
}
