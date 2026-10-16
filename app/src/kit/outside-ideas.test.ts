// The success measure for kit model v2 (docs/kit-model-v2.md, Part 3): eight
// game ideas the kit wasn't designed around, written as kit data. Each one
// that Phase A can express must validate, build, play its core moment and
// hold 60 fps. The count that matters is engine special cases (runtime code
// that exists for one kind of game): the last test checks the runtime and
// the emitter mention no game, genre or thing by name, so that count is 0.
//
// What Phase A can't express yet says so: Tag needs joystick 2 (the Player 2
// part is reserved), and Sokoban needs positional targets (cut with Phase C).

import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { WasiBuilder } from "@cartridge-studio/toolchain";
import type { CoreHost } from "../emulator/core-host.ts";
import { runRomOnHost, type Step, type WatchMap } from "../harness/behaviour.ts";
import { nodeBuilder, nodeHost } from "../harness/node.ts";
import { SOUND_LIBRARY } from "../project/templates.ts";
import { validateKit } from "./generate.ts";
import { loseLifeActions } from "./migrations.ts";
import type { KitGameInput, KitRule } from "./schema.ts";
import { KIT_WATCH, buildKitRom } from "./tests.ts";

type Type = KitGameInput["types"][number];
const box = (w: number, h: number) => Array.from({ length: h }, () => "1".repeat(w));
const thing = (id: string, extra: Partial<Type> = {}): Type => ({ id, label: id, width: 8, height: 8, frames: [box(8, 8)], palette: "p", ...extra });
let n = 0;
const rule = (r: Omit<KitRule, "id" | "then"> & { then: Record<string, unknown>[] }): KitRule =>
  ({ ...r, id: `r-i${++n}`, then: r.then.map((a) => ({ id: `a-i${++n}`, ...a })) }) as KitRule;
const lives = (players: string[]) => [
  ...loseLifeActions(`a-l${++n}`, players).map((a) => {
    const { id: _, ...rest } = a;
    return rest;
  }),
];
const livesOut = () => rule({ when: { test: { a: { counter: "lives" }, op: "eq", b: 0 } }, then: [{ gameOver: "lost" }] });

function game(rows: string[], types: Type[], rules: KitRule[], extra: Partial<KitGameInput> = {}): KitGameInput {
  const legend: Record<string, string> = { "#": "wall", "~": "hazard", "*": "goal" };
  "PABCDE".split("").forEach((ch, i) => types[i] && (legend[ch] = types[i]!.id));
  return {
    kit: 2,
    title: "Idea",
    palettes: [{ id: "p", colors: ["$0F", "$46", "$86"] }],
    background: "$00",
    wallPalette: "p",
    textPalette: "p",
    types,
    room: { rows: [...rows, ...Array(11).fill("")].slice(0, 11).map((r) => r.padEnd(20)), legend },
    counters: [{ id: "lives", label: "Lives", start: 3 }],
    hud: [
      { show: "score", at: "left" },
      { show: "lives", at: "right" },
    ],
    rules,
    text: { title: "Idea", win: "Win", lose: "Lose" },
    ...extra,
  };
}

const START: Step[] = [{ frames: 5 }, { hold: ["fire"], frames: 2 }, { frames: 2 }];
const slot = (k: number): WatchMap => ({ [`type${k}`]: { symbol: "otype", offset: k }, [`x${k}`]: { symbol: "ox", offset: k }, [`y${k}`]: { symbol: "oy", offset: k } });

interface Idea {
  name: string;
  /** In Phase A: fully, partly (what's missing), or not without a part that's coming. */
  phaseA: "yes" | "partly" | "no";
  note: string;
  game: KitGameInput;
  watch?: WatchMap;
  steps?: Step[];
  /** For "no": what validation says. */
  refused?: RegExp;
}

const hero8 = (extra: Partial<Type> = {}) => thing("hero", { control: { joystick: 1, axes: "8way", speed: { step: 3 } }, move: { wall: "slide", edge: "stop" }, ...extra });

