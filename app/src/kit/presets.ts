// Kit starter games (templates/kit/games/*.json). Each is a complete game a
// creator can change in any way; together they show what the kit can do.

import { loadKit } from "./migrations.ts";
import type { KitGame } from "./schema.ts";

const files = import.meta.glob<unknown>("../../../templates/kit/games/*.json", { import: "default", eager: true });

export interface KitPreset {
  id: string;
  name: string;
  description: string;
  game: KitGame;
}

const DESCRIPTIONS: Record<string, [string, string]> = {
  shooter: ["Shooter", "A formation marches down. Shoot it before it lands."],
  maze: ["Maze", "Collect everything while ghosts chase you through the walls."],
  "ghost-panic": ["Ghost Panic", "Catnip turns the tables for a few seconds. Mind the spikes; three mazes to clear."],
  dodger: ["Dodger", "Rocks fall from the sky. Catch the stars and survive."],
};

export const KIT_PRESETS: KitPreset[] = Object.entries(files)
  .filter(([path]) => !path.endsWith(".tests.json"))
  .map(([path, json]) => {
    const id = path.split("/").pop()!.replace(/\.json$/, "");
    const [name, description] = DESCRIPTIONS[id] ?? [id, ""];
    // Presets go through the same migrations as saves, so an old preset file still loads.
    const loaded = loadKit(json);
    if (!loaded.ok) throw new Error(`The ${id} preset doesn't load: ${loaded.errors.join(" ")}`);
    return { id, name, description, game: loaded.game };
  })
  .sort((a, b) => Object.keys(DESCRIPTIONS).indexOf(a.id) - Object.keys(DESCRIPTIONS).indexOf(b.id));
