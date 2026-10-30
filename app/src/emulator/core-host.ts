import type { ConsoleButton, Difficulty, Switches } from "./emulator.ts";

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
  /** Console switches (momentary while held). */
  pause?: boolean;
  reset?: boolean;
  select?: boolean;
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
const RESET = 12;
const SELECT = 13;
const PAUSE = 14;
const LEFT_DIFFICULTY = 15;
const RIGHT_DIFFICULTY = 16;
/** How long a console button stays down when pressed from the page: a tenth of a second. */
const PRESS_FRAMES = 6;
const CONSOLE_SLOTS: Record<ConsoleButton, number> = { pause: PAUSE, select: SELECT, reset: RESET };

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
  private joystick: JoystickInput = { up: false, down: false, left: false, right: false, fire: false };
  private readonly held: Record<ConsoleButton, number> = { pause: 0, select: 0, reset: 0 };
  /** Where the header put the switches, and where someone has moved them since (true is B). */
  private header = { left: false, right: false };
  private moved: { left?: boolean; right?: boolean } = {};

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

  /** The palette in use, as RGB triples by palette index. */
  get paletteRgb(): readonly number[] {
    return this.palette;
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
    const header = { left: !!Cartridge.GetLeftSwitch(), right: !!Cartridge.GetRightSwitch() };
    // A switch someone moved stays put across rebuilds, until the game itself asks for a different setting.
    if (header.left !== this.header.left || header.right !== this.header.right) this.moved = {};
    this.header = header;
    this.loaded = true;
    return this.reset();
  }

  /** Resets the console, as a power cycle. The difficulty switches stay where they are. */
  reset(): Promise<void> {
    if (!this.loaded) return Promise.resolve();
    this.input.fill(false);
    this.held.pause = this.held.select = this.held.reset = 0;
    this.input[LEFT_DIFFICULTY] = this.moved.left ?? this.header.left;
    this.input[RIGHT_DIFFICULTY] = this.moved.right ?? this.header.right;
    this.frames = 0;
    return new Promise((resolve) => quietly(() => this.core.ProSystem.Reset(resolve)));
  }

  setInput(j: JoystickInput) {
    this.joystick = { ...j };
    this.input[UP] = j.up;
    this.input[DOWN] = j.down;
    this.input[LEFT] = j.left;
    this.input[RIGHT] = j.right;
    this.input[BUTTON1] = j.fire;
    this.applyConsole();
  }

  pressConsole(button: ConsoleButton, frames = PRESS_FRAMES) {
    this.held[button] = frames;
    this.applyConsole();
  }

  setDifficulty(side: keyof Switches, position: Difficulty) {
    const b = position === "B";
    this.moved[side] = b;
    this.input[side === "left" ? LEFT_DIFFICULTY : RIGHT_DIFFICULTY] = b;
  }

  get switches(): Switches {
    const at = (b: boolean): Difficulty => (b ? "B" : "A");
    return { left: at(this.input[LEFT_DIFFICULTY]!), right: at(this.input[RIGHT_DIFFICULTY]!) };
  }

  private applyConsole() {
    for (const b of Object.keys(CONSOLE_SLOTS) as ConsoleButton[]) {
      this.input[CONSOLE_SLOTS[b]] = !!this.joystick[b] || this.held[b] > 0;
    }
  }

  /** Runs `n` frames as fast as possible and collects their sound. */
  step(n = 1): void {
    if (!this.loaded) return;
    for (let i = 0; i < n; i++) {
      this.core.ProSystem.ExecuteFrame(this.input);
      if (this.held.pause || this.held.select || this.held.reset) {
        for (const b of Object.keys(this.held) as ConsoleButton[]) if (this.held[b] > 0) this.held[b]--;
        this.applyConsole();
      }
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
