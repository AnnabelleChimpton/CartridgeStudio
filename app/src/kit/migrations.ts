// Kit game migrations, keyed on the game's `kit` version. Each entry upgrades
// a game from version n to n + 1; loadKit runs them before validating, so
// saves, opened .cartridge files and presets all go through the same path.
// Frozen copies of each old version's presets live in kit/fixtures/v<n>/ and
// must keep migrating and building (migrations.test.ts).

import { KIT_VERSION, KitGameSchema, type KitGame } from "./schema.ts";

type Migration = (game: Record<string, unknown>) => Record<string, unknown>;

const MIGRATIONS: Record<number, Migration> = {
  // 1: kit model v2 (docs/kit-model-v2.md, "Migration from schema v1").
};

export const NEWER_KIT = "This game was saved by a newer version of Cartridge Studio.";

export type KitLoad = { ok: true; game: KitGame; migrated: boolean } | { ok: false; errors: string[]; newer?: boolean };

/** Brings a kit game up to KIT_VERSION, or explains why it can't be read. */
export function loadKit(input: unknown): KitLoad {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return { ok: false, errors: ["This isn't a kit game."] };
  let game = input as Record<string, unknown>;
  let version = typeof game.kit === "number" && Number.isInteger(game.kit) ? game.kit : NaN;
  if (Number.isNaN(version)) return { ok: false, errors: ["This kit game has no version number."] };
  if (version > KIT_VERSION) return { ok: false, errors: [NEWER_KIT], newer: true };
  const from = version;
  while (version < KIT_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return { ok: false, errors: [`There's no way to upgrade a kit game from version ${version}.`] };
    try {
      game = step(structuredClone(game));
    } catch (e) {
      return { ok: false, errors: [`Upgrading this game from version ${version} failed: ${e instanceof Error ? e.message : String(e)}`] };
    }
    version++;
  }
  const parsed = KitGameSchema.safeParse(game);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `This game file is damaged (${i.path.join(".")}: ${i.message}).`) };
  }
  return { ok: true, game: parsed.data, migrated: from !== KIT_VERSION };
}
