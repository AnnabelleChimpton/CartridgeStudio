// The music player in a real ROM: a small test program includes every tune
// in the library through templates/kit/audio.bas.hbs and plays them in js7800.
// The player's RAM must match MusicPlayerModel frame for frame, and the
// console's audio output must be sound where the model has a note and
// silence where it has none. TIA's registers can't be read back, so the
// audio output stands in for them.

import { beforeAll, describe, expect, it } from "vitest";
import type { WasiBuilder } from "@cartridge-studio/toolchain";
import { parseSymbols, type CoreHost, type JoystickInput } from "../emulator/core-host.ts";
import { nodeBuilder, nodeHost } from "../harness/node.ts";
import { MUSIC_LIBRARY, compileTune, renderFrames, tiaHz, type Tune, type VoiceOut } from "./audio.ts";
import { testProgram } from "./audio-testrom.ts";

const IDLE: JoystickInput = { up: false, down: false, left: false, right: false, fire: false };

/** Test-only tunes: held notes for the pitch check. */
const held = (id: string, sound: "pure" | "buzz", notes: string): Tune => ({
  id,
  kind: "start",
  label: id,
  blurb: "",
  tempo: 15,
  voices: [{ sound, envelope: "hold", volume: 12, notes }],
});
const PITCH_TUNES = [held("pitch-1", "pure", "A5 2"), held("pitch-2", "pure", "C4 2"), held("pitch-3", "buzz", "C2 2")];

let builder: WasiBuilder;
let host: CoreHost;
let sym: Map<string, number>;
let perFrame: Float32Array[] = [];

beforeAll(async () => {
  builder = await nodeBuilder();
  host = await nodeHost();
});

async function load(tunes: Tune[]) {
  const built = await builder.build({ source: testProgram(tunes), sign: false });
  if (!built.ok) throw new Error(`${built.stage}: ${built.message}\n${built.log.split("\n").filter((l) => /error|not defined|unresolved/i.test(l)).slice(0, 20).join("\n")}`);
  sym = parseSymbols(built.symbols);
  await host.load(built.a78);
  host.step(10);
  host.takeSamples();
}

const read = (name: string, offset = 0) => host.readMemory(sym.get(name)! + offset)[0]!;
const voices = (): VoiceOut[] =>
  [0, 1].map((x) => ({ audc: read("musctl", x), audf: read("musfreq", x), vol: read("musvol", x) }));

/** Steps one frame, keeping that frame's audio. */
function frame(input: JoystickInput = IDLE) {
  host.setInput(input);
  host.step(1);
  perFrame.push(host.takeSamples());
}

function press(input: Partial<JoystickInput>) {
  frame({ ...IDLE, ...input });
  frame();
}

const variance = (xs: Float32Array) => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
};

/** Plays the next tune and records the player's voices each frame, until it stops or `max` frames pass. */
function record(max: number) {
  perFrame = [];
  const out: { state: number; v: VoiceOut[] }[] = [];
  frame({ ...IDLE, fire: true });
  out.push({ state: read("musicstate"), v: voices() });
  for (let f = 0; f < max && out[out.length - 1]!.state !== 0; f++) {
    frame();
    out.push({ state: read("musicstate"), v: voices() });
  }
  return out;
}

/** Where the model's first frame falls in a recording: the first frame whose voices match it. */
function align(rec: { v: VoiceOut[] }[], model: VoiceOut[][]): number {
  const at = rec.findIndex((r, i) => [0, 1, 2].every((k) => JSON.stringify(rec[i + k]?.v) === JSON.stringify(model[k])));
  expect(at, "the tune never starts as the model does").toBeGreaterThanOrEqual(0);
  return at;
}