const IDEAS: Idea[] = [
  {
    name: "Twin-stick-lite",
    phaseA: "partly",
    note: "Shots go the way the hero faces; aiming with joystick 2 waits for the Player 2 part.",
    game: game(
      ["", "", "", "", "", "", "", "", "", "         P"],
      [
        hero8(),
        thing("bullet", { width: 4, height: 4, frames: [box(4, 4)], move: { wall: "destroy", edge: "destroy", smooth: true }, cap: 4 }),
        thing("grunt", { steer: { toward: "hero", speed: { step: 2 } }, move: { wall: "slide", edge: "stop" }, cap: 4 }),
      ],
      [
        rule({
          when: { button: { joy: 1, button: 1 } },
          if: [{ a: { count: "bullet" }, op: "lt", b: 4 }],
          then: [{ create: { type: "bullet", at: "it", place: "centre", vx: { facing: "x", of: "it", times: 16 }, vy: { facing: "y", of: "it", times: 16 } } }],
        }),
        rule({ when: { every: 2 }, then: [{ create: { type: "grunt", at: { x: { random: 152 }, y: 16 } } }] }),
        rule({ when: { touch: ["bullet", "grunt"] }, then: [{ destroy: "it" }, { destroy: "other" }, { add: { what: { counter: "score" }, by: 50 } }] }),
        rule({ when: { touch: ["grunt", "hero"] }, then: lives(["hero"]) }),
        livesOut(),
      ],
    ),
    // Facing right after a step right, fire: a bullet (slots 1-4) flies right.
    watch: slot(1),
    steps: [...START, { hold: ["right"], frames: 4 }, { hold: ["fire"], frames: 2 }, { frames: 6 }, { expect: { type1: 1, x1: { gt: 82 } } }],
  },
  {
    name: "Rhythm game",
    phaseA: "partly",
    note: "Notes fall in two lanes on a timer instead of from a chart (tables were cut); music is the audio module's.",
    game: game(
      ["", "", "", "", "", "", "", "", "", "", "    PPPPPPPPPP"],
      [
        thing("bar", { width: 8, height: 4, frames: [box(8, 4)] }),
        thing("note-l", { move: { vy: 16, wall: "through", edge: "pass" }, cap: 3 }),
        thing("note-r", { move: { vy: 16, wall: "through", edge: "pass" }, cap: 3 }),
      ],
      [
        rule({ when: { every: 30, frames: true }, then: [{ create: { type: "note-l", at: { x: 40, y: 16 } } }] }),
        rule({ when: { every: 45, frames: true }, then: [{ create: { type: "note-r", at: { x: 104, y: 16 } } }] }),
        rule({ when: { pushed: { joy: 1, dir: "left" } }, then: [{ destroy: { every: "note-l", where: { a: { prop: "y", of: "target" }, op: "gte", b: 150 } } }] }),
        rule({ when: { pushed: { joy: 1, dir: "right" } }, then: [{ destroy: { every: "note-r", where: { a: { prop: "y", of: "target" }, op: "gte", b: 150 } } }] }),
        rule({ when: { destroyed: "note-l" }, then: [{ add: { what: { counter: "score" }, by: 100 } }, { add: { what: { counter: "combo" }, by: 1 } }] }),
        rule({ when: { leaves: "note-l" }, then: [{ set: { what: { counter: "combo" }, to: 0 } }] }),
      ],
      { counters: [{ id: "combo", label: "Combo", start: 0 }], hud: [{ show: "score", at: "left" }, { show: "combo", at: "right" }] },
    ),
    // Tap left over and over: a note in the left lane gets hit as it crosses the bar.
    steps: [...START, { until: { score: { gte: 100 } }, maxFrames: 400, steps: [{ hold: ["left"], frames: 2 }, { frames: 2 }] }],
  },
  {
    name: "Tag for 2 players",
    phaseA: "no",
    note: "Needs joystick 2: the Player 2 part is reserved, and validation says it's coming.",
    game: game(
      ["", "", "", "", "P        A"],
      [
        thing("it-1", { control: { joystick: 1, axes: "8way", speed: { step: 3 } }, move: { wall: "slide", edge: "stop" } }),
        thing("runner-2", { control: { joystick: 2, axes: "8way", speed: { step: 3 } }, move: { wall: "slide", edge: "stop" } }),
        thing("runner-1", { control: { joystick: 1, axes: "8way", speed: { step: 3 } }, move: { wall: "slide", edge: "stop" } }),
        thing("it-2", { control: { joystick: 2, axes: "8way", speed: { step: 3 } }, move: { wall: "slide", edge: "stop" } }),
      ],
      [
        rule({ when: { touch: ["it-1", "runner-2"] }, then: [{ turn: { who: "it", into: "runner-1" } }, { turn: { who: "other", into: "it-2" } }, { protect: { who: "other", tenths: 10 } }] }),
        rule({ when: { touch: ["it-2", "runner-1"] }, then: [{ turn: { who: "it", into: "runner-2" } }, { turn: { who: "other", into: "it-1" } }, { protect: { who: "other", tenths: 10 } }] }),
        rule({ when: { every: 1 }, if: [{ a: { count: "runner-1" }, op: "eq", b: 1 }], then: [{ add: { what: { counter: "p1" }, by: 1 } }] }),
        rule({ when: { every: 1 }, if: [{ a: { count: "runner-2" }, op: "eq", b: 1 }], then: [{ add: { what: { counter: "p2" }, by: 1 } }] }),
        rule({ when: { after: 60 }, if: [{ a: { counter: "p1" }, op: "gt", b: { counter: "p2" } }], then: [{ gameOver: "won" }] }),
      ],
      { counters: [{ id: "p1", label: "P1", start: 0 }, { id: "p2", label: "P2", start: 0 }], hud: [{ show: "p1", at: "left" }, { show: "p2", at: "right" }] },
    ),
    refused: /joystick 2: two players are coming soon/,
  },
  {
    name: "Snake-like",
    phaseA: "yes",
    note: "Lifetime, not linked segments: each step leaves a tail piece whose a counts down.",
    game: game(
      ["####################", "#                  #", "#                  #", "#    B             #", "#                  #", "#        P         #", "#                  #", "#                  #", "#                  #", "#                  #", "####################"],
      [
        thing("head", { move: { wall: "stop", edge: "stop" } }),
        thing("tail", { cap: 10 }),
        thing("food"),
      ],
      [
        ...(
          [
            ["left", 4, 0],
            ["right", 0, 4],
            ["up", 6, 2],
            ["down", 2, 6],
          ] as const
        ).map(([dir, face, opposite]) =>
          rule({
            when: { pushed: { joy: 1, dir } },
            then: [{ set: { what: { prop: "facing", of: { every: "head", where: { a: { prop: "facing", of: "target" }, op: "ne", b: opposite } } }, to: face } }],
          }),
        ),
        rule({
          when: { every: 8, frames: true },
          then: [
            { take: { what: { prop: "a", of: { every: "tail" } }, by: 1 } },
            { destroy: { every: "tail", where: { a: { prop: "a", of: "target" }, op: "eq", b: 0 } } },
            { create: { type: "tail", at: { every: "head" } } },
            { step: { who: { every: "head" }, dx: { facing: "x", of: "target", times: 8 }, dy: { facing: "y", of: "target", times: 8 } } },
          ],
        }),
        rule({ when: { created: "tail" }, then: [{ set: { what: { prop: "a", of: "it" }, to: { counter: "length" } } }] }),
        rule({
          when: { touch: ["head", "food"] },
          then: [
            { add: { what: { counter: "length" }, by: 1 } },
            { add: { what: { counter: "score" }, by: 10 } },
            { set: { what: { prop: "x", of: "other" }, to: { random: 17, times: 8, plus: 8 } } },
            { set: { what: { prop: "y", of: "other" }, to: { random: 8, times: 16, plus: 32 } } },
          ],
        }),
        rule({ when: { touch: ["head", "tail"] }, then: [{ gameOver: "lost" }] }),
      ],
      { counters: [{ id: "length", label: "Length", start: 2 }], hud: [{ show: "score", at: "left" }, { show: "length", at: "right" }] },
    ),
    // The head (slot 0, starting at x = 72) steps right 8 pixels every 8 frames, leaving tail pieces.
    watch: { ...slot(1), headX: { symbol: "ox", offset: 0 } },
    steps: [...START, { hold: ["right"], frames: 2 }, { frames: 40 }, { expect: { headX: { gte: 96 }, type1: 1 } }],
  },
  {
    name: "Sokoban",
    phaseA: "no",
    note: "Needs positional targets (\"the box at x, y\") and counts, cut with Phase C; a run code hook can push boxes meanwhile.",
    game: game(["", "", "", "", "P A"], [hero8(), thing("box")], [rule({ when: { pushed: { joy: 1, dir: "right" } }, then: [{ run: "push" }] })], {
      code: { routines: [{ label: "push", body: " rem the creator's own pushing code" }] },
    }),
  },
  {
    name: "Gravity flipper",
    phaseA: "yes",
    note: "Gravity from a per-thing variable, flipped by a rule; contact flags as conditions; checkpoints by 'set start here'.",
    game: game(
      ["####################", "#                  #", "#                  #", "#                  #", "#                  #", "#                  #", "#                  #", "#                  #", "#                  #", "#  P               #", "####################"],
      [
        thing("hero", {
          height: 14,
          frames: [box(8, 14)],
          control: { joystick: 1, axes: "lr", speed: { step: 3 } },
          gravity: { amount: { prop: "a" }, max: 48 },
          vars: { a: { name: "pull", start: 4 } },
          move: { wall: "slide", edge: "stop" },
        }),
      ],
      [
        rule({
          when: { button: { joy: 1, button: 1 } },
          if: [{ a: { contact: "bottom", of: "it" }, op: "eq", b: 1 }],
          then: [{ set: { what: { prop: "a", of: "it" }, to: { prop: "a", of: "it", neg: true } } }],
        }),
        rule({
          when: { button: { joy: 1, button: 1 } },
          if: [{ a: { contact: "top", of: "it" }, op: "eq", b: 1 }],
          then: [{ set: { what: { prop: "a", of: "it" }, to: { prop: "a", of: "it", neg: true } } }],
        }),
        rule({ when: { onTile: ["hero", "hazard"] }, then: [{ toStart: "it" }, { set: { what: { prop: "vy", of: "it" }, to: 0 } }] }),
        rule({ when: { onTile: ["hero", "goal"] }, then: [{ startHere: "it" }] }),
      ],
    ),
    // Standing on the floor (its top at y = 176 - 14), fire flips gravity: the hero falls up to the ceiling (y = 32).
    steps: [...START, { until: { heroY: 162 }, maxFrames: 120, steps: [{ frames: 1 }] }, { frames: 10 }, { hold: ["fire"], frames: 2 }, { until: { heroY: 32 }, maxFrames: 200, steps: [{ frames: 1 }] }],
  },
  {
    name: "Shmup with patterns",
    phaseA: "partly",
    note: "Weaves and rings of eight; aimed shots and loops need rotate and aim (cut).",
    game: game(
      ["", " B      A       B", "", "", "", "", "", "", "", "", "         P"],
      [
        thing("ship", { control: { joystick: 1, axes: "lr", speed: { step: 4 } }, move: { wall: "slide", edge: "stop" } }),
        thing("boss", { width: 16, frames: [box(16, 8)] }),
        thing("weaver", { move: { vx: 16, vy: 4, wall: "through", edge: "wrap" }, vars: { a: { name: "swing", start: 4 } } }),
        thing("bullet", { width: 4, height: 4, frames: [box(4, 4)], move: { wall: "through", edge: "pass" }, cap: 8 }),
      ],
      [
        rule({
          when: { every: 8, frames: true },
          then: [
            { add: { what: { prop: "vx", of: { every: "weaver" } }, by: { prop: "a", of: "target" } } },
            { set: { what: { prop: "a", of: { every: "weaver", where: { a: { prop: "vx", of: "target" }, op: "gte", b: 24 } } }, to: -4 } },
            { set: { what: { prop: "a", of: { every: "weaver", where: { a: { prop: "vx", of: "target" }, op: "lte", b: -24 } } }, to: 4 } },
          ],
        }),
        rule({
          when: { every: 2 },
          then: (
            [
              [16, 0],
              [11, 11],
              [0, 16],
              [-11, 11],
              [-16, 0],
              [-11, -11],
              [0, -16],
              [11, -11],
            ] as const
          ).map(([vx, vy]) => ({ create: { type: "bullet", at: { every: "boss" }, place: "centre", vx, vy } })),
        }),
        rule({ when: { touch: ["bullet", "ship"] }, then: [{ destroy: "it" }, ...lives(["ship"])] }),
        livesOut(),
      ],
    ),
    // After the first ring, the bullets' slots hold bullets.
    watch: { ...slot(4), ...slot(11) },
    steps: [...START, { until: { type4: 3 }, maxFrames: 200, steps: [{ frames: 1 }] }, { frames: 20 }, { expect: { loops: { gte: 140 } } }],
  },
  {
    name: "Toy with no win state",
    phaseA: "partly",
    note: "Stamps that drift and bounce, a cap of 12; painting tiles and cycling colours need set tile and set colour (cut).",
    game: game(
      ["", "", "", "", "         P"],
      [
        hero8(),
        thing("shape", { move: { wall: "bounce", edge: "bounce" }, cap: 12 }),
      ],
      [rule({ when: { button: { joy: 1, button: 1 } }, then: [{ create: { type: "shape", at: "it", vx: { facing: "x", of: "it", times: 8, plus: 2 }, vy: { facing: "y", of: "it", times: 8, plus: 2 } } }] })],
      { counters: [], hud: [], flow: { title: false } },
    ),
    // No title: play starts at once. Each press stamps a shape (slots 1-12) that drifts away.
    watch: slot(1),
    steps: [{ frames: 5 }, { hold: ["right"], frames: 4 }, { hold: ["fire"], frames: 2 }, { frames: 30 }, { expect: { type1: 1, state: 1, x1: { gt: 82 } } }],
  },
];

