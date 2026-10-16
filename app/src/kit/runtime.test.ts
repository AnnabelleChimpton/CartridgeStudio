// Kit runtime tests: one tiny game per behaviour or mechanism, run frame by
// frame in the headless core. Placed things fill slots in type order (type 0
// first), and launched things (shots, drops) use the slots after them.

import { beforeAll, describe, expect, it } from "vitest";
import type { WasiBuilder } from "@cartridge-studio/toolchain";
import type { CoreHost } from "../emulator/core-host.ts";
import { runRomOnHost, type Step, type WatchMap } from "../harness/behaviour.ts";
import { nodeBuilder, nodeHost } from "../harness/node.ts";
import { SOUND_LIBRARY } from "../project/templates.ts";
import type { Behaviour, KitCounter, KitGame, KitRule, KitType } from "./schema.ts";
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
  const legend: Record<string, string> = { "#": "wall", "~": "hazard", "*": "goal", P: types[0]!.id };
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
    counters: [],
    rules,
    text: { title: "T", win: "W", lose: "L" },
    sounds: {},
    cartridge: { manualText: null },
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
    const goal = type("flag", "still");
    const lose = game(["", "", "", "", "P A"], [hero(), goal], [{ when: { touch: ["hero", "flag"] }, then: [{ loseLife: true }] }]);
    lose.lives = 1;
    await run(lose, [{ hold: ["right"], frames: 40 }, { expect: { state: 3, lives: 0 } }]);
    const win = game(["", "", "", "", "P A"], [hero(), goal], [{ when: { touch: ["hero", "flag"] }, then: [{ win: true }] }]);
    await run(win, [{ hold: ["right"], frames: 40 }, { expect: { state: 2 } }, { hold: ["fire"], frames: 2 }, { frames: 2 }, { expect: { state: 0 } }]);
  });
});

