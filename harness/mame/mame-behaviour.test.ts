// Runs every template's behaviour tests in MAME's a7800 driver. Skips, with a
// message saying how to install it, when MAME isn't on this machine.

import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { WasiBuilder } from "@cartridge-studio/toolchain";
import { BehaviourTestSchema } from "../../app/src/harness/behaviour.ts";
import { nodeBuilder } from "../../app/src/harness/node.ts";
import { TEMPLATES } from "../../app/src/project/templates.ts";
import { findMame, runInMame, type Mame } from "./mame.ts";

const templatesDir = path.resolve(import.meta.dirname, "../../templates");
const found = findMame();
const mame = "missing" in found ? undefined : found;

// Straight to stderr: Vitest hides console output from skipped files.
process.stderr.write(
  !mame
    ? `\n${(found as { missing: string }).missing}\n\n`
    : `\nMAME ${mame.version}, a7800 with the ${mame.bios === "real" ? `real BIOS from ${mame.rompath}` : "stub BIOS (set MAME_ROMPATH to use the real one)"}\n\n`,
);

let builder: WasiBuilder;

beforeAll(async () => {
  if (mame) builder = await nodeBuilder();
});

for (const [id, template] of Object.entries(TEMPLATES)) {
  const dir = path.join(templatesDir, id, "tests");
  const tests = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => ({ file, test: BehaviourTestSchema.parse(JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"))) }));

  describe.skipIf(!mame)(`template ${id} in MAME`, () => {
    for (const { file, test } of tests) {
      it(`${test.name} (${file})`, async () => {
        const result = await runInMame(test, template, builder, mame!);
        expect(result.failure ?? null).toBeNull();
        expect(result.passed).toBe(true);
      });
    }
  });
}
