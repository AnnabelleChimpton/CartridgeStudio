// Game kit spike: the kit genres' behaviour tests (templates/kit/games/*.tests.json)
// in MAME's a7800 driver, the same files the js7800 suite runs.

import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { WasiBuilder } from "@cartridge-studio/toolchain";
import { nodeBuilder } from "../../app/src/harness/node.ts";
import { SOUND_LIBRARY } from "../../app/src/project/templates.ts";
import { KitGameSchema } from "../../app/src/kit/schema.ts";
import { KIT_WATCH, KitTestSchema, buildKitRom, gameFor } from "../../app/src/kit/tests.ts";
import { findMame, runRomInMame, type Mame } from "./mame.ts";

const gamesDir = path.resolve(import.meta.dirname, "../../templates/kit/games");
const found = findMame();
const mame = "missing" in found ? undefined : found;

let builder: WasiBuilder;
beforeAll(async () => {
  builder = await nodeBuilder();
});

const names = fs
  .readdirSync(gamesDir)
  .filter((f) => f.endsWith(".json") && !f.endsWith(".tests.json"))
  .map((f) => f.replace(/\.json$/, ""));

describe.skipIf(!mame)("kit games in MAME", () => {
  for (const name of names) {
    const game = KitGameSchema.parse(JSON.parse(fs.readFileSync(path.join(gamesDir, `${name}.json`), "utf8")));
    const testsFile = path.join(gamesDir, `${name}.tests.json`);
    const tests = fs.existsSync(testsFile)
      ? (JSON.parse(fs.readFileSync(testsFile, "utf8")) as unknown[]).map((t) => KitTestSchema.parse(t))
      : [];
    describe(name, () => {
      for (const test of tests) {
        it(test.name, async () => {
          // Signed: the real BIOS (when MAME_ROMPATH has one) checks the signature.
          const rom = await buildKitRom(gameFor(test, game), SOUND_LIBRARY, builder, true);
          if (!rom.ok) throw new Error(rom.failure);
          const result = await runRomInMame(rom.a78, rom.symbols, KIT_WATCH, test, mame as Mame);
          expect(result.failure ?? null).toBeNull();
        });
      }
    });
  }
});
