import type { BuildOptions, GameSource, ProjectBuildResult } from "./project-build.ts";

export type WorkerRequest = { type: "init"; packUrl: string } | { type: "build"; id: number; project: GameSource; options: BuildOptions };

export type WorkerResponse =
  | { type: "ready"; toolchainVersion: string; fetchMs: number; compileMs: number }
  | { type: "init-error"; message: string }
  | { type: "result"; id: number; result: ProjectBuildResult };

/** A build that threw instead of returning: our bug, reported as a failure with its message. */
export function buildFault(err: unknown, totalMs = 0): ProjectBuildResult {
  const message = err instanceof Error ? err.message || err.name : String(err);
  const log = err instanceof Error && err.stack ? err.stack : "";
  return {
    kind: "failed",
    stage: "worker",
    message: `Internal error in the build worker: ${message}`,
    log,
    source: "",
    generateMs: 0,
    buildMs: 0,
    totalMs,
  };
}
