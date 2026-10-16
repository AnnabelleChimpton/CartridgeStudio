// Kit music: a fixed library of short jingles and title loops, written as
// readable notes ("E5 8, A5 16") and compiled here to the TIA values the
// player in templates/kit/audio.bas.hbs reads. There is no tracker: a game
// picks one tune per moment (start, life lost, win, game over, title).
//
// A tune has two voices. Each note becomes 3 bytes: frames, volume*16+AUDC,
// envelope*32+AUDF; a 0 frame count ends the voice. MusicPlayerModel below
// does exactly what the 6502 player does, frame by frame, so tests can hold
// the ROM to it and the editor can preview a tune without building a ROM.

import Handlebars from "handlebars";
import { z } from "zod";
import jingleLibrary from "@cartridge-studio/templates/music/jingles.json";
import audioTemplate from "@cartridge-studio/templates/kit/audio.bas.hbs?raw";

/** TIA's audio clock on an NTSC console: the colour clock divided by 114. */
export const TIA_CLOCK = 3579545 / 114;
export const FRAME_RATE = 60;

export const JINGLE_KINDS = ["start", "lose", "win", "over", "title"] as const;
export type JingleKind = (typeof JINGLE_KINDS)[number];
export const JINGLE_MOMENTS: Record<JingleKind, string> = {
  start: "game start",
  lose: "life lost",
  win: "win or level clear",
  over: "game over",
  title: "title screen",
};

/** Voice sounds, by the AUDC values that can play them (each divides the clock by `div`). */
const SOUNDS = {
  /** Square waves; AUDC 4 and 12 sound the same, 12 reaches three times lower. */
  pure: [
    { audc: 4, div: 2 },
    { audc: 12, div: 6 },
  ],
  /** The classic TIA bass: a 15-step buzz. */
  buzz: [{ audc: 1, div: 15 }],
  /** A lower, rounder bass from a 31-step pattern. */
  bass: [{ audc: 6, div: 31 }],
} as const;
export type VoiceSound = keyof typeof SOUNDS;

export const ENVELOPES = ["hold", "fade", "pluck", "short"] as const;
const ENV = { hold: 0, fade: 1, pluck: 2, short: 3, drum: 4, hat: 5, slideDown: 6, slideUp: 7 } as const;
/** The player's envelope tables (audio.bas.hbs): the volume drops by `step` on frames where clock & mask = 0. */
export const ENV_MASK = [255, 7, 3, 1, 0, 0, 1, 1];
export const ENV_STEP = [0, 1, 1, 1, 1, 3, 0, 0];

/** Drum hits for any voice: kick, snare and hi-hat, from TIA's noise sounds. */
const DRUMS: Record<string, { audc: number; audf: number; vol: number; env: number }> = {
  K: { audc: 15, audf: 16, vol: 12, env: ENV.drum },
  S: { audc: 8, audf: 6, vol: 10, env: ENV.drum },
  H: { audc: 8, audf: 0, vol: 6, env: ENV.hat },
};

/** Notes further than this from true pitch are refused. The library keeps within 30. */
export const MAX_CENTS = 50;

const VoiceSchema = z
  .object({
    sound: z.enum(["pure", "buzz", "bass"]),
    envelope: z.enum(ENVELOPES),
    volume: z.number().int().min(1).max(15),
    notes: z.string(),
  })
  .strict();
export const TuneSchema = z
  .object({
    id: z.string().regex(/^[a-z]+-[0-9]+$/),
    kind: z.enum(JINGLE_KINDS),
    label: z.string(),
    blurb: z.string(),
    /** Frames per sixteenth note (6 is 150 beats a minute). */
    tempo: z.number().int().min(2).max(16),
    voices: z.array(VoiceSchema).min(1).max(2),
  })
  .strict();
export type Tune = z.infer<typeof TuneSchema>;
export type TuneVoice = z.infer<typeof VoiceSchema>;

export const MUSIC_LIBRARY: Tune[] = z.array(TuneSchema).parse(jingleLibrary);

/** One note or rest as the player sees it. */
export interface MusicEvent {
  frames: number;
  /** 0 for a rest. */
  vol: number;
  audc: number;
  audf: number;
  env: number;
}

export interface CompiledTune {
  tune: Tune;
  loop: boolean;
  voices: MusicEvent[][];
  /** The longer voice's length. */
  frames: number;
  /** Largest tuning error in the tune, in cents. */
  worstCents: number;
}

