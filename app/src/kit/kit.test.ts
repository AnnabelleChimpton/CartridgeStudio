// Game kit spike: the three genres (templates/kit/games/*.json) are only data
// for one runtime. Each must build, pass its behaviour tests and hold 60 fps.

import { beforeAll, describe, expect, it } from "vitest";
import type { WasiBuilder } from "@cartridge-studio/toolchain";
import type { CoreHost } from "../emulator/core-host.ts";
import { nodeBuilder, nodeHost } from "../harness/node.ts";
import { SOUND_LIBRARY } from "../project/templates.ts";
import { CPU_BUDGET, cpuCost, generateKit, validateKit } from "./generate.ts";
import { KitGameSchema, type KitGame } from "./schema.ts";
import { KitTestSchema, runKitTest } from "./tests.ts";

const games = import.meta.glob<unknown>("../../../templates/kit/games/*.json", { import: "default", eager: true });
const byName = (suffix: string) =>
  Object.fromEntries(
    Object.entries(games)
      .filter(([p]) => p.endsWith(suffix) && (suffix === ".tests.json" || !p.endsWith(".tests.json")))
      .map(([p, v]) => [p.split("/").pop()!.replace(suffix, ""), v]),
  );
const kitGames = byName(".json") as Record<string, KitGame>;
const kitTests = byName(".tests.json");

let builder: WasiBuilder;
let host: CoreHost;
beforeAll(async () => {
  builder = await nodeBuilder();
  host = await nodeHost();
});

describe("kit games", () => {
  it("has the spike genres and the batch 1 preset", () => expect(Object.keys(kitGames).sort()).toEqual(["dodger", "ghost-panic", "maze", "shooter"]));

  for (const [name, raw] of Object.entries(kitGames)) {
    describe(name, () => {
      const game = KitGameSchema.parse(raw);

      it("is valid and within the CPU budget", () => {
        const v = validateKit(game, SOUND_LIBRARY);
        if (!v.ok) throw new Error(v.errors.join("\n"));
        expect(cpuCost(v.game, v.spawns)).toBeLessThanOrEqual(CPU_BUDGET);
        expect(generateKit(game, SOUND_LIBRARY).ok).toBe(true);
      });

      for (const test of (kitTests[name] as unknown[] | undefined)?.map((t) => KitTestSchema.parse(t)) ?? []) {
        it(test.name, async () => {
          const r = await runKitTest(test, game, SOUND_LIBRARY, builder, host);
          expect(r.failure ?? null).toBeNull();
        });
      }
    });
  }
});