describe("music player ROM", () => {
  it("plays every tune in the library exactly as the model does, with sound to match", { timeout: 120_000 }, async () => {
    await load(MUSIC_LIBRARY);
    const loops0 = read("loopslo") + 256 * read("loopshi");
    const checked = { loud: 0, silent: 0 };
    const frames0 = host.frame;
    for (const tune of MUSIC_LIBRARY) {
      const c = compileTune(tune);
      // A loop is checked through its first repeat.
      const model = c.loop ? renderFrames(c, 2).slice(0, c.frames + 60) : renderFrames(c);
      const rec = record(model.length + 10);
      const at = align(rec, model);
      const got = rec.slice(at, at + model.length).map((r) => r.v);
      expect(got, `${tune.id}: the player's voices, frame by frame`).toEqual(model);
      if (c.loop) {
        expect(rec[rec.length - 1]!.state, `${tune.id} keeps looping`).toBe(2);
        press({ down: true });
        expect(read("musicstate")).toBe(0);
        frame();
        frame();
        expect(variance(perFrame[perFrame.length - 1]!), `${tune.id}: silent once stopped`).toBeLessThan(1e-7);
      } else {
        // A jingle ends by itself, one frame after its last note.
        const end = rec.findIndex((r, i) => i > at && r.state === 0);
        expect(end - at, `${tune.id}: length in frames`).toBe(c.frames);
      }
      // The audio: sound under every stretch of notes, silence under every stretch of rests.
      // (The player runs late in a frame, so each check needs the frames either side to agree.)
      for (let f = 1; f < model.length - 1; f++) {
        const loud = (k: number) => Math.max(model[k]![0]!.vol, model[k]![1]!.vol);
        const audio = perFrame[at + f];
        if (!audio) continue;
        if (loud(f - 1) === 0 && loud(f) === 0 && loud(f + 1) === 0) {
          expect(variance(audio), `${tune.id} frame ${f} should be silent`).toBeLessThan(1e-7);
          checked.silent++;
        }
        if (loud(f - 1) >= 3 && loud(f) >= 3 && loud(f + 1) >= 3) {
          expect(variance(audio), `${tune.id} frame ${f} should sound`).toBeGreaterThan(1e-5);
          checked.loud++;
        }
      }
      for (let i = 0; i < 10; i++) frame();
    }
    expect(checked.loud).toBeGreaterThan(1500);
    expect(checked.silent).toBeGreaterThan(100);
    // Nothing else runs in this program, so it must hold 60 fps throughout.
    const loops = read("loopslo") + 256 * read("loopshi") - loops0;
    expect(loops / (host.frame - frames0)).toBeGreaterThan(0.99);
  });

  it("plays TIA's pitch for the notes the compiler chose", async () => {
    await load(PITCH_TUNES);
    const expected = [tiaHz(4, 17)!, tiaHz(12, 19)!, tiaHz(1, 31)!];
    for (const hz of expected) {
      perFrame = [];
      press({ fire: true });
      for (let i = 0; i < 40; i++) frame();
      const audio = Float32Array.from(perFrame.slice(10, 40).flatMap((a) => [...a]));
      const rate = (audio.length / 30) * 60;
      // The period: the lag with the strongest autocorrelation, searched around the expected one.
      const mean = audio.reduce((a, b) => a + b, 0) / audio.length;
      const x = audio.map((v) => v - mean);
      const lagFor = (f: number) => rate / f;
      let best = { lag: 0, r: -Infinity };
      for (let lag = Math.floor(lagFor(hz) * 0.9); lag <= Math.ceil(lagFor(hz) * 1.1); lag++) {
        let r = 0;
        for (let i = 0; i + lag < x.length; i++) r += x[i]! * x[i + lag]!;
        if (r > best.r) best = { lag, r };
      }
      // Two periods' worth of tolerance on short lags, so the check is about the note, not the sample rate.
      expect(rate / best.lag).toBeGreaterThan(hz * 0.97);
      expect(rate / best.lag).toBeLessThan(hz * 1.03);
      press({ down: true });
    }
  });

  it("a jingle takes its voices from sound effects; a loop gives way to them", async () => {
    await load([...MUSIC_LIBRARY.filter((t) => t.kind === "win"), MUSIC_LIBRARY.find((t) => t.kind === "title")!]);
    // A jingle: the effect starts, then the player cancels it within two frames.
    press({ fire: true });
    frame({ ...IDLE, up: true });
    frame();
    frame();
    expect(read("sfx1pointhi") | read("sfx1pointhi", 1)).toBe(0);
    expect(read("musicstate")).toBe(1);
    press({ down: true });
    // Skip to the loop (tune 3).
    press({ fire: true });
    press({ down: true });
    press({ fire: true });
    press({ down: true });
    press({ fire: true });
    expect(read("musicstate")).toBe(2);
    frame({ ...IDLE, up: true });
    frame();
    const ticks = read("musicclock");
    frame();
    frame();
    expect(read("sfx1pointhi") | read("sfx1pointhi", 1), "the effect keeps playing").not.toBe(0);
    expect(read("musicclock"), "and so does the music").toBe((ticks + 2) & 255);
    // Once the effect is over the music has its voice back, at the music's own pitch.
    for (let i = 0; i < 60 && read("sfx1pointhi") | read("sfx1pointhi", 1); i++) frame();
    expect(read("sfx1pointhi") | read("sfx1pointhi", 1)).toBe(0);
    perFrame = [];
    for (let i = 0; i < 30; i++) frame();
    expect(perFrame.filter((a) => variance(a) > 1e-5).length).toBeGreaterThan(15);
  });

  it("holds still while the console is paused", async () => {
    // A loop of long held notes: only the player's own rewrite brings the sound back after a pause.
    await load([{ ...held("pause-1", "pure", "A5 1, C6 1"), kind: "title" }]);
    press({ fire: true });
    for (let i = 0; i < 20; i++) frame();
    press({ pause: true });
    for (let i = 0; i < 5; i++) frame();
    const clock = read("musicclock");
    perFrame = [];
    for (let i = 0; i < 20; i++) frame();
    expect(read("musicclock")).toBe(clock);
    expect(variance(perFrame[perFrame.length - 1]!)).toBeLessThan(1e-7);
    press({ pause: true });
    perFrame = [];
    for (let i = 0; i < 30; i++) frame();
    expect(read("musicclock")).not.toBe(clock);
    // Pausing muted TIA; the player puts its voices back.
    expect(perFrame.filter((a) => variance(a) > 1e-5).length).toBeGreaterThan(15);
    expect(read("musicstate")).toBe(2);
  });
});
