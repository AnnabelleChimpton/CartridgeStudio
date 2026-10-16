import { describe, expect, it } from "vitest";
import {
  JINGLE_KINDS,
  MUSIC_LIBRARY,
  MusicPlayerModel,
  compileTune,
  compileVoice,
  encodeVoice,
  midiNote,
  musicInclude,
  renderFrames,
  tiaHz,
  tiaPitch,
  type Tune,
} from "./audio.ts";
import { synthesize } from "./tia-synth.ts";

const tune = (notes: string, extra: Partial<Tune> = {}): Tune => ({
  id: "test-1",
  kind: "start",
  label: "Test",
  blurb: "",
  tempo: 6,
  voices: [{ sound: "pure", envelope: "hold", volume: 10, notes }],
  ...extra,
});

describe("note names and tuning", () => {
  it("reads note names", () => {
    expect(midiNote("A4")).toBe(69);
    expect(midiNote("C4")).toBe(60);
    expect(midiNote("C#5")).toBe(73);
    expect(midiNote("Bb3")).toBe(58);
    expect(midiNote("H4")).toBeNull();
  });

  it("finds TIA's nearest settings", () => {
    // Middle C is exact on AUDC 12: 31400 / 6 / 20.
    expect(tiaPitch(60, "pure")).toMatchObject({ audc: 12, audf: 19 });
    expect(Math.abs(tiaPitch(60, "pure").cents)).toBeLessThan(1);
    // C5 and up use AUDC 4 (divide by 2).
    expect(tiaPitch(72, "pure")).toMatchObject({ audc: 4, audf: 29 });
    // The buzz bass: C2 is AUDC 1, AUDF 31.
    expect(tiaPitch(36, "buzz")).toMatchObject({ audc: 1, audf: 31 });
    expect(tiaHz(4, 29)).toBeCloseTo(523.3, 0);
  });
});

