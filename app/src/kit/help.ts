// Help for when a kit game won't build: what to take out when it's too busy
// (priced with the same cost model the build checks), and a next step for
// each kind of build error.

import { isPlayer, placements } from "./edit.ts";
import { CPU_BUDGET, cpuCost } from "./generate.ts";
import type { KitTab } from "./presets.ts";
import type { KitGame } from "./schema.ts";
import { ruleSentence } from "./sentence.ts";

/** English plurals for thing names ("Dust ghost" → "Dust ghosts"). */
const plural = (s: string) =>
  /(s|x|z|ch|sh)$/i.test(s) ? `${s}es` : /[^aeiou]y$/i.test(s) ? `${s.slice(0, -1)}ies` : `${s}s`;

export interface BusyFix {
  text: string;
  tab: KitTab;
  /** True when this change alone makes the game fit. */
  enough: boolean;
  /** The game's cost after the change. */
  after: number;
}

/** Single changes that make a too-busy game fit, best first; if none does, the ones that help most. */
export function busyFixes(g: KitGame, max = 3): BusyFix[] {
  const placed = placements(g);
  const fixes: (BusyFix & { size: number })[] = [];
  const add = (text: string, tab: KitTab, after: number, size: number) =>
    fixes.push({ text, tab, after, enough: after <= CPU_BUDGET, size });

  // Fewest copies of one thing to take out of the room (never the player).
  g.types.forEach((t, i) => {
    const n = placed.filter((p) => p.type === i).length;
    if (n === 0 || isPlayer(t)) return;
    for (let k = 1; k <= n; k++) {
      let left = k;
      const after = cpuCost(g, placed.filter((p) => p.type !== i || left-- <= 0));
      if (after <= CPU_BUDGET || k === n) {
        const what = k === 1 ? `one ${t.label}` : k === n ? `every ${t.label}` : `${k} of the ${n} ${plural(t.label)}`;
        add(`Take ${what} out of the room`, "room", after, k);
        return;
      }
    }
  });
  // One rule to delete.
  g.rules.forEach((r, i) => {
    const after = cpuCost({ ...g, rules: g.rules.filter((_, j) => j !== i) }, placed);
    add(`Delete rule ${i + 1}: “${ruleSentence(r, g)}”`, "rules", after, 2);
  });
  // A number on screen costs as much as a moving thing.
  const shown = g.counters.find((c) => c.show);
  if (shown) {
    const after = cpuCost({ ...g, counters: g.counters.map((c) => ({ ...c, show: false })) }, placed);
    add(`Stop showing ${shown.label} on screen`, "game", after, 1);
  }

  const now = cpuCost(g, placed);
  const enough = fixes.filter((f) => f.enough).sort((a, b) => a.size - b.size || a.after - b.after);
  const helps = fixes.filter((f) => !f.enough && f.after < now).sort((a, b) => a.after - b.after);
  return (enough.length ? enough : helps).slice(0, max).map(({ size: _, ...f }) => f);
}

const ADVICE: [RegExp, string][] = [
  [/too busy/i, "The meter under the game lists what to take out."],
  [/at least one thing in the room/i, "Open Room, pick a thing's brush and click a square."],
  [/Only one player/i, "Open Room and erase the extra player with the Eraser."],
  [/A room can hold/i, "Open Room and erase a few things."],
  [/side by side/i, "Open Room and move some things in that row up or down a row."],
  [/Only one counter can be shown/i, "Open Game and untick Show on screen for one counter."],
  [/Two counters have the same name/i, "Open Game and rename one of them."],
  [/must be removed or moved back/i, "Add “remove”, “send back to start” or “lose the game” to that rule."],
  [/turns something into itself|can't turn into/i, "Change what that rule turns it into."],
  [/^Rule \d+/i, "Open Rules and change or delete that rule."],
  [/damaged|doesn't exist|isn't in the library|stand for anything/i, "Undo your last change. If that doesn't fix it, start a new game from New game."],
];

/** What to do about a build error, or null when the message already says. */
export function errorAdvice(error: string): string | null {
  return ADVICE.find(([re]) => re.test(error))?.[1] ?? null;
}

/** A build error in plain words (no frame percentages), and what to do about it. */
export function explainError(error: string): { text: string; help: string | null } {
  return { text: error.replace(/ \(it needs \d+% of each frame\)/, ""), help: errorAdvice(error) };
}
