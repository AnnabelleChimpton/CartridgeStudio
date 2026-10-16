// Kit runtime tests: one tiny game per behaviour or mechanism, run frame by
// frame in the headless core. Placed things fill slots in type order (type 0
// first), and launched things (shots, drops) use the slots after them.

import { beforeAll, describe, expect, it } from "vitest";
import type { WasiBuilder } from "@cartridge-studio/toolchain";
import type { CoreHost } from "../emulator/core-host.ts";
import { runRomOnHost, type Step, type WatchMap } from "../harness/behaviour.ts";
import { nodeBuilder, nodeHost } from "../harness/node.ts";
import { SOUND_LIBRARY } from "../project/templates.ts";
import type { Behaviour, KitGame, KitRule, KitType } from "./schema.ts";
import { KIT_WATCH, buildKitRom } from "./tests.ts";

const box = (w: number, h: number) => Array.from({ length: h }, () => "1".repeat(w));
const type = (id: string, behaviour: Behaviour, extra: Partial<KitType> = {}): KitType => ({
  id,
  label: id,
  width: 8,
  height: 8,
  frames: [box(8, 8)],
  palette: "p",
  behaviour,
  speed: 3,
  ...extra,
});

/** A game from a picture of the room: `#` wall, `P` the player, `A`/`B` things of the 2nd/3rd type. */
function game(room: string[], types: KitType[], rules: KitRule[] = []): KitGame {
  const rows = [...room, ...Array(11).fill("")].slice(0, 11).map((r) => r.padEnd(20, " "));
  const legend: Record<string, string> = { "#": "wall", P: types[0]!.id };
  if (types[1]) legend.A = types[1].id;
  if (types[2]) legend.B = types[2].id;
  return {
    kit: 1,
    title: "Test",
    palettes: [{ id: "p", colors: ["$0F", "$46", "$86"] }],
    background: "$00",
    wallPalette: "p",
    textPalette: "p",
    lives: 3,
    types,
    room: { rows, legend },
    rules,
    text: { title: "T", win: "W", lose: "L" },
    sounds: {},
  };
}

const slot = (n: number): WatchMap => ({
  [`x${n}`]: { symbol: "ox", offset: n },
  [`y${n}`]: { symbol: "oy", offset: n },
  [`type${n}`]: { symbol: "otype", offset: n },
});
const START: Step[] = [{ frames: 5 }, { hold: ["fire"], frames: 2 }, { frames: 2 }];

let builder: WasiBuilder;
let host: CoreHost;
beforeAll(async () => {
  builder = await nodeBuilder();
  host = await nodeHost();
});

async function run(g: KitGame, steps: Step[], watch: WatchMap = {}) {
  const rom = await buildKitRom(g, SOUND_LIBRARY, builder);
  if (!rom.ok) throw new Error(rom.failure);
  const r = await runRomOnHost(host, rom.a78, rom.symbols, { ...KIT_WATCH, ...watch, ...slot(1), ...slot(2), ...slot(3) }, [...START, ...steps]);
  expect(r.failure ?? null).toBeNull();
}

const hero = () => type("hero", "player-8way");

