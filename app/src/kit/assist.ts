// The "easier" assist for younger players, worked by the console's left
// difficulty switch the way 7800 and 2600 games are: with the assist on, the
// switch's B position (the console's usual "novice" setting) plays easier and
// A plays the game as made. With it off, the switch does nothing.
//
// Easier means other things move at half speed and the player starts with two
// extra lives. The player, and what the player shoots, keep their speed.
//
// The setting lives on the game as `assist`. The kit schema doesn't list it
// yet, so loadKit carries it through by hand (see readAssist).

import { PLAYER_BEHAVIOURS, type KitGame, type KitType } from "./schema.ts";

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

/** True for a type the assist slows: anything but the player and its shots. */
export function slowedByAssist(g: KitGame, t: KitType): boolean {
  if (PLAYER_BEHAVIOURS.includes(t.behaviour)) return false;
  return !g.types.some((p) => PLAYER_BEHAVIOURS.includes(p.behaviour) && p.shoots === t.id);
}

/**
 * A type's speed (1-4: a quarter, half, one or two pixels a frame) when the
 * game plays easier. Each step down halves it; a quarter pixel a frame is the
 * slowest the runtime moves, so speed 1 stays 1.
 */
export function easierSpeed(g: KitGame, t: KitType): number {
  return slowedByAssist(g, t) ? Math.max(1, t.speed - 1) : t.speed;
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
    easierLives: easierLives(g.lives),
  };
}
