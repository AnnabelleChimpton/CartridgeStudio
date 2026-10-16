import type { Project } from "../project/schema.ts";
import type { BuildOptions, ProjectBuildResult } from "./project-build.ts";

export type WorkerRequest = { type: "init"; packUrl: string } | { type: "build"; id: number; project: Project; options: BuildOptions };

export type WorkerResponse =
  | { type: "ready"; toolchainVersion: string; fetchMs: number; compileMs: number }
  | { type: "init-error"; message: string }
  | { type: "result"; id: number; result: ProjectBuildResult };
