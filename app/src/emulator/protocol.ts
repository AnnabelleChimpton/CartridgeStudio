import type { JoystickInput } from "./core-host.ts";

export type EmuRequest =
  | { type: "init"; canvas: OffscreenCanvas; coreUrl: string }
  | { type: "audio"; port: MessagePort; sampleRate: number }
  | { type: "load"; id: number; rom: Uint8Array }
  | { type: "reset" }
  | { type: "pause"; paused: boolean }
  | { type: "input"; state: JoystickInput }
  | { type: "step"; id: number; frames: number }
  | { type: "hash"; id: number }
  | { type: "memory"; id: number; address: number; length: number }
  | { type: "pixels"; id: number; x: number; y: number; width: number; height: number }
  /** Starts keeping every `every`th frame's palette indices, up to `max` frames (a clip). */
  | { type: "clip-start"; every: number; max: number }
  /** Stops a clip; replies with its frames and the palette (RGB triples). */
  | { type: "clip-stop"; id: number }
  /** Test hook (window.__cs): the next frame throws, to exercise fault recovery. */
  | { type: "inject-fault" }
  /** Reads several ranges of memory at once; replies with a Peek. */
  | { type: "peek"; id: number; ranges: [address: number, length: number][] }
  /** Reloads the ROM from power-on and records the joystick from there, frame by frame. */
  | { type: "record-start"; id: number }
  /** Stops recording; replies with the Recording. */
  | { type: "record-stop"; id: number };

/** Memory read in one go, with the frame it was read after. */
export interface Peek {
  frame: number;
  /** One array per requested range, in order. */
  bytes: Uint8Array[];
}

/** Joystick input from power-on: runs of frames with the same controls held. */
export interface Recording {
  frames: number;
  runs: { hold: (keyof JoystickInput)[]; frames: number }[];
}

export type EmuResponse =
  | { type: "ready" }
  | { type: "init-error"; message: string }
  | { type: "frame"; frame: number }
  /** A clip reached its maximum length. */
  | { type: "clip-full" }
  | { type: "reply"; id: number; value?: unknown; error?: string }
  /** The real-time loop threw and has stopped; the preview needs a restart. */
  | { type: "fault"; message: string };
