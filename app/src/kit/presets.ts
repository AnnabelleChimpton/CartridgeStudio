// Kit starter games (templates/kit/games/*.json). Each is a complete game a
// creator can change in any way; together they show what the kit can do.

import { loadKit } from "./migrations.ts";
import type { KitGame } from "./schema.ts";
import { NumberWord, numberWord } from "../ui/words.ts";

const files = import.meta.glob<unknown>("../../../templates/kit/games/*.json", { import: "default", eager: true });

/** The kit editor's tabs, which an idea can open. */
export type KitTab = "things" | "room" | "rules" | "game";

/** A "Try this" idea: a first change that shows off what the starter can do. */
export interface KitIdea {
  text: string;
  /** Where to make the change, in plain words. */
  how: string;
  tab: KitTab;
  /** The thing to pick when the idea opens the Things tab. */
  thing?: string;
}

export interface KitPreset {
  id: string;
  /** The game's own title, so the card and the game agree. */
  name: string;
  /** What kind of game it is ("A shooter"). */
  kind: string;
  description: string;
  ideas: KitIdea[];
  game: KitGame;
}

/** The first `turn` that lasts a while in the game's rules, in seconds. */
function turnSeconds(g: KitGame, into: string): number | undefined {
  for (const r of g.rules) for (const a of r.then) if ("turn" in a && a.turn.into === into && a.turn.seconds) return a.turn.seconds;
  return undefined;
}

/** The first "every N seconds" rule that turns things into `into`. */
function everySeconds(g: KitGame, into: string): number | undefined {
  for (const r of g.rules) if ("every" in r.when && !r.when.frames && r.then.some((a) => "turn" in a && a.turn.into === into)) return r.when.every;
  return undefined;
}

/** How long a game lasts, from its "after N seconds" rule. */
function afterSeconds(g: KitGame): number | undefined {
  for (const r of g.rules) if ("after" in r.when) return r.when.after;
  return undefined;
}

/** How many levels a game has: its winning "level is at least N" test, counted from the level counter's start. */
function levels(g: KitGame): number | undefined {
  const start = g.counters.find((c) => c.id === "level")?.start;
  for (const r of g.rules) {
    const t = "test" in r.when ? r.when.test : undefined;
    if (start !== undefined && t && typeof t.a === "object" && "counter" in t.a && t.a.counter === "level" && t.op === "gte" && typeof t.b === "number" && r.then.some((a) => "gameOver" in a))
      return t.b - start;
  }
  return undefined;
}

/** The counters things add to their speed (a speed's "plus"), wherever a movement part keeps it. */
function paceCounters(x: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(x)) x.forEach((v) => paceCounters(v, out));
  else if (x && typeof x === "object")
    for (const [k, v] of Object.entries(x)) {
      if (k === "plus" && typeof v === "string") out.add(v);
      else paceCounters(v, out);
    }
  return out;
}

/** Whether a rule raises a pace counter, so the game gets faster as it goes. */
function speedsUp(g: KitGame): boolean {
  const pace = paceCounters(g.types);
  return g.rules.some((r) => r.then.some((a) => "set" in a && "counter" in a.set.what && pace.has(a.set.what.counter) && typeof a.set.to === "number" && a.set.to > 0));
}

const seconds = (n: number | undefined, fallback: string) => (n === undefined ? fallback : `${numberWord(n)} second${n === 1 ? "" : "s"}`);

/** Each starter's kind and description, worked out from the game so the numbers stay true when the file changes. */
const DESCRIPTIONS: Record<string, (g: KitGame) => [string, string]> = {
  shooter: () => ["A shooter", "A line of vacuums marches down. Throw socks at them before they reach the floor."],
  maze: () => ["A maze game", "Collect all the yarn while dust ghosts chase you round the maze."],
  "ghost-panic": (g) => {
    const mazes = levels(g);
    return [
      "A chase game",
      `Catnip scares the ghosts for ${seconds(turnSeconds(g, "scared"), "a while")}; catch them while it lasts. Mind the spikes.${mazes ? ` Clear the maze ${numberWord(mazes)} times${speedsUp(g) ? "; it gets faster" : ""}.` : ""}`,
    ];
  },
  dodger: (g) => ["A dodging game", `Teacups fall for ${seconds(afterSeconds(g), "a while")}. Weave between them and catch the fish.`],
  "key-quest": (g) => [
    "An adventure",
    `${NumberWord(1 + g.rooms.length)} rooms, a key, a locked door and a crown. Shadows follow you from room to room.`,
  ],
};

