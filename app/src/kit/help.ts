// Help for when a kit game won't build: what to take out when it's too busy
// (priced with the same cost model the build checks), and a next step for
// each kind of build error.

import { isPlayer, placements } from "./edit.ts";
import { CPU_BUDGET, cpuCost } from "./generate.ts";
import type { KitTab } from "./presets.ts";
import type { KitGame } from "./schema.ts";
import { plural, ruleSentence } from "./sentence.ts";

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

  /** The game with the first k of one kind taken out of the first room. */
  const without = (i: number, k: number): KitGame => {
    let left = k;
    const ch = Object.entries(g.room.legend).find(([, v]) => v === g.types[i]!.id)?.[0];
    const rows = g.room.rows.map((r) => [...r].map((c) => (c === ch && left-- > 0 ? " " : c)).join(""));
    return { ...g, room: { ...g.room, rows } };
  };
  // Fewest copies of one thing to take out of the room (never the player).
  g.types.forEach((t, i) => {
    const n = placed.filter((p) => p.type === i).length;
    if (n === 0 || isPlayer(t)) return;
    for (let k = 1; k <= n; k++) {
      const after = cpuCost(without(i, k));
      if (after <= CPU_BUDGET || k === n) {
        const what = k === 1 ? `one ${t.label}` : k === n ? `every ${t.label}` : `${k} of the ${n} ${plural(t.label)}`;
        add(`Take ${what} out of the room`, "room", after, k);
        return;
      }
    }
  });
  // One rule to delete.
  g.rules.forEach((r, i) => {
    const after = cpuCost({ ...g, rules: g.rules.filter((_, j) => j !== i) });
    add(`Delete rule ${i + 1}: “${ruleSentence(r, g)}”`, "rules", after, 2);
  });
  // A number on screen costs about as much as a moving thing.
  for (const h of g.hud) {
    const shown = g.counters.find((c) => c.id === h.show);
    if (!shown) continue;
    const after = cpuCost({ ...g, hud: g.hud.filter((x) => x !== h) });
    add(`Stop showing ${shown.label} on screen`, "game", after, 1);
  }

  const now = cpuCost(g);
  const enough = fixes.filter((f) => f.enough).sort((a, b) => a.size - b.size || a.after - b.after);
  const helps = fixes.filter((f) => !f.enough && f.after < now).sort((a, b) => a.after - b.after);
  return (enough.length ? enough : helps).slice(0, max).map(({ size: _, ...f }) => f);
}

const ADVICE: [RegExp, string][] = [
  [/too busy/i, "The meter under the game lists what to take out."],
  [/at least one thing in the room/i, "Open Room, pick a thing's brush and click a square."],
  [/A room can hold/i, "Open Room and erase a few things."],
  [/side by side/i, "Open Room and move some things in that row up or down a row."],
  [/same place/i, "Open Game and untick Show on screen for one counter."],
  [/coming soon/i, "Change that part back, or delete the rule that uses it, for now."],
  [/can hold \d+ things at once/i, "Open Room and erase a few things, or lower how many of a thing rules can create."],
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
