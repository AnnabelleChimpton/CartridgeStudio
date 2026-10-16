import type { BuildInput, BuildResult } from "@cartridge-studio/toolchain";

export type WorkerRequest =
  | { type: "init"; packUrl: string }
  | { type: "build"; id: number; input: BuildInput };

export type WorkerResponse =
  | { type: "ready"; toolchainVersion: string; fetchMs: number; compileMs: number }
  | { type: "init-error"; message: string }
  | { type: "built"; id: number; result: BuildResult };