/** Ideas follow what each starter has to change, so some have more than others. */
const IDEAS: Record<string, (g: KitGame) => KitIdea[]> = {
  shooter: () => [
    { text: "Make the vacuums drop more dust", how: "Pick the Vacuum, open More options and move the Drops slider.", tab: "things", thing: "invader" },
    { text: "Throw socks faster", how: "Pick the Sock, open More options and set Speed to Very fast.", tab: "things", thing: "shot" },
    { text: "Win when every vacuum is gone", how: "In the rule for when the vacuums are all gone, change “start the room again” to “win the game”.", tab: "rules" },
  ],
  maze: () => [
    { text: "Make the ghost faster", how: "Pick the Dust ghost, open More options and change its Speed.", tab: "things", thing: "ghost" },
    { text: "Hide more yarn in the corners", how: "Pick the Yarn ball brush and click empty squares.", tab: "room" },
    { text: "Race the clock", how: "Add a rule, choose “seconds have passed” and make it “lose the game”.", tab: "rules" },
  ],
  "ghost-panic": (g) => {
    const catnip = turnSeconds(g, "scared");
    const speedUp = everySeconds(g, "fast-ghost");
    return [
      catnip && { text: "Make the catnip last longer", how: `In the rule for touching Catnip, change both “${catnip} seconds” to a bigger number.`, tab: "rules" },
      { text: "Add spikes to the maze", how: "Pick the Spikes brush and click empty squares. Touching spikes costs a life.", tab: "room" },
      { text: "Start with more lives", how: "Change Lives to 5.", tab: "game" },
      speedUp && { text: "Let the ghosts speed up less often", how: `In the rule “Every ${speedUp} seconds”, change ${speedUp} to a bigger number.`, tab: "rules" },
    ].filter((i): i is KitIdea => !!i);
  },
  "key-quest": () => [
    { text: "Make the shadows faster", how: "Pick the Shadow and change its Speed under More options.", tab: "things", thing: "shadow" },
    { text: "Hide another gem", how: "Pick the Gem brush and click a square in the first room.", tab: "room" },
    { text: "Start with more lives", how: "Change Lives to 5.", tab: "game" },
  ],
  dodger: (g) => {
    const s = afterSeconds(g);
    return [
      s && { text: "Last for a whole minute", how: `In the rule “When ${s} seconds have passed”, change ${s} to 60.`, tab: "rules" },
      { text: "Make the teacups fall faster", how: "Pick the Teacup, open More options and change its Speed.", tab: "things", thing: "teacup" },
    ].filter((i): i is KitIdea => !!i);
  },
};

export const KIT_PRESETS: KitPreset[] = Object.entries(files)
  .filter(([path]) => !path.endsWith(".tests.json"))
  .map(([path, json]) => {
    const id = path.split("/").pop()!.replace(/\.json$/, "");
    // Presets go through the same migrations as saves, so an old preset file still loads.
    const loaded = loadKit(json);
    if (!loaded.ok) throw new Error(`The ${id} preset doesn't load: ${loaded.errors.join(" ")}`);
    const game = loaded.game;
    const [kind, description] = DESCRIPTIONS[id]?.(game) ?? ["A game", ""];
    return { id, name: game.title, kind, description, ideas: IDEAS[id]?.(game) ?? [], game };
  })
  .sort((a, b) => Object.keys(DESCRIPTIONS).indexOf(a.id) - Object.keys(DESCRIPTIONS).indexOf(b.id));
