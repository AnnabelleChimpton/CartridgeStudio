// Drives the js7800 emulation core (public/vendor/js7800-core) one frame at a
// time, with no DOM: used by the emulator worker and by headless tests. Frames
// only advance when step() is called, so runs are deterministic.

/** The parts of the core bundle this host uses (see app/js7800-core/entry.js). */
export interface Js7800Core {
  ProSystem: {
    Reset(postResetCallback: () => void): void;
    Close(): void;
    ExecuteFrame(input: boolean[]): void;
    IsActive(): boolean;
    GetFrequency(): number;
  };
  Cartridge: {
    Load(data: number[], size: number): boolean;
    GetDigest(): string;
    GetLeftSwitch(): number;
    GetRightSwitch(): number;
    GetRegion(): number;
  };
  Database: { Load(digest: string): void };
  Maria: { SetSurface(surface: number[]): void };
  Memory: { Read(address: number): number };
  Region: { getNtscPalette(): number[]; getPalPalette(): number[]; REGION_PAL: number };
  Sound: { Store(): void; SetSampleRate(rate: number): void };
  Events: { fireEvent(topic: string, event: unknown): void };
  Audio: { setOutputRate(rate: number): void; takeSamples(): Float32Array };
}

export interface JoystickInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
}

export const WIDTH = 320;
export const HEIGHT = 240;
// Same visible window js7800's video.js copies to its canvas.
const SURFACE_HEIGHT = 300;
const NTSC_TOP = 2;
const PAL_TOP = 26;

// Input slots, as in js7800's web/input.js.
const RIGHT = 0;
const LEFT = 1;
const DOWN = 2;
const UP = 3;
const BUTTON1 = 4;
const LEFT_DIFFICULTY = 15;
const RIGHT_DIFFICULTY = 16;

/** Runs `fn` with console.log silenced: the core logs cartridge details on every load and reset. */
function quietly<T>(fn: () => T): T {
  const log = console.log;
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.log = log;
  }
}

export class CoreHost {
  readonly core: Js7800Core;
  /** Maria writes one palette index per pixel here. */
  private readonly surface: number[] = new Array(WIDTH * SURFACE_HEIGHT).fill(0);
  private readonly input: boolean[] = new Array(19).fill(false);
  private palette: number[] = [];
  private top = NTSC_TOP;
  private frames = 0;
  private loaded = false;

  constructor(core: Js7800Core) {
    this.core = core;
    // What js7800's page code does at start-up: wire the core modules together
    // and install its default "no high score cartridge" callback.
    core.Events.fireEvent("init", { Region: core.Region, keyboardData: this.input, debug: false });
    core.Events.fireEvent("highScoreCallbackChanged", {
      getRom: () => null,
      write: () => {},
      loadSram: (done: (sram: null) => void) => done(null),
    });
    core.Maria.SetSurface(this.surface);
  }

  get frame(): number {
    return this.frames;
  }

  get frequency(): number {
    return this.core.ProSystem.GetFrequency();
  }

  /** Loads an .a78 or raw .bin (the core detects which) and resets the console. */
  load(rom: Uint8Array): Promise<void> {
    const { ProSystem, Cartridge, Database, Region } = this.core;
    if (ProSystem.IsActive()) ProSystem.Close();
    if (!quietly(() => Cartridge.Load(Array.from(rom), rom.length))) {
      return Promise.reject(new Error("The emulator rejected this ROM"));
    }
    quietly(() => Database.Load(Cartridge.GetDigest()));
    const pal = Cartridge.GetRegion() === Region.REGION_PAL;
    this.palette = pal ? Region.getPalPalette() : Region.getNtscPalette();
    this.top = pal ? PAL_TOP : NTSC_TOP;
    this.loaded = true;
    return this.reset();
  }

  /** Resets the console, as a power cycle; difficulty switches follow the cartridge header. */
  reset(): Promise<void> {
    if (!this.loaded) return Promise.resolve();
    this.input.fill(false);
    this.input[LEFT_DIFFICULTY] = !!this.core.Cartridge.GetLeftSwitch();
    this.input[RIGHT_DIFFICULTY] = !!this.core.Cartridge.GetRightSwitch();
    this.frames = 0;
    return new Promise((resolve) => quietly(() => this.core.ProSystem.Reset(resolve)));
  }

  setInput(j: JoystickInput) {
    this.input[UP] = j.up;
    this.input[DOWN] = j.down;
    this.input[LEFT] = j.left;
    this.input[RIGHT] = j.right;
    this.input[BUTTON1] = j.fire;
  }

  /** Runs `n` frames as fast as possible and collects their sound. */
  step(n = 1): void {
    if (!this.loaded) return;
    for (let i = 0; i < n; i++) {
      this.core.ProSystem.ExecuteFrame(this.input);
      this.core.Sound.Store();
      this.frames++;
    }
  }

  /** The visible 320×240 picture as palette indices. */
  indices(): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(WIDTH * HEIGHT);
    const start = this.top * WIDTH;
    for (let i = 0; i < out.length; i++) out[i] = this.surface[start + i]!;
    return out;
  }

  /** The visible picture as RGBA, through the core's NTSC (or PAL) palette. */
  rgba(target = new Uint8ClampedArray(WIDTH * HEIGHT * 4)): Uint8ClampedArray {
    const start = this.top * WIDTH;
    const p = this.palette;
    for (let i = 0, o = 0; i < WIDTH * HEIGHT; i++, o += 4) {
      const c = this.surface[start + i]! * 3;
      target[o] = p[c]!;
      target[o + 1] = p[c + 1]!;
      target[o + 2] = p[c + 2]!;
      target[o + 3] = 255;
    }
    return target;
  }

  readMemory(address: number, length = 1): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i++) out[i] = this.core.Memory.Read((address + i) & 0xffff);
    return out;
  }

  takeSamples(): Float32Array {
    return this.core.Audio.takeSamples();
  }
}

/** Parses dasm's symbol table (`-s` output) into name → address. */
export function parseSymbols(text: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const line of text.split("\n")) {
    const m = /^(\S+)\s+([0-9a-fA-F]{4})\b/.exec(line);
    if (m) map.set(m[1]!, parseInt(m[2]!, 16));
  }
  return map;
}