describe("kit runtime: batch 1 (state)", () => {
  const counters = (...ids: string[]): KitCounter[] => ids.map((id) => ({ id, label: id, start: 0 }));
  const CNT: WatchMap = { c0: { symbol: "cnt0" }, level: { symbol: "levelnum" } };

  it("counters and 'only if': a door opens only with a key", async () => {
    const rules: KitRule[] = [
      { when: { touch: ["hero", "key"] }, then: [{ remove: "second" }, { add: ["keys", 1] }] },
      { when: { touch: ["hero", "door"] }, if: [{ counter: "keys", op: "gte", value: 1 }], then: [{ remove: "second" }, { take: ["keys", 1] }, { score: 10 }] },
    ];
    const types = [hero(), type("key", "still"), type("door", "still")];
    // Key then door: the door opens and the key is spent. (Slots: hero 0, key 1, door 2.)
    const open = { ...game(["", "", "", "", "P A B"], types, rules), counters: counters("keys") };
    await run(open, [{ hold: ["right"], frames: 60 }, { expect: { type1: 255, type2: 255, score: 10, c0: 0 } }], CNT);
    // No key: walking over the door does nothing.
    const shut = { ...game(["", "", "", "", "P B"], types, rules), counters: counters("keys") };
    await run(shut, [{ hold: ["right"], frames: 60 }, { expect: { type1: 2, score: 0, c0: 0 } }], CNT);
  });

  it("'a counter reaches N' fires once it gets there", async () => {
    const rules: KitRule[] = [
      { when: { touch: ["hero", "coin"] }, then: [{ remove: "second" }, { add: ["coins", 1] }] },
      { when: { reaches: ["coins", 2] }, then: [{ win: true }] },
    ];
    const g = { ...game(["", "", "", "", "P A A A"], [hero(), type("coin", "still")], rules), counters: counters("coins") };
    // The second coin wins, before the third is reached.
    await run(g, [{ until: { state: 2 }, maxFrames: 120, steps: [{ hold: ["right"], frames: 1 }] }, { expect: { c0: 2, type3: 1 } }], CNT);
  });

  it("'turn into' for some seconds turns back by itself", async () => {
    const rules: KitRule[] = [{ when: { touch: ["hero", "button"] }, then: [{ turn: { who: "second", into: "pressed", seconds: 2 } }] }];
    const g = game(["", "", "", "", "P A"], [hero(), type("button", "still"), type("pressed", "still")], rules);
    await run(g, [
      { hold: ["right"], frames: 40 },
      { expect: { type1: 2 } },
      { frames: 60 },
      { expect: { type1: 2 } },
      { until: { type1: 1 }, maxFrames: 120, steps: [{ frames: 1 }] },
    ]);
  });

  it("'turn every' changes every thing of a type, and fleeing things run away", async () => {
    const rules: KitRule[] = [{ when: { touch: ["hero", "pill"] }, then: [{ remove: "second" }, { turnAll: { type: "ghost", into: "scared", seconds: 3 } }] }];
    const types = [hero(), type("ghost", "chase", { speed: 1 }), type("pill", "still"), type("scared", "flee", { speed: 2 })];
    // Ghosts in slots 1 and 2, the pill in 3.
    const g = game(["", "", "", "", "PB       A    A"], types, rules);
    await run(g, [
      { hold: ["right"], frames: 6 },
      { expect: { type3: 255, type1: 3, type2: 3 } },
      { frames: 60 },
      { expect: { x1: { gte: 72 }, x2: { gte: 120 } } },
      { until: { type1: 1, type2: 1 }, maxFrames: 200, steps: [{ frames: 1 }] },
    ]);
  });

  it("'every N seconds' fires on time", async () => {
    const g = game(["", "", "", "", "P"], [hero()], [{ when: { every: 1 }, then: [{ score: 10 }] }]);
    await run(g, [{ frames: 200 }, { expect: { score: 30 } }]);
  });

  it("'next level' starts the room again one level up", async () => {
    const rules: KitRule[] = [
      { when: { touch: ["hero", "coin"] }, then: [{ remove: "second" }, { score: 10 }] },
      { when: { allGone: "coin" }, then: [{ nextLevel: true }] },
    ];
    const g = game(["", "", "", "", "P A"], [hero(), type("coin", "still")], rules);
    await run(g, [{ until: { level: 2 }, maxFrames: 60, steps: [{ hold: ["right"], frames: 1 }] }, { frames: 4 }, { expect: { level: 2, type1: 1, score: 10, x0: { lte: 8 } } }], {
      ...CNT,
      x0: { symbol: "ox", offset: 0 },
    });
  });

  it("things other than the player move faster every second level", async () => {
    // Level up each second until level 3, which adds one speed step to the walker (speed 1: a quarter pixel a frame).
    const rules: KitRule[] = [{ when: { every: 1 }, if: [{ counter: "level", op: "lte", value: 2 }], then: [{ nextLevel: true }] }];
    const g = game(["", "", "", "", "", "", " A", "", "", "P"], [hero(), type("walker", "patrol-h", { speed: 1 })], rules);
    // The room restarts at level 3, putting the walker back at x = 8; 60 frames later a half-pixel walker has gone about 30 pixels.
    await run(g, [{ until: { level: 3 }, maxFrames: 200, steps: [{ frames: 1 }] }, { frames: 60 }, { expect: { x1: { gte: 32, lte: 42 } } }], CNT);
  });

  it("hazard and goal tiles don't block, and rules notice them", async () => {
    const hurt = game(["", "", "", "", "P ~"], [hero()], [{ when: { onTile: ["hero", "hazard"] }, then: [{ loseLife: true }] }]);
    await run(hurt, [{ hold: ["right"], frames: 30 }, { expect: { lives: 2 } }]);
    const goal = game(["", "", "", "", "P   *  #"], [hero()], [{ when: { onTile: ["hero", "goal"] }, then: [{ win: true }] }]);
    await run(goal, [{ hold: ["right"], frames: 60 }, { expect: { state: 2 } }]);
    // Walls still block when there are other tiles: the hero stops at the wall in column 7.
    const wall = game(["", "", "", "", "P  ~   #"], [hero()], []);
    await run(wall, [{ hold: ["right"], frames: 90 }, { expect: { heroX: 48 } }]);
  });
});
