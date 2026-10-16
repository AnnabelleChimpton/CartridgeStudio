// Runs every template's behaviour tests (templates/<id>/tests/*.json) in the
// headless js7800 core. A template ships only when all of them pass.

import { beforeAll, describe, expect, it } from "vitest";
import type { WasiBuilder } from "@cartridge-studio/toolchain";
import type { CoreHost } from "../emulator/core-host.ts";
import { TEMPLATES } from "../project/templates.ts";
import { BehaviourTestSchema, runBehaviourTest } from "./behaviour.ts";
import { nodeBuilder, nodeHost } from "./node.ts";

const files = import.meta.glob<unknown>("../../../templates/*/tests/*.json", { import: "default", eager: true });

let builder: WasiBuilder;
let host: CoreHost;

beforeAll(async () => {
  builder = await nodeBuilder();
  host = await nodeHost();
});

for (const [id, template] of Object.entries(TEMPLATES)) {
  const tests = Object.entries(files)
    .filter(([path]) => path.includes(`/templates/${id}/tests/`))
    .map(([path, json]) => ({ file: path.split("/").pop()!, test: BehaviourTestSchema.parse(json) }));

  describe(`template ${id}`, () => {
    it("has behaviour tests", () => expect(tests.length).toBeGreaterThan(0));

    for (const { file, test } of tests) {
      it(`${test.name} (${file})`, async () => {
        const result = await runBehaviourTest(test, template, builder, host);
        expect(result.failure ?? null).toBeNull();
        expect(result.passed).toBe(true);
      });
    }
  });
}
