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
  | { type: "pixels"; id: number; x: number; y: number; width: number; height: number };

export type EmuResponse =
  | { type: "ready" }
  | { type: "init-error"; message: string }
  | { type: "frame"; frame: number }
  | { type: "reply"; id: number; value?: unknown; error?: string };
