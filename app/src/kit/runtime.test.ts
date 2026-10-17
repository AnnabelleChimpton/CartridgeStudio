// Kit runtime tests: one tiny game per behaviour or mechanism, run frame by
// frame in the headless core. Each kind of thing has its own slots, in kind
// order (kind 0 first): what's placed, then room for what rules create.
//
// The first groups write kit format 1 games (as saved before format 2) and run
// them through the 1 → 2 migration, so they check the migration keeps each v1
// behaviour. Later groups write v2 games and cover the new vocabulary.

import { beforeAll, describe, expect, it } from "vitest";
import type { WasiBuilder } from "@cartridge-studio/toolchain";
import type { CoreHost } from "../emulator/core-host.ts";
import { runRomOnHost, type Step, type WatchMap } from "../harness/behaviour.ts";
import { nodeBuilder, nodeHost } from "../harness/node.ts";
import { SOUND_LIBRARY } from "../project/templates.ts";
import type { Behaviour, KitCounterV1 as KitCounter, KitGameV1 as KitGame, KitRuleV1 as KitRule, KitTypeV1 as KitType } from "./schema-v1.ts";
import { validateKit, type KitOptions } from "./generate.ts";
import { loadKit } from "./migrations.ts";
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

async function run(g: KitGame, steps: Step[], watch: WatchMap = {}, opts: KitOptions = {}) {
  const v2 = loadKit(g);
  if (!v2.ok) throw new Error(v2.errors.join("\n"));
  await runV2(v2.game, steps, watch, opts);
}

