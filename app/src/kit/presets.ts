// Kit starter games (templates/kit/games/*.json). Each is a complete game a
// creator can change in any way; together they show what the kit can do.

import { KitGameSchema, type KitGame } from "./schema.ts";

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

const DESCRIPTIONS: Record<string, [string, string]> = {
  shooter: ["A shooter", "A line of vacuums marches down. Shoot them before they land."],
  maze: ["A maze game", "Collect all the yarn while ghosts chase you through the walls."],
  "ghost-panic": ["A chase game", "Catnip makes the ghosts run from you for a few seconds. Mind the spikes; three mazes to clear."],
  dodger: ["A dodging game", "Rocks fall from the sky. Catch the stars and survive."],
};

const IDEAS: Record<string, KitIdea[]> = {
  shooter: [
    { text: "Make the vacuums drop more dust", how: "Pick the Vacuum, open More options and move the Drops slider.", tab: "things", thing: "invader" },
    { text: "Give your ship a faster shot", how: "Pick the Shot, open More options and set Speed to Very fast.", tab: "things", thing: "shot" },
    { text: "Win when every vacuum is gone", how: "In the last rule (when the vacuums are all gone), change “start the room again” to “win the game”.", tab: "rules" },
  ],
  maze: [
    { text: "Make the ghost faster", how: "Pick the Dust ghost, open More options and change its Speed.", tab: "things", thing: "ghost" },
    { text: "Hide more yarn in the corners", how: "Pick the Yarn ball brush and click empty squares.", tab: "room" },
    { text: "Race the clock", how: "Add a rule, choose “seconds have passed” and make it “lose the game”.", tab: "rules" },
  ],
  "ghost-panic": [
    { text: "Make the catnip last longer", how: "In the rule for touching Catnip, change both “6 seconds” to a bigger number.", tab: "rules" },
    { text: "Add spikes to the maze", how: "Pick the Spikes brush and click empty squares. Touching spikes costs a life.", tab: "room" },
    { text: "Start with more lives", how: "Change Lives to 5.", tab: "game" },
  ],
  dodger: [
    { text: "Survive for a whole minute", how: "In the last rule, change 30 seconds to 60.", tab: "rules" },
    { text: "Make the rocks fall faster", how: "Pick the Rock, open More options and change its Speed.", tab: "things", thing: "rock" },
    { text: "Drop more stars to catch", how: "Pick the Star brush and click squares near the top of the room.", tab: "room" },
  ],
};

export const KIT_PRESETS: KitPreset[] = Object.entries(files)
  .filter(([path]) => !path.endsWith(".tests.json"))
  .map(([path, json]) => {
    const id = path.split("/").pop()!.replace(/\.json$/, "");
    const [kind, description] = DESCRIPTIONS[id] ?? ["A game", ""];
    const game = KitGameSchema.parse(json);
    return { id, name: game.title, kind, description, ideas: IDEAS[id] ?? [], game };
  })
  .sort((a, b) => Object.keys(DESCRIPTIONS).indexOf(a.id) - Object.keys(DESCRIPTIONS).indexOf(b.id));
