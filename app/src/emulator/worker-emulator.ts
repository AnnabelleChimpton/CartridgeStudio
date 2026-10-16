// Main-thread side of the emulator worker. Owns input (keyboard and the
// Gamepad API, mapped to one joystick with one button) and audio output.
// The keyboard only reaches the game while its canvas has focus, so arrows,
// Space and Z keep working everywhere else on the page (WCAG 2.1.4).

import type { Emulator, JoystickState } from "./emulator.ts";
import type { EmuRequest, EmuResponse } from "./protocol.ts";

const CORE_URL = () => new URL(`${import.meta.env.BASE_URL}vendor/js7800-core/js7800-core.js`, location.href).href;
const WORKLET_URL = () => new URL(`${import.meta.env.BASE_URL}audio/emulator-audio.worklet.js`, location.href).href;
/** The NTSC rate the core prefers (60 frames × 262 lines × 2). */
const PREFERRED_SAMPLE_RATE = 31440;

const KEYS: Record<string, keyof JoystickState> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  " ": "fire",
  z: "fire",
  Z: "fire",
};

const IDLE: JoystickState = { up: false, down: false, left: false, right: false, fire: false };

export class WorkerEmulator implements Emulator {
  private readonly worker: Worker;
  private readonly ready: Promise<void>;
  private nextId = 1;
  private readonly replies = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private readonly frameListeners = new Set<(frame: number) => void>();
  private keyboard: JoystickState = { ...IDLE };
  private external: JoystickState = { ...IDLE };
  private gamepad: JoystickState = { ...IDLE };
  private sent: JoystickState = { ...IDLE };
  private audio: AudioContext | null = null;
  private muted = false;
  private readonly cleanup: (() => void)[] = [];
  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.worker = new Worker(new URL("./emulator.worker.ts", import.meta.url), { type: "module" });
    this.ready = new Promise((resolve, reject) => {
      this.worker.onmessage = (e: MessageEvent<EmuResponse>) => {
        const msg = e.data;
        if (msg.type === "ready") resolve();
        else if (msg.type === "init-error") reject(new Error(msg.message));
        else if (msg.type === "frame") for (const cb of this.frameListeners) cb(msg.frame);
        else if (msg.type === "reply") {
          const r = this.replies.get(msg.id);
          this.replies.delete(msg.id);
          if (msg.error) r?.reject(new Error(msg.error));
          else r?.resolve(msg.value);
        }
      };
      this.worker.onerror = (e) => reject(new Error(e.message));
    });
    const offscreen = canvas.transferControlToOffscreen();
    this.post({ type: "init", canvas: offscreen, coreUrl: CORE_URL() }, [offscreen]);
    this.listenForInput();
  }

  private post(msg: EmuRequest, transfer: Transferable[] = []) {
    this.worker.postMessage(msg, transfer);
  }

  private async request<T>(msg: EmuRequest & { id: number }): Promise<T> {
    await this.ready;
    return new Promise<T>((resolve, reject) => {
      this.replies.set(msg.id, { resolve: resolve as (v: unknown) => void, reject });
      this.post(msg);
    });
  }

  // ---- Emulator ----

  async load(rom: Uint8Array, _format: "a78" | "bin"): Promise<void> {
    // The core detects .a78 headers itself.
    await this.request({ type: "load", id: this.nextId++, rom: rom.slice() });
  }

  reset() {
    this.post({ type: "reset" });
  }

  pause(paused: boolean) {
    this.post({ type: "pause", paused });
  }

  /** Input from code (tests, touch controls); combined with keyboard and gamepad. */
  setInput(state: JoystickState) {
    this.external = { ...state };
    this.sendInput();
  }

  onFrame(cb: (frame: number) => void): () => void {
    this.frameListeners.add(cb);
    return () => this.frameListeners.delete(cb);
  }

  async stepFrames(n: number): Promise<void> {
    await this.request({ type: "step", id: this.nextId++, frames: n });
  }

  framebufferHash(): Promise<string> {
    return this.request({ type: "hash", id: this.nextId++ });
  }

  readMemory(address: number, length: number): Promise<Uint8Array> {
    return this.request({ type: "memory", id: this.nextId++, address, length });
  }

  // ---- Extras for the preview UI and tests ----

  /** RGBA pixels of a region of the 320×240 picture. */
  readPixels(x: number, y: number, width: number, height: number): Promise<Uint8ClampedArray> {
    return this.request({ type: "pixels", id: this.nextId++, x, y, width, height });
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.audio) void (muted ? this.audio.suspend() : this.audio.resume());
  }

  dispose() {
    for (const f of this.cleanup) f();
    void this.audio?.close();
    this.worker.terminate();
  }

  // ---- Input and audio ----

  private sendInput() {
    const merged: JoystickState = {
      up: this.keyboard.up || this.external.up || this.gamepad.up,
      down: this.keyboard.down || this.external.down || this.gamepad.down,
      left: this.keyboard.left || this.external.left || this.gamepad.left,
      right: this.keyboard.right || this.external.right || this.gamepad.right,
      fire: this.keyboard.fire || this.external.fire || this.gamepad.fire,
    };
    if ((Object.keys(merged) as (keyof JoystickState)[]).every((k) => merged[k] === this.sent[k])) return;
    this.sent = merged;
    this.post({ type: "input", state: merged });
  }

  private listenForInput() {
    const canvas = this.canvas;
    canvas.tabIndex = 0;
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      const control = KEYS[e.key];
      if (!control || e.metaKey || e.ctrlKey || e.altKey) return;
      // Keep arrows from scrolling the page while playing.
      e.preventDefault();
      if (down) void this.startAudio();
      this.keyboard = { ...this.keyboard, [control]: down };
      this.sendInput();
    };
    const keydown = onKey(true);
    const keyup = onKey(false);
    const gesture = () => void this.startAudio();
    const pointerdown = () => {
      canvas.focus();
      void this.startAudio();
    };
    // Letting go of the game (Tab away, click elsewhere, switch windows) lets go of every key.
    const blur = () => {
      this.keyboard = { ...IDLE };
      this.sendInput();
    };
    canvas.addEventListener("keydown", keydown);
    canvas.addEventListener("keyup", keyup);
    canvas.addEventListener("pointerdown", pointerdown);
    canvas.addEventListener("blur", blur);
    window.addEventListener("pointerdown", gesture);
    window.addEventListener("blur", blur);
    this.cleanup.push(() => {
      canvas.removeEventListener("keydown", keydown);
      canvas.removeEventListener("keyup", keyup);
      canvas.removeEventListener("pointerdown", pointerdown);
      canvas.removeEventListener("blur", blur);
      window.removeEventListener("pointerdown", gesture);
      window.removeEventListener("blur", blur);
    });

    let raf = 0;
    const poll = () => {
      raf = requestAnimationFrame(poll);
      const pad = navigator.getGamepads?.().find((g) => g?.connected);
      if (!pad) return;
      const b = (i: number) => !!pad.buttons[i]?.pressed;
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      // Standard mapping: d-pad buttons 12-15, face buttons 0-3.
      this.gamepad = {
        up: b(12) || ay < -0.5,
        down: b(13) || ay > 0.5,
        left: b(14) || ax < -0.5,
        right: b(15) || ax > 0.5,
        fire: b(0) || b(1) || b(2) || b(3),
      };
      if (this.gamepad.fire) void this.startAudio();
      this.sendInput();
    };
    raf = requestAnimationFrame(poll);
    this.cleanup.push(() => cancelAnimationFrame(raf));
  }

  /** Browsers only allow audio after a user gesture, so this runs on the first key, click or button. */
  private async startAudio() {
    if (this.audio) {
      if (!this.muted && this.audio.state === "suspended") void this.audio.resume();
      return;
    }
    let ctx: AudioContext;
    try {
      ctx = new AudioContext({ sampleRate: PREFERRED_SAMPLE_RATE });
    } catch {
      ctx = new AudioContext();
    }
    this.audio = ctx;
    try {
      await ctx.audioWorklet.addModule(WORKLET_URL());
      const node = new AudioWorkletNode(ctx, "emulator-audio", { outputChannelCount: [1] });
      node.connect(ctx.destination);
      const channel = new MessageChannel();
      node.port.postMessage({ port: channel.port2 }, [channel.port2]);
      await this.ready;
      this.post({ type: "audio", port: channel.port1, sampleRate: ctx.sampleRate }, [channel.port1]);
      if (this.muted) await ctx.suspend();
    } catch (e) {
      console.warn("[emulator] audio unavailable:", e);
    }
  }
}
