// Worker-safe stand-in for js7800's web/audio.js (GPL v2 or later).
// Instead of playing sound through the page's AudioContext, it collects each
// frame's samples so the worker can send them to an AudioWorklet.

import * as Sound from "@js7800/prosystem/Sound.js";

let outputRate = null;
let chunks = [];

function storeSound(sample, ym, length) {
  // Same mix as web/audio.js.
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = ym ? (sample[i] / 255 + ym[i] / 128) / 2 : sample[i] / 255;
  chunks.push(out);
}

/** The sample rate the host's AudioContext actually runs at. */
export function setOutputRate(rate) {
  outputRate = rate;
}

/** Called by Region.Reset with the region's preferred rate. */
export function reinit(rate) {
  Sound.SetStoreSoundCallback(storeSound);
  Sound.SetSampleRate(outputRate ?? rate);
}

/** Returns and clears the samples produced since the last call. */
export function takeSamples() {
  let n = 0;
  for (const c of chunks) n += c.length;
  const out = new Float32Array(n);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  chunks = [];
  return out;
}