describe("kit runtime behaviours", () => {
  it("patrol-h turns around at a wall", async () => {
    // Player in slot 0; the patroller (slot 1) starts at x=16 heading right towards the wall at column 10 (x=80).
    const g = game(["", "", "", "", "  A       #", "", "", "", "", "P"], [hero(), type("guard", "patrol-h")]);
    await run(g, [
      { until: { x1: 72 }, maxFrames: 300, steps: [{ frames: 1 }] },
      { frames: 20 },
      { expect: { x1: { lt: 72 }, y1: 80 } }, // room row 4: y = 16 + 4 × 16
    ]);
  });

  it("fall comes back at the top after leaving the bottom", async () => {
    const g = game(["", "", "", "", "  A", "", "", "", "", "P"], [hero(), type("rock", "fall")]);
    await run(g, [
      { until: { y1: { gte: 150 } }, maxFrames: 400, steps: [{ frames: 1 }] },
      { until: { y1: { lt: 40 } }, maxFrames: 400, steps: [{ frames: 1 }] },
    ]);
  });

  it("march steps the whole formation down at the edge", async () => {
    const g = game(["", " A  A", "", "", "", "", "", "", "", "P"], [hero(), type("invader", "march")]);
    await run(g, [
      { until: { y1: 40 }, maxFrames: 600, steps: [{ frames: 1 }] },
      { expect: { y2: 40 } },
    ]);
  });

  it("chase closes in on the player", async () => {
    const g = game(["", "", "", "", "P              A"], [hero(), type("ghost", "chase", { speed: 2 })]);
    await run(g, [{ until: { x1: { lte: 24 } }, maxFrames: 1200, steps: [{ frames: 10 }] }]);
  });

  it("bounce stays inside a walled room", async () => {
    const walls = ["####################", ...Array(9).fill("#                  #"), "####################"];
    walls[5] = "#       A          #";
    walls[8] = "# P                #";
    const g = game(walls, [hero(), type("ball", "bounce", { speed: 4 })]);
    const inside = { x1: { gte: 8, lte: 144 }, y1: { gte: 32, lte: 168 } };
    await run(g, [{ repeat: 60, steps: [{ frames: 10 }, { expect: inside }] }]);
  });

  it("the player shoots one shot at a time, and walls stop it", async () => {
    const g = game(["#", "", "", "", "", "", "", "", "P"], [hero(), type("shot", "projectile-up", { width: 4, height: 6, frames: [box(4, 6)] })].map((t, i) => (i === 0 ? { ...t, shoots: "shot" } : t)));
    // Slot 1 is the first launch slot (only the player is placed).
    await run(g, [
      { hold: ["fire"], frames: 2 },
      { expect: { type1: 1 } },
      { hold: ["fire"], frames: 2 },
      { expect: { type2: 255 } },
      { until: { type1: 255 }, maxFrames: 200, steps: [{ frames: 1 }] },
    ]);
  });

  it("drops fall from the dropper, one at a time", async () => {
    const g = game(["", "  A", "", "", "", "", "", "", "", "P"], [hero(), type("cloud", "still", { drops: { type: "drop", chance: 40 } }), type("drop", "projectile-down", { width: 4, height: 4, frames: [box(4, 4)] })]);
    await run(g, [
      { until: { type2: 2 }, maxFrames: 600, steps: [{ frames: 1 }] },
      { expect: { y2: { gte: 40 }, type3: 255 } },
    ]);
  });

  it("an event rule fires once each time its condition becomes true", async () => {
    const coin = type("coin", "still");
    const rules: KitRule[] = [
      { when: { touch: ["hero", "coin"] }, then: [{ remove: "second" }, { score: 10 }] },
      { when: { allGone: "coin" }, then: [{ score: 50 }] },
    ];
    const g = game(["", "", "", "", "P A"], [hero(), coin], rules);
    await run(g, [{ hold: ["right"], frames: 40 }, { frames: 200 }, { expect: { score: 60 } }]);
  });

  it("losing the last life ends the game; touching a goal wins it", async () => {
    const goal = type("goal", "still");
    const lose = game(["", "", "", "", "P A"], [hero(), goal], [{ when: { touch: ["hero", "goal"] }, then: [{ loseLife: true }] }]);
    lose.lives = 1;
    await run(lose, [{ hold: ["right"], frames: 40 }, { expect: { state: 3, lives: 0 } }]);
    const win = game(["", "", "", "", "P A"], [hero(), goal], [{ when: { touch: ["hero", "goal"] }, then: [{ win: true }] }]);
    await run(win, [{ hold: ["right"], frames: 40 }, { expect: { state: 2 } }, { hold: ["fire"], frames: 2 }, { frames: 2 }, { expect: { state: 0 } }]);
  });
});
