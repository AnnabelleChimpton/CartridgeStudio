import type { BuildOptions, GameSource, ProjectBuildResult } from "./project-build.ts";

export type WorkerRequest = { type: "init"; packUrl: string } | { type: "build"; id: number; project: GameSource; options: BuildOptions };

export type WorkerResponse =
  | { type: "ready"; toolchainVersion: string; fetchMs: number; compileMs: number }
  | { type: "init-error"; message: string }
  | { type: "result"; id: number; result: ProjectBuildResult };