let builder: WasiBuilder;
let host: CoreHost;
beforeAll(async () => {
  builder = await nodeBuilder();
  host = await nodeHost();
});

describe("eight games the kit wasn't designed for", () => {
  for (const idea of IDEAS) {
    it(`${idea.name} (${idea.phaseA === "yes" ? "in Phase A" : idea.phaseA === "partly" ? "partly in Phase A" : "not yet"}): ${idea.note}`, async () => {
      const v = validateKit(idea.game, SOUND_LIBRARY);
      if (idea.refused) {
        expect(v.ok ? [] : v.errors.join(" ")).toMatch(idea.refused);
        return;
      }
      if (!v.ok) throw new Error(v.errors.join("\n"));
      if (!idea.steps) return;
      const rom = await buildKitRom(idea.game, SOUND_LIBRARY, builder);
      if (!rom.ok) throw new Error(rom.failure);
      const r = await runRomOnHost(host, rom.a78, rom.symbols, { ...KIT_WATCH, ...idea.watch }, idea.steps);
      expect(r.failure ?? null).toBeNull();
    });
  }

  it("needs no engine special cases: the runtime and the emitter name no game, genre or thing", () => {
    const runtime = [
      fs.readFileSync(path.resolve(import.meta.dirname, "../../../templates/kit/engine.bas.hbs"), "utf8"),
      fs.readFileSync(path.resolve(import.meta.dirname, "emit.ts"), "utf8"),
      fs.readFileSync(path.resolve(import.meta.dirname, "ir.ts"), "utf8"),
    ].join("\n");
    const presets = fs.readdirSync(path.resolve(import.meta.dirname, "../../../templates/kit/games")).filter((f) => f.endsWith(".json") && !f.endsWith(".tests.json"));
    const names = new Set<string>(["shooter", "maze", "dodger", "march", "invader", "projectile", "bomb", "bullet", "snake", "sokoban", "platform"]);
    for (const f of presets) {
      const g = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../../../templates/kit/games", f), "utf8")) as KitGameInput;
      for (const t of g.types) names.add(t.id).add(t.label.toLowerCase());
    }
    const found = [...names].filter((w) => w.length > 2 && new RegExp(`\\b${w.replace(/[-.]/g, "\\$&")}\\b`, "i").test(runtime));
    // Each word here would be an engine special case: runtime code for one game.
    expect(found).toEqual([]);
    const counted = IDEAS.map((i) => `${i.name}: ${i.phaseA}`);
    console.log(`outside ideas: special cases 0; ${counted.join(", ")}`);
  });
});
