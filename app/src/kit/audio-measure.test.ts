// What the music player costs in the kit's CPU model (not part of the normal run):
//   KIT_MEASURE=1 npx vitest run src/kit/audio-measure.test.ts
// Same method as kit-measure.test.ts: a busy kit game (walled room, 8
// bouncers) gets "still" fillers until it drops below 60 fps; one filler is
// about 4.5 points. The player is spliced into the generated program the way
// the integration note describes, playing the busiest title loop the whole
// time. To see past the measurement's resolution, the interrupt also calls
// the player 8 and 16 times a frame, and the cost is divided out.

import { beforeAll, describe, expect, it } from "vitest";
import type { WasiBuilder } from "@cartridge-studio/toolchain";
import { parseSymbols, type CoreHost } from "../emulator/core-host.ts";
import { nodeBuilder, nodeHost } from "../harness/node.ts";
import { SOUND_LIBRARY } from "../project/templates.ts";
import { musicInclude } from "./audio.ts";
import { generateKit } from "./generate.ts";
import { loadKit } from "./migrations.ts";
import type { KitGame } from "./schema.ts";

const box = (w: number, h: number) => Array.from({ length: h }, () => "1".repeat(w));
const type = (id: string, behaviour: string, extra: Record<string, unknown> = {}) => ({
  id, label: id, width: 8, height: 8, frames: [box(8, 8)], palette: "p", behaviour, speed: 3, ...extra,
});

/** The measurement game, written as a version 1 game and migrated (the same path old saves take). */
function base(fillers: number): KitGame {
  const g = loadKit(baseV1(fillers));
  if (!g.ok) throw new Error(g.errors.join(" "));
  return g.game;
}

function baseV1(fillers: number) {
  const rows = ["####################", ...Array.from({ length: 9 }, () => "#                  #"), "####################"].map((r) => [...r]);
  rows[9]![2] = "P";
  for (let k = 0; k < 8; k++) rows[1 + (k % 4) * 2]![2 + Math.floor(k / 4) * 4] = "M";
  for (let k = 0; k < fillers; k++) rows[2 + (k % 7)]![11 + Math.floor(k / 7) * 2] = "R";
  return {
    kit: 1,
    title: "Measure",
    palettes: [{ id: "p", colors: ["$0F", "$46", "$86"] }],
    background: "$00",
    wallPalette: "p",
    textPalette: "p",
    lives: 3,
    types: [type("hero", "player-8way"), type("mover", "bounce", { speed: 2 }), type("rock", "still")],
    room: { rows: rows.map((r) => r.join("")), legend: { "#": "wall", "~": "hazard", P: "hero", M: "mover", R: "rock" } },
    counters: [],
    rules: [],
    text: { title: "M", win: "W", lose: "L" },
    sounds: {},
    cartridge: { manualText: null },
  };
}

/** The kit program with the player added: `ticks` player calls per frame (0 for no music at all). */
export function withMusic(source: string, ticks: number): string {
  if (ticks === 0) return source;
  const inc = musicInclude({ title: "loop-2" }, { ownInterrupt: false });
  const lines = source.split("\n");
  const init = lines.findIndex((l) => l.startsWith(" autodim init"));
  lines.splice(init + 1, 0, inc.vars);
  const main = lines.indexOf("main");
  lines.splice(main, 0, inc.play.title!);
  return [...lines, inc.code, "userinterrupt", ...Array(ticks).fill(" gosub musictick"), " return"].join("\n");
}

let builder: WasiBuilder;
let host: CoreHost;
beforeAll(async () => {
  builder = await nodeBuilder();
  host = await nodeHost();
});

async function fps(g: KitGame, ticks: number): Promise<number> {
  const gen = generateKit(g, SOUND_LIBRARY, { ignoreBudget: true });
  if (!gen.ok) throw new Error(gen.errors.join("; "));
  const built = await builder.build({ ...gen.input, source: withMusic(gen.input.source, ticks), sign: false });
  if (!built.ok) throw new Error(`${built.stage}: ${built.message}`);
  const s = parseSymbols(built.symbols);
  const loops = () => {
    const b = host.readMemory(s.get("loopslo")!, 2);
    return b[0]! + 256 * b[1]!;
  };
  await host.load(built.a78);
  host.step(5);
  host.setInput({ up: false, down: false, left: false, right: false, fire: true });
  host.step(2);
  host.setInput({ up: false, down: false, left: false, right: false, fire: false });
  host.step(10);
  if (ticks) expect(host.readMemory(s.get("musicstate")!)[0]).toBe(2);
  const l0 = loops();
  const f0 = host.frame;
  host.step(360);
  return ((loops() - l0) / (host.frame - f0)) * 60;
}

async function capacity(ticks: number): Promise<number> {
  let best = -1;
  for (let n = 0; n <= 15; n++) {
    if ((await fps(base(n), ticks)) < 59.5) break;
    best = n;
  }
  return best;
}

describe.skipIf(!process.env.KIT_MEASURE)("music player cost", () => {
  it("prices the player in cost-model points", { timeout: 1_800_000 }, async () => {
    const PER_FILLER = 4.5;
    const none = await capacity(0);
    for (const ticks of [1, 8, 16]) {
      const cap = await capacity(ticks);
      console.log(`player called ${ticks}× a frame: ${cap} fillers fit (no music: ${none}) → about ${(((none - cap) * PER_FILLER) / ticks).toFixed(2)} points per call (±${(PER_FILLER / ticks).toFixed(2)})`);
    }
  });
});
