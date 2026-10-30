export interface JoystickState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
}

/** The console's three momentary buttons. */
export type ConsoleButton = "pause" | "select" | "reset";
/** A difficulty switch position: B is the usual one, A the harder one. */
export type Difficulty = "A" | "B";
export interface Switches {
  left: Difficulty;
  right: Difficulty;
}

export interface Emulator {
  load(rom: Uint8Array, format: "a78" | "bin"): Promise<void>;
  /** Power cycle: back to the title screen, switches as the cartridge header sets them. */
  reset(): void;
  pause(paused: boolean): void;
  setInput(state: JoystickState): void;
  /** Presses and lets go of a console button, as a finger would. */
  pressConsole(button: ConsoleButton): void;
  setDifficulty(side: keyof Switches, position: Difficulty): void;
  onFrame(cb: (frame: number) => void): () => void;
  /** Runs exactly `n` more frames right away (lockstep). Pause first for repeatable runs. */
  stepFrames(n: number): Promise<void>; // for tests
  /** SHA-256 of the visible picture's palette indices. */
  framebufferHash(): Promise<string>; // for tests
  /** Reads console memory, e.g. game variables at addresses from dasm's symbol table. */
  readMemory(address: number, length: number): Promise<Uint8Array>; // for tests
}
