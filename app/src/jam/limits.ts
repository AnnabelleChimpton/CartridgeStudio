// Jam limits the app can check. Going past one is flagged for the organizer
// and judges to weigh, never refused: a jam's rules are the organizer's call.

import { strFromU8, unzipSync } from "fflate";
import { z } from "zod";
import { KitGameSchema, type KitGame } from "../kit/schema.ts";

const n = (max: number) => z.number().int().min(1).max(max).optional();

export const LimitsSchema = z
  .object({
    /** Kinds of thing (player, enemies, items...). */
    maxTypes: n(64),
    maxRules: n(64),
    maxCounters: n(64),
    /** Palettes: each is three colours. */
    maxPalettes: n(64),
    /** The .a78 file's size. */
    maxRomKB: n(1024),
  })
  .strict();
export type Limits = z.infer<typeof LimitsSchema>;

export const LIMIT_LABELS: Record<keyof Limits, string> = {
  maxTypes: "Kinds of thing",
  maxRules: "Rules",
  maxCounters: "Counters",
  maxPalettes: "Palettes",
  maxRomKB: "ROM size (KB)",
};

/** What can be measured about a game; kit facts are missing for games made other ways. */
export interface GameFacts {
  types?: number;
  rules?: number;
  counters?: number;
  palettes?: number;
  romBytes?: number;
}

export const kitFacts = (g: KitGame): GameFacts => ({
  types: g.types.length,
  rules: g.rules.length,
  counters: g.counters.length,
  palettes: g.palettes.length,
});

/** One plain sentence per limit the game goes past. */
export function checkLimits(limits: Limits, facts: GameFacts): string[] {
  const out: string[] = [];
  const over = (have: number | undefined, max: number | undefined, what: string) => {
    if (have !== undefined && max !== undefined && have > max) out.push(`${what}: ${have}, over the limit of ${max}.`);
  };
  over(facts.types, limits.maxTypes, "Kinds of thing");
  over(facts.rules, limits.maxRules, "Rules");
  over(facts.counters, limits.maxCounters, "Counters");
  over(facts.palettes, limits.maxPalettes, "Palettes");
  if (facts.romBytes !== undefined) over(Math.ceil(facts.romBytes / 1024), limits.maxRomKB, "ROM size in KB");
  return out;
}

/** A kit game's facts from its .cartridge file, or null if it isn't one we can read. */
export function cartridgeFacts(cartridge: Uint8Array): GameFacts | null {
  if (cartridge.length > 2 * 1024 * 1024) return null;
  try {
    const files = unzipSync(cartridge, { filter: (f) => (f.name === "cartridge.json" || f.name === "project.json") && f.originalSize < 2 * 1024 * 1024 });
    const meta = JSON.parse(strFromU8(files["cartridge.json"]!)) as { kind?: unknown };
    if (meta.kind !== "kit") return null;
    const game = KitGameSchema.safeParse(JSON.parse(strFromU8(files["project.json"]!)));
    return game.success ? kitFacts(game.data) : null;
  } catch {
    return null;
  }
}
