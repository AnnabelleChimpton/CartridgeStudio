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
  stepFrames(n: number): Promise<void>; // for tests
  framebufferHash(): Promise<string>; // for tests
}
