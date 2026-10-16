// Game kit: the starter games (templates/kit/games/*.json) are only data
// for one runtime. Each must build, pass its behaviour tests and hold 60 fps.

import { beforeAll, describe, expect, it } from "vitest";
import type { WasiBuilder } from "@cartridge-studio/toolchain";
import type { CoreHost } from "../emulator/core-host.ts";
import { nodeBuilder, nodeHost } from "../harness/node.ts";
import { SOUND_LIBRARY } from "../project/templates.ts";
import { CPU_BUDGET, cpuCost, generateKit, validateKit } from "./generate.ts";
import { KitGameSchema, type KitGame, type KitGameInput, type KitRule } from "./schema.ts";
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
  it("has the spike genres and the batch 1 preset", () => expect(Object.keys(kitGames).sort()).toEqual(["dodger", "ghost-panic", "key-quest", "maze", "shooter"]));

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

describe("kit validation", () => {
  const box = (w: number) => Array.from({ length: 8 }, () => "1".repeat(w));
  const wide = (id: string) => ({ id, label: id, width: 16, height: 8, frames: [box(16)], palette: "p" });
  let n = 0;
  const rule = (when: KitRule["when"], then: Record<string, unknown>[]): KitRule => ({ id: `r-${++n}`, when, then: then.map((a) => ({ id: `a-${++n}`, ...a })) }) as KitRule;
  const base = (row: string, rules: KitRule[]): KitGameInput => ({
    kit: 2,
    title: "T",
    palettes: [{ id: "p", colors: ["$0F", "$46", "$86"] }],
    background: "$00",
    wallPalette: "p",
    textPalette: "p",
    types: [{ ...wide("hero"), control: { joystick: 1, axes: "lr", speed: { step: 3 } } }, wide("box")],
    room: { rows: [row.padEnd(20), ...Array(10).fill(" ".repeat(20))], legend: { "~": "hazard", P: "hero", B: "box" } },
    rules,
    text: { title: "T", win: "W", lose: "L" },
  });
  const errors = (g: KitGameInput) => {
    const v = validateKit(g, SOUND_LIBRARY);
    return v.ok ? [] : v.errors;
  };

  it("refuses a rule that restarts the room while it's already true at the start", () => {
    // A 16-wide hero placed left of a hazard has its middle on the hazard.
    expect(errors(base("P~", [rule({ onTile: ["hero", "hazard"] }, [{ restartRoom: true }])]))).toEqual([
      "Rule 1 starts the room again, but it's already true when the room starts (a hero starts on a hazard tile), so the room would restart forever.",
    ]);
    expect(errors(base("PB", [rule({ touch: ["hero", "box"] }, [{ restartRoom: true }])]))[0]).toMatch(/a hero and a box start touching/);
    // Not true at the start, or not restarting: fine.
    expect(errors(base("P ~", [rule({ onTile: ["hero", "hazard"] }, [{ restartRoom: true }])]))).toEqual([]);
    expect(errors(base("PB", [rule({ touch: ["hero", "box"] }, [{ add: { what: { counter: "score" }, by: 10 } }])]))).toEqual([]);
  });

  it("says what's coming soon instead of building half of it", () => {
    const p2 = base("P", []);
    p2.types[0]!.control!.joystick = 2;
    expect(errors(p2)[0]).toMatch(/joystick 2: two players are coming soon/);
    expect(errors(base("P", [rule({ button: { joy: 1, button: 2 } }, [{ add: { what: { counter: "score" }, by: 10 } }])]))[0]).toMatch(/button 2/);
  });

  it("refuses rules that couldn't stop: a room start that starts a room", () => {
    expect(errors(base("P", [rule({ roomStart: true }, [{ restartRoom: true }])]))[0]).toMatch(/can't start a room again/);
  });
});
