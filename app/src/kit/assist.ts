// The "easier" assist for younger players, worked by the console's left
// difficulty switch the way 7800 and 2600 games are: with the assist on, the
// switch's B position (the console's usual "novice" setting) plays easier and
// A plays the game as made. With it off, the switch does nothing.
//
// Easier means other things move one speed step slower and the lives counter
// starts two higher. The player, and what the player shoots, keep their speed.
//
// The setting lives on the game as `assist`. The kit schema doesn't list it
// yet, so loadKit carries it through by hand (see readAssist).

import { livesOf, shootsOf } from "./edit.ts";
import { isControlled } from "./parts.ts";
import type { KitGame, KitType } from "./schema.ts";

export interface Assist {
  easier: boolean;
}

export const EASIER_EXTRA_LIVES = 2;
/** The HUD shows lives as one digit. */
const MAX_LIVES = 9;

type WithAssist = KitGame & { assist?: Assist };

/** The assist stored on a raw game, if it's well formed. */
export function readAssist(raw: unknown): Assist | undefined {
  const a = (raw as { assist?: unknown } | null)?.assist;
  if (typeof a !== "object" || a === null) return undefined;
  const easier = (a as { easier?: unknown }).easier;
  return typeof easier === "boolean" ? { easier } : undefined;
}

export const easierOn = (g: KitGame) => !!(g as WithAssist).assist?.easier;

export function setEasier(g: KitGame, on: boolean) {
  const d = g as WithAssist;
  if (on) d.assist = { easier: true };
  else delete d.assist;
}

/** True for a type the assist slows: anything but a controlled thing and its shots. */
export function slowedByAssist(g: KitGame, t: KitType): boolean {
  if (isControlled(t)) return false;
  return !g.types.some((p) => isControlled(p) && shootsOf(g, p.id) === t.id);
}

export const easierLives = (lives: number) => Math.min(MAX_LIVES, lives + EASIER_EXTRA_LIVES);

/**
 * What the generator needs: a flag for the template and one byte per type
 * for a `typeslow` table (1 = one speed step slower when easier).
 */
export function assistData(g: KitGame): { hasEasier: boolean; typeslow: number[]; easierLives: number } {
  return {
    hasEasier: easierOn(g),
    typeslow: g.types.map((t) => (slowedByAssist(g, t) ? 1 : 0)),
    easierLives: easierLives(livesOf(g) ?? 3),
  };
}