const NOTE_NAMES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** MIDI note number for names like "C#5" or "Bb3"; null if it isn't one. */
export function midiNote(name: string): number | null {
  const m = /^([A-G])([#b]?)(-?[0-9])$/.exec(name);
  if (!m) return null;
  return 12 * (Number(m[3]) + 1) + NOTE_NAMES[m[1]!]! + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}

export function noteHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** The TIA setting nearest a note, among the AUDC values a voice sound allows. */
export function tiaPitch(midi: number, sound: VoiceSound): { audc: number; audf: number; hz: number; cents: number } {
  const want = noteHz(midi);
  let best = { audc: 0, audf: 0, hz: 0, cents: Infinity };
  for (const { audc, div } of SOUNDS[sound]) {
    for (let audf = 0; audf < 32; audf++) {
      const hz = TIA_CLOCK / div / (audf + 1);
      const cents = 1200 * Math.log2(hz / want);
      if (Math.abs(cents) < Math.abs(best.cents)) best = { audc, audf, hz, cents };
    }
  }
  return best;
}

/** The frequency TIA plays for a register setting, for the pitched sounds above. */
export function tiaHz(audc: number, audf: number): number | null {
  const div = Object.values(SOUNDS)
    .flat()
    .find((s) => s.audc === audc)?.div;
  return div ? TIA_CLOCK / div / (audf + 1) : null;
}

/** Length in frames of a duration like "8", "8.", "8t" or "4+16". */
function frames(len: string, tempo: number): number {
  let total = 0;
  for (const part of len.split("+")) {
    const m = /^(1|2|4|8|16|32)(\.?)(t?)$/.exec(part);
    if (!m) throw new Error(`"${len}" isn't a note length (use 1, 2, 4, 8, 16 or 32, with . for dotted or t for triplet)`);
    let f = (16 / Number(m[1])) * tempo;
    if (m[2]) f *= 1.5;
    if (m[3]) f = (f * 2) / 3;
    if (!Number.isInteger(f)) throw new Error(`"${len}" isn't a whole number of frames at tempo ${tempo}`);
    total += f;
  }
  return total;
}

/**
 * Compiles one voice's notes. A note is a pitch (C5, F#4, Bb3), a rest (-)
 * or a drum (K kick, S snare, H hat), then its length; "~" or "^" after the
 * length slides it down or up. Commas and bar lines (|) separate notes.
 */
export function compileVoice(v: TuneVoice, tempo: number): { events: MusicEvent[]; worstCents: number } {
  const out: MusicEvent[] = [];
  let worstCents = 0;
  const items = v.notes.split(/[,|]/).map((s) => s.trim()).filter(Boolean);
  for (const item of items) {
    const m = /^(\S+)\s+(\S+?)([~^]?)$/.exec(item);
    if (!m) throw new Error(`"${item}" should be a note and a length, like "C5 8"`);
    const [, pitch, len, slide] = m as unknown as [string, string, string, string];
    const n = frames(len, tempo);
    if (pitch === "-") {
      const last = out[out.length - 1];
      if (last && last.vol === 0 && last.frames + n <= 255) last.frames += n;
      else out.push({ frames: n, vol: 0, audc: 0, audf: 0, env: 0 });
      continue;
    }
    let ev: MusicEvent;
    if (DRUMS[pitch]) {
      ev = { frames: n, ...DRUMS[pitch] };
    } else {
      const midi = midiNote(pitch);
      if (midi === null) throw new Error(`"${pitch}" isn't a note (use a letter, an optional # or b, and an octave: C#5)`);
      const t = tiaPitch(midi, v.sound);
      if (Math.abs(t.cents) > MAX_CENTS) throw new Error(`${pitch} is out of tune on the ${v.sound} sound (${Math.round(t.cents)} cents); try another octave`);
      worstCents = Math.max(worstCents, Math.abs(t.cents));
      const env = slide === "~" ? ENV.slideDown : slide === "^" ? ENV.slideUp : ENV[v.envelope];
      ev = { frames: n, vol: v.volume, audc: t.audc, audf: t.audf, env };
    }
    if (n > 255) throw new Error(`"${item}" is longer than 255 frames; split it or raise the tempo`);
    // The same note twice running gets a one-frame gap, so it's heard twice.
    const last = out[out.length - 1];
    if (last && last.vol > 0 && last.audc === ev.audc && last.audf === ev.audf && last.frames > 1) {
      last.frames -= 1;
      out.push({ frames: 1, vol: 0, audc: 0, audf: 0, env: 0 });
    }
    out.push(ev);
  }
  return { events: out, worstCents };
}

export function compileTune(tune: Tune): CompiledTune {
  const voices = tune.voices.map((v, i) => {
    try {
      return compileVoice(v, tune.tempo);
    } catch (e) {
      throw new Error(`${tune.id}, voice ${i + 1}: ${(e as Error).message}`);
    }
  });
  const lengths = voices.map((v) => v.events.reduce((s, e) => s + e.frames, 0));
  const loop = tune.kind === "title";
  if (loop && lengths.some((l) => l !== lengths[0])) {
    throw new Error(`${tune.id}: a loop's voices must be the same length (${lengths.join(" and ")} frames)`);
  }
  return {
    tune,
    loop,
    voices: voices.map((v) => v.events),
    frames: Math.max(...lengths),
    worstCents: Math.max(...voices.map((v) => v.worstCents)),
  };
}

/** The player's bytes for one voice, end marker included. */
export function encodeVoice(events: MusicEvent[]): number[] {
  return [...events.flatMap((e) => [e.frames, (e.vol << 4) | e.audc, (e.env << 5) | e.audf]), 0];
}

export function findTune(id: string): Tune | undefined {
  return MUSIC_LIBRARY.find((t) => t.id === id);
}

// ---- the player, frame by frame ----

export interface VoiceOut {
  audc: number;
  audf: number;
  vol: number;
}

/**
 * The 6502 player in TypeScript, step for step: same bytes, same envelope
 * timing, same rules for sharing voices with sound effects.
 */
export class MusicPlayerModel {
  /** 0 off, 1 jingle, 2 loop */
  state = 0;
  private clock = 0;
  private data: number[][] = [[], []];
  private pos = [0, 0];
  private active = [false, false];
  private timer = [0, 0];
  private vol = [0, 0];
  private env = [0, 0];
  private ctl = [0, 0];
  private freq = [0, 0];
  /** What the TIA registers hold. */
  readonly regs: VoiceOut[] = [
    { audc: 0, audf: 0, vol: 0 },
    { audc: 0, audf: 0, vol: 0 },
  ];

  play(voices: number[][], loop: boolean) {
    this.state = 0;
    this.clock = 0;
    this.regs[0]!.vol = this.regs[1]!.vol = 0;
    for (const x of [0, 1]) {
      this.data[x] = voices[x] ?? [];
      this.pos[x] = 0;
      this.active[x] = !!voices[x]?.length;
      this.timer[x] = 1;
    }
    this.state = loop ? 2 : 1;
  }

  stop() {
    this.state = 0;
    this.active = [false, false];
    this.regs[0]!.vol = this.regs[1]!.vol = 0;
  }

  /** One frame. `sfx[x]` is whether a sound effect is playing on voice x; returns which voices the player wrote. */
  tick(sfx: [boolean, boolean] = [false, false]): [boolean, boolean] {
    const wrote: [boolean, boolean] = [false, false];
    if (this.state === 0) return wrote;
    this.clock = (this.clock + 1) & 255;
    for (const x of [1, 0]) {
      if (!this.active[x]) continue;
      this.timer[x] = (this.timer[x]! - 1) & 255;
      if (this.timer[x] !== 0) {
        const e = this.env[x]!;
        if ((this.clock & ENV_MASK[e]!) === 0) {
          this.vol[x] = Math.max(0, this.vol[x]! - ENV_STEP[e]!);
          if (e === ENV.slideDown && this.freq[x]! < 31) this.freq[x]!++;
          if (e === ENV.slideUp && this.freq[x]! > 0) this.freq[x]!--;
        }
      } else {
        const d = this.data[x]!;
        let p = this.pos[x]!;
        if (d[p] === 0 && this.state === 2) p = 0;
        if (d[p] === 0) {
          this.active[x] = false;
          this.vol[x] = 0;
        } else {
          this.timer[x] = d[p]!;
          this.ctl[x] = d[p + 1]! & 15;
          this.vol[x] = d[p + 1]! >> 4;
          this.freq[x] = d[p + 2]! & 31;
          this.env[x] = d[p + 2]! >> 5;
          this.pos[x] = p + 3;
        }
      }
      // A loop steps aside while a sound effect plays on this voice; a jingle cancels the effect.
      if (sfx[x] && this.state === 2) continue;
      this.regs[x] = { audc: this.ctl[x]!, audf: this.freq[x]!, vol: this.vol[x]! };
      wrote[x] = true;
    }
    if (this.state === 1 && !this.active[0] && !this.active[1]) this.state = 0;
    return wrote;
  }
}

/** Register values for every frame of a tune (a loop plays `loops` times). */
export function renderFrames(c: CompiledTune, loops = 1): VoiceOut[][] {
  const p = new MusicPlayerModel();
  p.play(c.voices.map(encodeVoice), c.loop);
  const out: VoiceOut[][] = [];
  const total = c.loop ? c.frames * loops : c.frames + 1;
  for (let f = 0; f < total && (p.state !== 0 || f === 0); f++) {
    p.tick();
    out.push(p.regs.map((r) => ({ ...r })));
  }
  return out;
}

// ---- generator glue ----

/** Which tune plays at each moment; any may be left out. */
export type MusicChoices = Partial<Record<JingleKind, string>>;

export interface MusicInclude {
  /** Variable declarations, for the top of the program (before any code uses them). */
  vars: string;
  /** The player routines and tune data, somewhere code doesn't fall into (after a return). */
  code: string;
  /** A line that starts each chosen tune. */
  play: Partial<Record<JingleKind, string>>;
  /** A line that stops whatever is playing. */
  stop: string;
  /** Tune numbers, as the ROM knows them. */
  index: Partial<Record<JingleKind, number>>;
  /** ROM bytes the tune data takes. */
  dataBytes: number;
}

export interface MusicOptions {
  /** First of 23 bytes of RAM for the player (default $2780). */
  ram?: number;
  /**
   * Define 7800basic's `userinterrupt` to run the player (default true).
   * A program with its own userinterrupt calls `gosub musictick` from it instead.
   */
  ownInterrupt?: boolean;
}

export const MUSIC_RAM = 0x2780;
export const MUSIC_RAM_BYTES = 23;

const hex = (n: number) => `$${n.toString(16).toUpperCase()}`;

/** Asm for tunes in the order given: per-voice pointer tables, modes and note bytes. */
function tuneTables(tunes: CompiledTune[]): { asm: string; bytes: number } {
  const label = (t: CompiledTune, v: number) => `mus_${t.tune.id.replace(/-/g, "_")}_v${v}`;
  const lines: string[] = [];
  // 7800basic splits long lines, so a .byte line holds a few values at most.
  const bytesLines = (values: (string | number)[], per: number) => {
    for (let i = 0; i < values.length; i += per) lines.push(` .byte ${values.slice(i, i + per).join(", ")}`);
  };
  let bytes = 0;
  for (const v of [0, 1]) {
    lines.push(`mustunes${v}lo`);
    bytesLines(tunes.map((t) => (t.voices[v] ? `<${label(t, v)}` : 0)), 4);
    lines.push(`mustunes${v}hi`);
    bytesLines(tunes.map((t) => (t.voices[v] ? `>${label(t, v)}` : 0)), 4);
  }
  lines.push("mustunemode");
  bytesLines(tunes.map((t) => (t.loop ? 2 : 1)), 16);
  for (const t of tunes) {
    t.voices.forEach((events, v) => {
      const b = encodeVoice(events);
      bytes += b.length;
      lines.push(` ; ${t.tune.id}, ${t.tune.label.replace(/[^A-Za-z0-9 ,!-]/g, "")}, voice ${v + 1}`, label(t, v));
      bytesLines(b, 12);
    });
  }
  return { asm: lines.join("\n"), bytes };
}

const template = Handlebars.create();
template.registerHelper("hex", (base: number, offset: number) => hex(base + offset));
const render = template.compile(audioTemplate, { noEscape: true, strict: true, ignoreStandalone: true });

/** The player include for a list of tunes, numbered in order (tests use this to include the whole library). */
export function musicIncludeForTunes(tunes: Tune[], opts: MusicOptions = {}): Pick<MusicInclude, "vars" | "code" | "dataBytes"> {
  if (!tunes.length) return { vars: "", code: "", dataBytes: 0 };
  const tables = tuneTables(tunes.map(compileTune));
  const ctx = { ram: opts.ram ?? MUSIC_RAM, ownInterrupt: opts.ownInterrupt ?? true, tunes: tables.asm };
  return { vars: render({ ...ctx, vars: true, code: false }), code: render({ ...ctx, vars: false, code: true }), dataBytes: tables.bytes };
}

/** The player include for a game's choices. Throws on an unknown tune or one in the wrong slot. */
export function musicInclude(choices: MusicChoices, opts: MusicOptions = {}): MusicInclude {
  const chosen: { kind: JingleKind; tune: Tune }[] = [];
  for (const kind of JINGLE_KINDS) {
    const id = choices[kind];
    if (!id) continue;
    const tune = findTune(id);
    if (!tune) throw new Error(`There's no tune called "${id}"`);
    if (tune.kind !== kind) throw new Error(`"${id}" is a ${JINGLE_MOMENTS[tune.kind]} tune, not a ${JINGLE_MOMENTS[kind]} tune`);
    chosen.push({ kind, tune });
  }
  const index: MusicInclude["index"] = {};
  const play: MusicInclude["play"] = {};
  chosen.forEach((c, i) => {
    index[c.kind] = i;
    play[c.kind] = ` musictune = ${i} : gosub musicplay`;
  });
  return {
    ...musicIncludeForTunes(
      chosen.map((c) => c.tune),
      opts,
    ),
    play,
    stop: chosen.length ? " gosub musicstop" : "",
    index,
  };
}