/** Runs a v2 game (as JSON, before defaults). */
async function runV2(g: unknown, steps: Step[], watch: WatchMap = {}, opts: KitOptions = {}) {
  const rom = await buildKitRom(g, SOUND_LIBRARY, builder, false, opts);
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

describe("kit runtime: counters, tiles and state", () => {
  const counters = (...ids: string[]): KitCounter[] => ids.map((id) => ({ id, label: id, start: 0 }));
  const CNT: WatchMap = { c0: { symbol: "c_keys" }, coins: { symbol: "c_coins" }, level: { symbol: "levelnum" } };

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
    await run(g, [{ until: { state: 2 }, maxFrames: 120, steps: [{ hold: ["right"], frames: 1 }] }, { expect: { coins: 2, type3: 1 } }], CNT);
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

describe("kit runtime: fixed bugs", () => {
  it("a tile rule doesn't stop later event rules from firing (no border wall)", async () => {
    // The hero sits in column 0, where the tile lookup's column is 0; that used to clear the
    // odd-frame gate the event rules share, so the timer rule never fired.
    const rules: KitRule[] = [
      { when: { onTile: ["hero", "goal"] }, then: [{ score: 10 }] },
      { when: { timer: 2 }, then: [{ score: 50 }] },
    ];
    await run(game(["", "", "", "", "P"], [hero()], rules), [{ frames: 200 }, { expect: { score: 50 } }]);
  });

  it("falling things come back in a column that fits", async () => {
    // Model v2: falling is a rule ("when it leaves the screen, set its x to a random column"), and
    // a faller passes through walls, so it no longer avoids walled columns in the top row.
    const g = game(["###############", "                A", "", "", "", "", "", "", "", "P"], [hero(), type("rock", "fall", { speed: 4, width: 16, frames: [box(16, 8)] })]);
    await run(g, [
      {
        repeat: 5,
        steps: [
          { until: { y1: { gte: 150 } }, maxFrames: 200, steps: [{ frames: 1 }] },
          { until: { y1: { lt: 40 } }, maxFrames: 200, steps: [{ frames: 1 }] },
          { expect: { x1: { lte: 144 } } },
        ],
      },
    ]);
  });

  it("turning into a bigger thing keeps it on the screen", async () => {
    const small = type("chip", "still", { width: 4, frames: [box(4, 8)] });
    const big = type("block", "still", { width: 16, frames: [box(16, 8)] });
    const rules: KitRule[] = [{ when: { touch: ["hero", "chip"] }, then: [{ turn: { who: "second", into: "block" } }] }];
    // The chip is in the last column (x = 152); as a 16-wide block it must move left to x = 144.
    const g = game(["", "", "", "", "P                  A"], [hero(), small, big], rules);
    await run(g, [{ until: { type1: 2 }, maxFrames: 200, steps: [{ hold: ["right"], frames: 1 }] }, { expect: { x1: 144 } }]);
  });
});

// ---- kit format 2: the general vocabulary ----

type V2Type = import("./schema.ts").KitGameInput["types"][number];
type V2Rule = import("./schema.ts").KitRule;
type V2Game = import("./schema.ts").KitGameInput;
let ids = 0;
/** A rule with fresh ids (actions without them get some). */
const rule = (r: Omit<V2Rule, "id" | "then"> & { then: Record<string, unknown>[] }): V2Rule =>
  ({ ...r, id: `r-t${++ids}`, then: r.then.map((a) => ({ id: `a-t${++ids}`, ...a })) }) as V2Rule;
const thing = (id: string, extra: Partial<V2Type> = {}): V2Type => ({ id, label: id, width: 8, height: 8, frames: [box(8, 8)], palette: "p", ...extra });
const player = (extra: Partial<V2Type> = {}) =>
  thing("hero", { control: { joystick: 1, axes: "8way", mode: "direct", speed: { step: 3 } }, move: { wall: "slide", edge: "stop" }, ...extra });
/** A v2 game from a picture of the room: `#` wall, `P` the first kind, `A`/`B`/`C` the next ones. */
function v2(room: string[], types: V2Type[], rules: V2Rule[] = [], extra: Partial<V2Game> = {}): V2Game {
  const rows = [...room, ...Array(11).fill("")].slice(0, 11).map((r) => r.padEnd(20, " "));
  const legend: Record<string, string> = { "#": "wall", "~": "hazard", "*": "goal" };
  "PABC".split("").forEach((ch, i) => types[i] && (legend[ch] = types[i]!.id));
  return {
    kit: 2,
    title: "Test",
    palettes: [{ id: "p", colors: ["$0F", "$46", "$86"] }],
    background: "$00",
    wallPalette: "p",
    textPalette: "p",
    types,
    room: { rows, legend },
    counters: [{ id: "lives", label: "Lives", start: 3 }],
    rules,
    text: { title: "T", win: "W", lose: "L" },
    ...extra,
  };
}
const walledRoom = (row: string, heroRow = "# P                #") => {
  const w = ["####################", ...Array(9).fill("#                  #"), "####################"];
  w[5] = row;
  w[8] = heroRow;
  return w;
};
const VEL: WatchMap = { vx1: { symbol: "ovx", offset: 1 }, vy1: { symbol: "ovy", offset: 1 }, vx0: { symbol: "ovx", offset: 0 }, vy0: { symbol: "ovy", offset: 0 } };

describe("kit format 2: movement parts", () => {
  it("velocity bounces at a wall, and 8.8 fractions add up", async () => {
    // 2 pixels a frame (32 sixteenths) to the right; the wall at x = 152 stops an 8-wide thing at x = 144.
    const fast = v2(walledRoom("#       A          #"), [player(), thing("ball", { move: { vx: 32, wall: "bounce", edge: "bounce" } })]);
    await runV2(fast, [{ until: { vx1: 254 }, maxFrames: 120, steps: [{ frames: 1 }] }, { frames: 20 }, { expect: { x1: { lt: 120 }, y1: 96 } }], VEL);
    // A sixteenth of a pixel a frame for 160 frames is 10 pixels (time-sliced or not).
    const slow = v2(walledRoom("#       A          #"), [player(), thing("ball", { move: { vx: 1, wall: "bounce", edge: "bounce" } })]);
    await runV2(slow, [{ frames: 160 }, { expect: { x1: { gte: 72, lte: 74 } } }], VEL);
  });

  it("stop, turn, slide and destroy at a wall; wrap and pass at an edge", async () => {
    const mover = (move: object) => [player(), thing("m", { move: { wall: "stop", edge: "stop", ...move } })];
    await runV2(v2(walledRoom("#       A          #"), mover({ vx: 32, wall: "stop" })), [{ frames: 60 }, { expect: { x1: 144, vx1: 0 } }], VEL);
    // A quarter turn clockwise: moving right becomes moving down.
    await runV2(v2(walledRoom("#       A          #"), mover({ vx: 32, wall: "turn" })), [{ until: { vy1: 2 }, maxFrames: 120, steps: [{ frames: 1 }] }, { expect: { vx1: 0 } }], VEL);
    // Sliding stops only the blocked axis: it keeps falling along the wall.
    await runV2(v2(walledRoom("#       A          #"), mover({ vx: 16, vy: 16, wall: "slide" })), [{ frames: 120 }, { expect: { x1: 144, y1: 168, vx1: 0 } }], VEL);
    await runV2(v2(walledRoom("#       A          #"), mover({ vx: -32, wall: "destroy" })), [{ until: { type1: 255 }, maxFrames: 120, steps: [{ frames: 1 }] }]);
    const open = ["", "", "", "", "               A", "", "", "", "", "P"];
    await runV2(v2(open, mover({ vx: 32, edge: "wrap" })), [{ until: { x1: { gte: 150 } }, maxFrames: 120, steps: [{ frames: 1 }] }, { until: { x1: { lt: 16 } }, maxFrames: 20, steps: [{ frames: 1 }] }]);
    // Passing with no rule to catch it: gone once it's wholly off the screen.
    await runV2(v2(open, mover({ vx: 32, edge: "pass" })), [{ until: { type1: 255 }, maxFrames: 60, steps: [{ frames: 1 }] }, { expect: { x1: { gte: 160 } } }]);
  });

  it("steers toward the nearest of several, and away", async () => {
    const chaser = thing("ghost", { steer: { toward: "coin", speed: { step: 3 } }, move: { wall: "slide", edge: "stop" } });
    // Coins at x = 24 and x = 96; the ghost at x = 72 heads for the nearer one, on the right.
    const g = v2(["", "", "", "", "P  B     A  B"], [player(), chaser, thing("coin")]);
    await runV2(g, [{ frames: 40 }, { expect: { x1: 96 } }]);
    const fleer = thing("mouse", { steer: { toward: "hero", away: true, speed: { step: 3 } }, move: { wall: "slide", edge: "stop" } });
    await runV2(v2(["", "", "", "", "P  A"], [player(), fleer]), [{ frames: 60 }, { expect: { x1: { gte: 80 } } }]);
  });

  it("gravity pulls down to a top speed; a jump is a rule", async () => {
    const jumper = player({
      control: { joystick: 1, axes: "lr", mode: "direct", speed: { step: 3 } },
      gravity: { amount: 4, max: 64 },
      move: { wall: "slide", edge: "stop" },
    });
    const jump = rule({ when: { button: { joy: 1, button: 1 } }, if: [{ a: { contact: "bottom", of: "it" }, op: "eq", b: 1 }], then: [{ set: { what: { prop: "vy", of: "it" }, to: -48 } }] });
    // The hero starts in the air above a floor (row 9 is wall): it lands at y = 160 - 8 = 152.
    const room = ["", "   P", "", "", "", "", "", "", "", "####################"];
    await runV2(v2(room, [jumper], [jump]), [
      { until: { heroY: 152 }, maxFrames: 120, steps: [{ frames: 1 }] },
      { frames: 10 },
      { expect: { heroY: 152 } },
      { hold: ["fire"], frames: 2 },
      { frames: 8 },
      { expect: { heroY: { lt: 140 } } },
      { until: { heroY: 152 }, maxFrames: 120, steps: [{ frames: 1 }] },
    ]);
  });

  it("'keep going' control keeps moving after the joystick is let go", async () => {
    const snake = player({ control: { joystick: 1, axes: "4way", mode: "keep", speed: { step: 3 } } });
    await runV2(v2(["", "", "", "", "P"], [snake]), [{ hold: ["right"], frames: 2 }, { frames: 40 }, { expect: { heroX: { gte: 40 } } }]);
  });
});

describe("kit format 2: events", () => {
  const CNT: WatchMap = { hits: { symbol: "c_hits" }, n: { symbol: "c_n" } };
  const hits = [{ id: "lives", label: "Lives", start: 3 }, { id: "hits", label: "Hits", start: 0 }, { id: "n", label: "N", start: 0 }];

  it("a thing that's removed can leave something where it was (destroyed, created)", async () => {
    const rules = [
      rule({ when: { touch: ["hero", "crate"] }, then: [{ destroy: "other" }] }),
      rule({ when: { destroyed: "crate" }, then: [{ create: { type: "coin", at: "it" } }, { add: { what: { counter: "n" }, by: 1 } }] }),
      rule({ when: { button: { joy: 1, button: 1 } }, then: [{ create: { type: "spark", at: "it" } }] }),
      rule({ when: { created: "spark" }, then: [{ add: { what: { counter: "hits" }, by: 1 } }] }),
    ];
    // Slots: hero 0, crate 1, coin 2 and spark 3 (room for one of each created).
    const g = v2(["", "", "", "", "P   A"], [player(), thing("crate"), thing("coin"), thing("spark")], rules, { counters: hits });
    await runV2(g, [{ hold: ["right"], frames: 30 }, { frames: 2 }, { expect: { type1: 255, type2: 2, x2: 32, n: 1, hits: 0 } }, { hold: ["fire"], frames: 2 }, { expect: { type3: 3, hits: 1 } }], CNT);
    // A rule run by a thing appearing or going can't set off another such rule (that could nest without end).
    const nested = v2(["", "", "", "", "P   A"], [player(), thing("crate"), thing("coin")], [rules[0]!, rules[1]!, rule({ when: { created: "coin" }, then: [{ add: { what: { counter: SCORE_ID }, by: 10 } }] })]);
    expect(await buildKitRom(nested, SOUND_LIBRARY, builder)).toMatchObject({ ok: false, failure: expect.stringContaining("sets off another such rule") });
  });

  it("a thing's own timer runs out", async () => {
    const rules = [
      rule({ when: { roomStart: true }, then: [{ set: { what: { prop: "timer", of: { every: "bomb" } }, to: 10 } }] }),
      rule({ when: { timerOut: "bomb" }, then: [{ destroy: "it" }, { add: { what: { counter: SCORE_ID }, by: 50 } }] }),
    ];
    const g = v2(["", "", "", "", "P   A"], [player(), thing("bomb")], rules);
    await runV2(g, [{ frames: 40 }, { expect: { type1: 1, score: 0 } }, { until: { type1: 255 }, maxFrames: 60, steps: [{ frames: 1 }] }, { frames: 2 }, { expect: { score: 50 } }]);
  });

  it("button released, joystick pushed, every N frames", async () => {
    const rules = [
      rule({ when: { button: { joy: 1, button: 1, released: true } }, then: [{ add: { what: { counter: "hits" }, by: 1 } }] }),
      rule({ when: { pushed: { joy: 1, dir: "up" } }, then: [{ add: { what: { counter: "n" }, by: 10 } }] }),
    ];
    const g = v2(["", "", "", "", "P"], [player({ move: { wall: "slide", edge: "stop" } })], rules, { counters: hits });
    // (Letting go of fire after starting the game counts once.)
    await runV2(g, [{ expect: { hits: 1 } }, { hold: ["fire"], frames: 10 }, { expect: { hits: 1 } }, { frames: 2 }, { expect: { hits: 2 } }, { hold: ["up"], frames: 20 }, { expect: { n: 10 } }], CNT);
    const every = v2(["", "", "", "", "P"], [player()], [rule({ when: { every: 10, frames: true }, then: [{ add: { what: { counter: "n" }, by: 1 } }] })], { counters: hits });
    await runV2(every, [{ frames: 100 }, { expect: { n: { gte: 9, lte: 10 } } }], CNT);
  });

  it("messages wait for the next frame, so two rules sending each other can't hang", async () => {
    const rules = [
      rule({ when: { every: 1 }, then: [{ send: "ping" }] }),
      rule({ when: { message: "ping" }, then: [{ add: { what: { counter: "hits" }, by: 1 } }, { send: "pong" }] }),
      rule({ when: { message: "pong" }, then: [{ add: { what: { counter: "n" }, by: 1 } }, { send: "ping" }] }),
    ];
    const g = v2(["", "", "", "", "P"], [player()], rules, { counters: hits, messages: ["ping", "pong"] });
    // Once started, the two message rules take turns, one a frame.
    await runV2(g, [{ frames: 100 }, { expect: { hits: { gte: 15 }, n: { gte: 15 }, loops: { gte: 100 } } }], CNT);
  });

  it("a test fires once each time it becomes true; 'while' fires every frame", async () => {
    const rules = [
      rule({ when: { test: { a: { counter: "seconds" }, op: "gte", b: 1 } }, then: [{ add: { what: { counter: "hits" }, by: 1 } }] }),
      rule({ when: { test: { a: { counter: "seconds" }, op: "gte", b: 1 } }, fires: "while", then: [{ add: { what: { counter: "n" }, by: 1 } }] }),
    ];
    const g = v2(["", "", "", "", "P"], [player()], rules, { counters: hits });
    // "While" rules on tests run on odd frames: about 20 in 40 frames.
    await runV2(g, [{ frames: 100 }, { expect: { hits: 1, n: { gte: 15, lte: 25 } } }], CNT);
  });

  it("any thing at an edge, once: a formation turns together", async () => {
    const march = thing("inv", { move: { vx: 16, wall: "through", edge: "pass", smooth: true } });
    const turn = rule({ when: { edge: ["inv", "sides"] }, any: true, fires: "once", then: [{ set: { what: { prop: "vx", of: { every: "inv" } }, to: { prop: "vx", of: "target", neg: true } } }, { add: { what: { prop: "y", of: { every: "inv" } }, by: 8 } }] });
    const g = v2(["", "             A A A", "             A A A", "", "", "", "", "", "", "P"], [player(), march], [turn]);
    // Slots 1-6; after the turn all six move left, 8 lower.
    await runV2(g, [{ until: { y1: 40 }, maxFrames: 200, steps: [{ frames: 1 }] }, { frames: 10 }, { expect: { y3: 40, x1: { lt: 140 }, x3: { lt: 156 } } }]);
  });
});

const SCORE_ID = "score";

describe("kit format 2: targets, values and actions", () => {
  const CNT: WatchMap = { hits: { symbol: "c_hits" }, a1: { symbol: "oa", offset: 1 }, a2: { symbol: "oa", offset: 2 }, a3: { symbol: "oa", offset: 3 } };
  const hits = [{ id: "lives", label: "Lives", start: 3 }, { id: "hits", label: "Hits", start: 0 }];

  it("every X whose …, the nearest X, a random X; per-thing variables", async () => {
    const coin = thing("coin", { vars: { a: { name: "worth", start: 5 } } });
    const rules = [
      // Coins right of x = 60 get worth 9; the nearest coin to the hero gets 1.
      rule({ when: { roomStart: true }, then: [{ set: { what: { prop: "a", of: { every: "coin", where: { a: { prop: "x", of: "target" }, op: "gt", b: 60 } } }, to: 9 } }] }),
      rule({ when: { pushed: { joy: 1, dir: "any" } }, then: [{ set: { what: { prop: "a", of: { nearest: "coin" } }, to: 1 } }, { add: { what: { prop: "a", of: { random: "coin" } }, by: 100 } }] }),
    ];
    // Coins at x = 32, 72, 112 (slots 1-3).
    const g = v2(["", "", "", "", "P   A    A    A"], [player(), coin], rules, { counters: hits });
    await runV2(g, [{ frames: 4 }, { expect: { a1: 5, a2: 9, a3: 9 } }, { hold: ["up"], frames: 2 }, { frames: 2 }, { expect: { a1: { gte: 1 } } }], CNT);
  });

  it("values: joystick × a number gives an aimed shot's velocity; create at a point", async () => {
    const rules = [
      rule({
        when: { button: { joy: 1, button: 1 } },
        then: [{ create: { type: "bullet", at: "it", place: "centre", vx: { joy: 1, axis: "x", times: 16 }, vy: { joy: 1, axis: "y", times: 16 } } }],
      }),
      rule({ when: { roomStart: true }, then: [{ create: { type: "flag", at: { x: 100, y: { counter: "hits", plus: 50 } } } }] }),
    ];
    const bullet = thing("bullet", { width: 4, height: 4, frames: [box(4, 4)], move: { wall: "destroy", edge: "destroy", smooth: true }, cap: 2 });
    const g = v2(["", "", "", "", "     P"], [player({ control: { joystick: 1, axes: "8way", mode: "direct", speed: { step: 1 } } }), bullet, thing("flag")], rules, { counters: hits });
    // Slots: hero 0, bullets 1-2, flag 3. Fire while pushing left: the bullet (from x = 42) flies left, a pixel a frame.
    await runV2(
      g,
      [{ expect: { x3: 100, y3: 50 } }, { hold: ["left", "fire"], frames: 2 }, { frames: 4 }, { expect: { type1: 1, x1: { gte: 34, lte: 38 }, y1: 82 } }],
      { ...CNT, ...VEL },
    );
  });

  it("step walks a thing and walls stop it; protect makes touches skip it", async () => {
    const rules = [
      rule({ when: { every: 1 }, then: [{ step: { who: { every: "box" }, dx: 8, dy: 0 } }] }),
      rule({ when: { touch: ["hero", "spike"] }, then: [{ take: { what: { counter: "lives" }, by: 1 } }, { protect: { who: "it", tenths: 30 } }] }),
    ];
    // The box (slot 1) steps right once a second until the wall in column 9 stops it at x = 64.
    const g = v2(["", "", "", "", "     A   #", "", "", "P B"], [player(), thing("box"), thing("spike")], rules);
    await runV2(g, [{ frames: 300 }, { expect: { x1: 64 } }, { hold: ["right"], frames: 30 }, { expect: { lives: 2 } }]);
  });

  it("counters named like 7800basic's own variables still build", async () => {
    // `a` is one of 7800basic's built-in variables, score0 its score, and no variable may start with
    // "switch"; the runtime names counters c_<label>, numbered when two labels come out the same.
    const g = v2(["", "", "", "", "P"], [player()], [rule({ when: { every: 1 }, then: [{ add: { what: { counter: "a" }, by: 1 } }, { add: { what: { counter: "again" }, by: 2 } }] })], {
      counters: [
        { id: "a", label: "a", start: 0 },
        { id: "points", label: "Score", start: 0 },
        { id: "again", label: "A!", start: 0 },
        { id: "switch", label: "Switch", start: 0 },
        { id: "then", label: "then to next", start: 0 },
      ],
    });
    const low = validateKit(g, SOUND_LIBRARY);
    expect(low.ok && low.ir.counters.map((c) => c.name)).toEqual(["c_a", "c_score", "c_a2", "c_switch", "c_then_to_next"]);
    await runV2(g, [{ frames: 130 }, { expect: { a: 2, again: 4 } }], { a: { symbol: "c_a" }, again: { symbol: "c_a2" } });
    // "score" is the built-in score, so a counter can't take the name.
    expect(await buildKitRom(v2(["P"], [player()], [], { counters: [{ id: "score", label: "Score", start: 0 }] }), SOUND_LIBRARY, builder)).toMatchObject({ ok: false });
  });

  it("run code: a rule calls the game's own routine; hooks run each frame", async () => {
    const g = v2(["", "", "", "", "P"], [player()], [rule({ when: { every: 1 }, then: [{ run: "bonus" }] })], {
      counters: hits,
      code: { frame: " c_hits = 7", routines: [{ label: "bonus", body: " score0 = score0 + 100" }] },
    });
    await runV2(g, [{ frames: 130 }, { expect: { score: 200, hits: 7 } }], CNT);
  });
});

describe("kit format 2: rooms and flow", () => {
  it("exits lead to the next room, the hero comes along, and taken things stay taken", async () => {
    const rules = [rule({ when: { touch: ["hero", "gem"] }, then: [{ destroy: "other" }, { add: { what: { counter: SCORE_ID }, by: 10 } }] })];
    const g = v2(["", "", "", "", "P  A"], [player(), thing("gem")], rules, {
      room: { rows: ["", "", "", "", "P  A"].concat(Array(6).fill("")).map((r) => r.padEnd(20)), legend: { P: "hero", A: "gem" }, exits: { right: 2 } },
      rooms: [{ rows: Array(11).fill(" ".repeat(20)), exits: { left: 1 } }],
      flow: { remember: true },
    });
    await runV2(g, [
      { hold: ["right"], frames: 30 },
      { expect: { score: 10, room: 1 } },
      { until: { room: 2 }, maxFrames: 200, steps: [{ hold: ["right"], frames: 1 }] },
      { expect: { heroX: { lt: 8 } } },
      { until: { room: 1 }, maxFrames: 200, steps: [{ hold: ["left"], frames: 1 }] },
      { frames: 2 },
      // The gem was taken, so room 1 doesn't place it again.
      { expect: { type1: 255, heroX: { gte: 140 } } },
    ]);
  });

  it("no title screen: straight into play; the end screen goes back to the title by itself", async () => {
    const g = v2(["", "", "", "", "P"], [player()], [rule({ when: { after: 1 }, then: [{ gameOver: "won" }] })], { flow: { title: false, end: { show: ["lives"], after: 2 } } });
    const rom = await buildKitRom(g, SOUND_LIBRARY, builder);
    if (!rom.ok) throw new Error(rom.failure);
    const r = await runRomOnHost(host, rom.a78, rom.symbols, KIT_WATCH, [
      { frames: 10 },
      { expect: { state: 1 } },
      { until: { state: 2 }, maxFrames: 200, steps: [{ frames: 1 }] },
      { until: { state: 0 }, maxFrames: 200, steps: [{ frames: 1 }] },
    ]);
    expect(r.failure ?? null).toBeNull();
  });

  it("the title gives way to a demo with recorded input; a real press ends it", async () => {
    const g = v2(["", "", "", "", "P"], [player()], [], { flow: { attract: { after: 3, input: [8, 30, 4, 30] } } });
    const rom = await buildKitRom(g, SOUND_LIBRARY, builder);
    if (!rom.ok) throw new Error(rom.failure);
    const r = await runRomOnHost(host, rom.a78, rom.symbols, KIT_WATCH, [
      { frames: 150 },
      { expect: { state: 0 } },
      { until: { state: 4 }, maxFrames: 100, steps: [{ frames: 1 }] },
      { frames: 20 },
      { expect: { heroX: { gt: 0 } } },
      { hold: ["up"], frames: 2 },
      { expect: { state: 0 } },
    ]);
    expect(r.failure ?? null).toBeNull();
  });
});
