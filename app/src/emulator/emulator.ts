// The emulator sits behind this interface (SPEC.md, "Emulator preview") so the
// js7800 core can be swapped for a more accurate one without touching callers.

export interface JoystickState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
}

export interface Emulator {
  load(rom: Uint8Array, format: "a78" | "bin"): Promise<void>;
  reset(): void;
  pause(paused: boolean): void;
  setInput(state: JoystickState): void;
  onFrame(cb: (frame: number) => void): () => void;
  /** Runs exactly `n` more frames right away (lockstep). Pause first for repeatable runs. */
  stepFrames(n: number): Promise<void>; // for tests
  /** SHA-256 of the visible picture's palette indices. */
  framebufferHash(): Promise<string>; // for tests
  /** Reads console memory, e.g. game variables at addresses from dasm's symbol table. */
  readMemory(address: number, length: number): Promise<Uint8Array>; // for tests
}
