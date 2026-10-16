// Behaviour tests for kit games: the same step format as template tests
// (app/src/harness/behaviour.ts), reading the runtime's fixed variables.

import { z } from "zod";
import type { Builder } from "@cartridge-studio/toolchain";
import type { CoreHost } from "../emulator/core-host.ts";
import { BehaviourTestSchema, runRomOnHost, type BehaviourResult, type WatchMap } from "../harness/behaviour.ts";
import type { SoundEffect } from "../project/schema.ts";
import { generateKit, type KitOptions } from "./generate.ts";
import { PART_RULE, rulesFromV1 } from "./migrations.ts";
import { KitRuleSchema, LIVES, type KitGame } from "./schema.ts";
import { KitRuleV1Schema } from "./schema-v1.ts";

/** Variables every kit ROM has. Slot 0 holds the first placed thing of the first kind (the player, in every preset). */
export const KIT_WATCH: WatchMap = {
  score: { symbol: "score0", bytes: 3, bcd: true },
  /** The counter "lives" (0 when a game has none). */
  lives: { symbol: "lives" },
  /** 0 title, 1 playing, 2 won, 3 lost, 4 the demo */
  state: { symbol: "gamestate" },
  seconds: { symbol: "seconds" },
  /** Main-loop passes since power-on; equal to frames at 60 fps. */
  loops: { symbol: "loopslo", bytes: 2 },
  heroX: { symbol: "ox" },
  heroY: { symbol: "oy" },
  /** The counter "level" (0 when a game has none). */
  level: { symbol: "levelnum" },
  /** The current room, counting from 1. */
  room: { symbol: "roomnum" },
};

export const KitTestSchema = z
  .object({
    name: z.string(),
    /**
     * Changes to the game for this test: lives to start with, and rules to
     * use instead of the game's own. Rules may be kit v1 rules (older tests);
     * those replace the game's rules except the ones that stand in for v1
     * type properties (`r-p-…`: shooting, dropping, the march, falling, lives).
     */
    game: z
      .object({
        lives: z.number().int().min(1).max(9).optional(),
        rules: z.union([z.array(KitRuleSchema), z.array(KitRuleV1Schema)]).optional(),
      })
      .strict()
      .default({}),
    steps: BehaviourTestSchema.shape.steps,
  })
  .strict();
export type KitTest = z.infer<typeof KitTestSchema>;

export function gameFor(test: KitTest, game: KitGame): KitGame {
  const g = structuredClone(game);
  if (test.game.lives) {
    const lives = g.counters.find((c) => c.id === LIVES);
    if (lives) lives.start = test.game.lives;
  }
  const rules = test.game.rules;
  if (rules) {
    const v2 = z.array(KitRuleSchema).safeParse(rules);
    if (v2.success) g.rules = v2.data;
    else {
      const players = g.types.filter((t) => t.control?.joystick === 1).map((t) => t.id);
      const migrated = rulesFromV1(z.array(KitRuleV1Schema).parse(rules), { players });
      const parts = g.rules.filter((r) => r.id.startsWith(PART_RULE));
      // As the migration orders them: the game's own rules, then the ones from type properties and flow.
      g.rules = [...migrated, ...parts];
    }
  }
  return g;
}

export async function buildKitRom(game: unknown, library: SoundEffect[], builder: Builder, sign = false, opts: KitOptions = {}) {
  const gen = generateKit(game, library, opts);
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
