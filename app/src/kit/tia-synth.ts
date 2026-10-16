// A small TIA sound generator for previewing kit music in the browser. It
// takes the register values the player writes each frame (from
// MusicPlayerModel, which the ROM tests hold to the real player) and runs
// TIA's dividers and noise counters at the audio clock, so the preview has
// TIA's real pitches, buzz and noise rather than a clean synth's.

import { FRAME_RATE, TIA_CLOCK, renderFrames, type CompiledTune, type VoiceOut } from "./audio.ts";

/** One period of an n-bit shift register's output, fed back from bit 0 xor bit `tap`. */
function lfsr(bits: number, tap: number): number[] {
  const period = 2 ** bits - 1;
  const out: number[] = [];
  let r = 1;
  for (let i = 0; i < period; i++) {
    out.push(r & 1);
    const fb = (r ^ (r >> tap)) & 1;
    r = (r >> 1) | (fb << (bits - 1));
  }
  return out;
}

const POLY4 = lfsr(4, 1);
const POLY5 = lfsr(5, 2);
const POLY9 = lfsr(9, 4);
/** The 31-step divider: two clocks per cycle, 18 and 13 steps apart. */
const DIV31 = Array.from({ length: 31 }, (_, i) => (i === 0 || i === 18 ? 1 : 0));

class TiaVoice {
  private count = 0;
  private p4 = 0;
  private p5 = 0;
  private p9 = 0;
  private bit = 0;

  /** One tick of the audio clock; returns the output level, 0 to 15. */
  step(r: VoiceOut): number {
    const c = r.audc & 15;
    if (c === 0 || c === 11) return r.vol;
    if (++this.count < (r.audf + 1) * ((c & 12) === 12 ? 3 : 1)) return this.bit ? r.vol : 0;
    this.count = 0;
    this.p5 = (this.p5 + 1) % 31;
    const clocked = (c & 2) === 0 || ((c & 1) === 0 ? DIV31[this.p5] : POLY5[this.p5]);
    if (clocked) {
      if (c & 4) this.bit ^= 1;
      else if (c & 8) {
        if (c === 8) {
          this.p9 = (this.p9 + 1) % 511;
          this.bit = POLY9[this.p9]!;
        } else this.bit = POLY5[this.p5]!;
      } else {
        this.p4 = (this.p4 + 1) % 15;
        this.bit = POLY4[this.p4]!;
      }
    }
    return this.bit ? r.vol : 0;
  }
}

/** Mono samples at TIA's audio clock (about 31.4 kHz), from per-frame register values. */
export function synthesizeFrames(frames: VoiceOut[][], tailSeconds = 0.15): { samples: Float32Array<ArrayBuffer>; rate: number } {
  const rate = Math.round(TIA_CLOCK);
  const perFrame = TIA_CLOCK / FRAME_RATE;
  const total = Math.ceil(frames.length * perFrame + tailSeconds * rate);
  const samples = new Float32Array(total);
  const voices = [new TiaVoice(), new TiaVoice()];
  const silent: VoiceOut = { audc: 0, audf: 0, vol: 0 };
  let dc = 0;
  for (let i = 0; i < total; i++) {
    const regs = frames[Math.floor(i / perFrame)] ?? [silent, silent];
    const level = (voices[0]!.step(regs[0] ?? silent) + voices[1]!.step(regs[1] ?? silent)) / 30;
    // Take out the DC the TIA's unipolar output carries, as a console's audio circuit does.
    dc += (level - dc) * 0.002;
    samples[i] = level - dc;
  }
  return { samples, rate };
}

/** A tune's sound; a loop comes out exactly one pass long, with no tail, so it can repeat seamlessly. */
export function synthesize(c: CompiledTune): { samples: Float32Array<ArrayBuffer>; rate: number } {
  return synthesizeFrames(renderFrames(c), c.loop ? 0 : 0.15);
}
