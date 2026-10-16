// Behaviour tests for kit games: the same step format as template tests
// (app/src/harness/behaviour.ts), reading the runtime's fixed variables.

import { z } from "zod";
import type { Builder } from "@cartridge-studio/toolchain";
import type { CoreHost } from "../emulator/core-host.ts";
import { BehaviourTestSchema, runRomOnHost, type BehaviourResult, type WatchMap } from "../harness/behaviour.ts";
import type { SoundEffect } from "../project/schema.ts";
import { generateKit } from "./generate.ts";
import { KitRuleSchema, type KitGame } from "./schema.ts";

/** Variables every kit ROM has. The player is always in slot 0 (placed things are sorted by type, the player's first). */
export const KIT_WATCH: WatchMap = {
  score: { symbol: "score0", bytes: 3, bcd: true },
  lives: { symbol: "lives" },
  /** 0 title, 1 playing, 2 won, 3 lost */
  state: { symbol: "gamestate" },
  seconds: { symbol: "seconds" },
  /** Main-loop passes since power-on; equal to frames at 60 fps. */
  loops: { symbol: "loopslo", bytes: 2 },
  heroX: { symbol: "ox" },
  heroY: { symbol: "oy" },
};

export const KitTestSchema = z
  .object({
    name: z.string(),
    /** Changes to the game for this test. */
    game: z.object({ lives: z.number().int().min(1).max(9).optional(), rules: z.array(KitRuleSchema).optional() }).strict().default({}),
    steps: BehaviourTestSchema.shape.steps,
  })
  .strict();
export type KitTest = z.infer<typeof KitTestSchema>;

export function gameFor(test: KitTest, game: KitGame): KitGame {
  const g = structuredClone(game);
  if (test.game.lives) g.lives = test.game.lives;
  if (test.game.rules) g.rules = structuredClone(test.game.rules);
  return g;
}

export async function buildKitRom(game: unknown, library: SoundEffect[], builder: Builder, sign = false) {
  const gen = generateKit(game, library);
  if (!gen.ok) return { ok: false as const, failure: `Game invalid: ${gen.errors.join("; ")}` };
  const built = await builder.build({ ...gen.input, sign });
  if (!built.ok) return { ok: false as const, failure: `Build failed in ${built.stage}: ${built.message}` };
  return { ok: true as const, a78: built.a78, symbols: built.symbols };
}

export async function runKitTest(
  test: KitTest,
  game: KitGame,
  library: SoundEffect[],
  builder: Builder,
  host: CoreHost,
): Promise<BehaviourResult> {
  const rom = await buildKitRom(gameFor(test, game), library, builder);
  if (!rom.ok) return { passed: false, frames: 0, failure: rom.failure };
  return runRomOnHost(host, rom.a78, rom.symbols, KIT_WATCH, test.steps);
}
