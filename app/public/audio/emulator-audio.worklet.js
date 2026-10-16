// AudioWorklet that plays the emulator worker's samples (SPEC.md, "Emulator
// preview"). Samples arrive on a MessagePort straight from the worker and go
// through a ring buffer; an underrun plays silence, and if the buffer runs
// far ahead (a hidden tab catching up) the oldest audio is dropped.

const SIZE = 1 << 15;
const MAX_LATENCY = 0.15; // seconds

class EmulatorAudio extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(SIZE);
    this.read = 0;
    this.write = 0;
    this.port.onmessage = (e) => {
      const port = e.data.port;
      if (port) port.onmessage = (m) => this.push(m.data);
    };
  }

  get buffered() {
    return (this.write - this.read + SIZE) % SIZE;
  }

  push(samples) {
    for (let i = 0; i < samples.length; i++) {
      this.buf[this.write] = samples[i];
      this.write = (this.write + 1) % SIZE;
      if (this.write === this.read) this.read = (this.read + 1) % SIZE;
    }
    const max = Math.floor(MAX_LATENCY * sampleRate);
    if (this.buffered > max) this.read = (this.write - max + SIZE) % SIZE;
  }

  process(_inputs, outputs) {
    const out = outputs[0][0];
    for (let i = 0; i < out.length; i++) {
      if (this.read === this.write) {
        out[i] = 0;
      } else {
        // Played as-is, like js7800's own audio output.
        out[i] = this.buf[this.read];
        this.read = (this.read + 1) % SIZE;
      }
    }
    return true;
  }
}

registerProcessor("emulator-audio", EmulatorAudio);