describe("compiling notes", () => {
  it("turns lengths into frames at the tune's tempo", () => {
    const { events } = compileVoice({ sound: "pure", envelope: "pluck", volume: 9, notes: "C5 16, E5 8, G5 4, C6 8., - 2, A5 8t, A5 4+16" }, 6);
    expect(events.map((e) => e.frames)).toEqual([6, 12, 24, 18, 48, 8 - 1, 1, 30]);
    expect(events[0]).toEqual({ frames: 6, vol: 9, audc: 4, audf: 29, env: 2 });
    expect(events[4]).toMatchObject({ vol: 0 });
  });

  it("separates repeated notes by a frame and merges rests", () => {
    const { events } = compileVoice({ sound: "pure", envelope: "hold", volume: 9, notes: "A5 8, A5 8, - 8, - 8 | B5 4" }, 6);
    expect(events.map((e) => [e.frames, e.vol])).toEqual([
      [11, 9],
      [1, 0],
      [12, 9],
      [24, 0],
      [24, 9],
    ]);
  });

  it("reads drums and slides", () => {
    const { events } = compileVoice({ sound: "buzz", envelope: "pluck", volume: 9, notes: "K 8, S 8, H 16, E2 4~, A2 4^" }, 6);
    expect(events.map((e) => e.audc)).toEqual([15, 8, 8, 1, 1]);
    expect(events.map((e) => e.env)).toEqual([4, 4, 5, 6, 7]);
  });

  it("explains mistakes", () => {
    const bad = (notes: string, tempo = 6) => () => compileVoice({ sound: "pure", envelope: "hold", volume: 9, notes }, tempo);
    expect(bad("C5")).toThrow(/a note and a length/);
    expect(bad("C5 3")).toThrow(/isn't a note length/);
    expect(bad("H9 4")).toThrow(/isn't a note/);
    expect(bad("C1 4")).toThrow(/out of tune/);
    expect(bad("C5 8t", 4)).toThrow(/whole number of frames/);
    expect(bad("C5 1", 16)).toThrow(/longer than 255/);
    expect(() => compileTune(tune("C5 4", { kind: "title", voices: [tune("").voices[0]!, { sound: "pure", envelope: "hold", volume: 9, notes: "C5 4" }] })))
      .toThrow(/same length/);
  });

  it("encodes 3 bytes a note and a 0 at the end", () => {
    expect(encodeVoice([{ frames: 12, vol: 9, audc: 4, audf: 29, env: 2 }])).toEqual([12, 0x94, 0x5d, 0]);
  });
});

describe("the library", () => {
  const compiled = MUSIC_LIBRARY.map(compileTune);

  it("has three tunes for each moment, with unique ids", () => {
    for (const kind of JINGLE_KINDS) expect(MUSIC_LIBRARY.filter((t) => t.kind === kind).length).toBe(3);
    expect(new Set(MUSIC_LIBRARY.map((t) => t.id)).size).toBe(MUSIC_LIBRARY.length);
  });

  it.each(compiled.map((c) => [c.tune.id, c] as const))("%s compiles, in tune and the right length", (_, c) => {
    expect(c.worstCents).toBeLessThanOrEqual(30);
    const seconds = c.frames / 60;
    if (c.loop) {
      // 8 bars of 4/4: 128 sixteenths.
      expect(c.frames).toBe(128 * c.tune.tempo);
    } else {
      expect(seconds).toBeGreaterThanOrEqual(2);
      expect(seconds).toBeLessThanOrEqual(4);
    }
    expect(c.voices).toHaveLength(2);
  });

  it("no two tunes share a melody", () => {
    const shape = (c: (typeof compiled)[number]) => c.voices[0]!.filter((e) => e.vol).map((e) => `${e.audc}/${e.audf}`).join(" ");
    expect(new Set(compiled.map(shape)).size).toBe(compiled.length);
  });
});

describe("the player model", () => {
  it("plays notes for their length, then stops a jingle", () => {
    const c = compileTune(tune("A5 16, - 16, C6 16"));
    const frames = renderFrames(c);
    expect(frames.length).toBe(19);
    expect(frames.slice(0, 6).every((f) => f[0]!.vol === 10 && f[0]!.audf === 17)).toBe(true);
    expect(frames.slice(6, 12).every((f) => f[0]!.vol === 0)).toBe(true);
    expect(frames[12]![0]).toEqual({ audc: 4, audf: 14, vol: 10 });
    expect(frames[18]![0]!.vol).toBe(0);
  });

  it("fades by its envelope", () => {
    const c = compileTune(tune("A5 4", { voices: [{ sound: "pure", envelope: "pluck", volume: 10, notes: "A5 4" }] }));
    const vols = renderFrames(c).map((f) => f[0]!.vol);
    // Clock 1 is the first frame; pluck drops 1 whenever clock & 3 = 0.
    expect(vols.slice(0, 9)).toEqual([10, 10, 10, 9, 9, 9, 9, 8, 8]);
  });

  it("loops, and gives way to sound effects only in a loop", () => {
    const loop = new MusicPlayerModel();
    loop.play([encodeVoice([{ frames: 2, vol: 8, audc: 4, audf: 17, env: 0 }])], true);
    for (let i = 0; i < 10; i++) loop.tick();
    expect(loop.state).toBe(2);
    expect(loop.tick([true, false])).toEqual([false, false]);
    const jingle = new MusicPlayerModel();
    jingle.play([encodeVoice([{ frames: 20, vol: 8, audc: 4, audf: 17, env: 0 }])], false);
    expect(jingle.tick([true, false])).toEqual([true, false]);
  });
});

describe("generator glue", () => {
  it("emits the player, data and calls for a game's choices", () => {
    const inc = musicInclude({ start: "start-2", over: "over-1", title: "loop-1" });
    expect(inc.index).toEqual({ start: 0, over: 1, title: 2 });
    expect(inc.play.over).toBe(" musictune = 1 : gosub musicplay");
    expect(inc.stop).toBe(" gosub musicstop");
    expect(inc.vars).toContain("dim musicstate = $2780");
    expect(inc.code).toContain("userinterrupt");
    expect(inc.code).toContain("mus_loop_1_v1");
    expect(inc.code).toMatch(/mustunemode\n \.byte 1, 1, 2/);
    expect(musicInclude({ start: "start-1" }, { ownInterrupt: false, ram: 0x2600 }).code).not.toContain("userinterrupt");
    expect(musicInclude({ start: "start-1" }, { ram: 0x2600 }).vars).toContain("dim musicstate = $2600");
    expect(musicInclude({})).toMatchObject({ vars: "", code: "", stop: "" });
  });

  it("refuses unknown tunes and tunes in the wrong slot", () => {
    expect(() => musicInclude({ start: "start-9" })).toThrow(/no tune/);
    expect(() => musicInclude({ start: "over-1" })).toThrow(/is a game over tune, not a game start tune/);
  });
});

describe("the preview synth", () => {
  it("plays a pure note at TIA's pitch", () => {
    const c = compileTune(tune("A5 2"));
    const { samples, rate } = synthesize(c);
    // Count rising zero crossings over the middle of the note.
    const from = Math.round(rate * 0.1);
    const to = Math.round(rate * 0.4);
    let crossings = 0;
    for (let i = from + 1; i < to; i++) if (samples[i - 1]! <= 0 && samples[i]! > 0) crossings++;
    const hz = crossings / ((to - from) / rate);
    expect(hz).toBeGreaterThan(tiaHz(4, 17)! * 0.98);
    expect(hz).toBeLessThan(tiaHz(4, 17)! * 1.02);
  });
});
