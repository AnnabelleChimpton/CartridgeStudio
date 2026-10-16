// The kit music player in MAME's a7800 driver: the same test program as the
// js7800 suite (app/src/kit/audio-testrom.ts), playing every tune in the
// library. Each jingle must still be playing a few frames before its length
// and stop within a few frames after; each title loop must keep going.

import { beforeAll, describe, expect, it } from "vitest";
import type { WasiBuilder } from "@cartridge-studio/toolchain";
import type { Step } from "../../app/src/harness/behaviour.ts";
import { nodeBuilder } from "../../app/src/harness/node.ts";
import { MUSIC_LIBRARY, compileTune } from "../../app/src/kit/audio.ts";
import { testProgram } from "../../app/src/kit/audio-testrom.ts";
import { findMame, runRomInMame, type Mame } from "./mame.ts";

const found = findMame();
const mame = "missing" in found ? undefined : found;

let builder: WasiBuilder;
beforeAll(async () => {
  builder = await nodeBuilder();
});

const WATCH = {
  state: { symbol: "musicstate" },
  clock: { symbol: "musicclock" },
  loops: { symbol: "loopslo", bytes: 2 },
};

describe.skipIf(!mame)("music player in MAME", () => {
  it("plays every tune in the library for its length", async () => {
    const steps: Step[] = [{ frames: 30 }];
    for (const tune of MUSIC_LIBRARY) {
      const c = compileTune(tune);
      steps.push({ hold: ["fire"], frames: 1 }, { frames: 1 });
      if (c.loop) {
        steps.push({ frames: c.frames + 30 }, { expect: { state: 2 } }, { hold: ["down"], frames: 1 }, { frames: 1 }, { expect: { state: 0 } });
      } else {
        steps.push({ frames: c.frames - 4 }, { expect: { state: 1 } }, { until: { state: 0 }, maxFrames: 8, steps: [{ frames: 1 }] });
      }
      steps.push({ frames: 5 });
    }
    const built = await builder.build({ source: testProgram(MUSIC_LIBRARY), sign: true });
    if (!built.ok) throw new Error(`${built.stage}: ${built.message}`);
    const result = await runRomInMame(built.a78, built.symbols, WATCH, { name: "music", steps }, mame as Mame, { timeoutMs: 170_000 });
    expect(result.failure ?? null).toBeNull();
  });
});
