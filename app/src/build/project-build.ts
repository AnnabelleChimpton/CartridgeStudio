// One build of a project: generate game.bas and graphics, then return the
// cached ROM or run the toolchain. Shared by the build worker and the
// measurement-only inline path.

import type { Builder } from "@cartridge-studio/toolchain";
import { generate } from "../codegen/generate.ts";
import { generateKit } from "../kit/generate.ts";
import type { KitGame } from "../kit/schema.ts";
import { SOUND_LIBRARY, getTemplate } from "../project/templates.ts";
import type { Project } from "../project/schema.ts";

/** Anything the app can build: a template project or a kit game. */
export type GameSource = Project | KitGame;
export const isKitGame = (g: GameSource): g is KitGame => "kit" in g;
import { cacheKey, type RomCache } from "./rom-cache.ts";

interface Timings {
  generateMs: number;
  /** Toolchain time; 0 on a cache hit. */
  buildMs: number;
  totalMs: number;
}

export type ProjectBuildResult =
  | ({
      kind: "built";
      a78: Uint8Array;
      bin: Uint8Array;
      /** Only signed ROMs pass the console's cartridge check; previews skip signing. */
      signed: boolean;
      symbols: string;
      source: string;
      cached: boolean;
    } & Timings)
  /** The project failed validation: creator-facing messages. */
  | ({ kind: "invalid"; errors: string[] } & Timings)
  /** The toolchain failed: our bug, never the creator's. */
  | ({ kind: "failed"; stage: string; message: string; log: string; source: string } & Timings)
  | ({ kind: "cancelled" } & Timings);

export interface BuildOptions {
  /** Sign the ROM (default true). Previews pass false; downloads must be signed. */
  sign?: boolean;
}

export async function buildProject(
  builder: Builder,
  project: GameSource,
  cache?: RomCache,
  { sign = true }: BuildOptions = {},
): Promise<ProjectBuildResult> {
  const t0 = performance.now();
  const gen = isKitGame(project) ? generateKit(project, SOUND_LIBRARY) : generate(project, getTemplate(project.template.id));
  const generateMs = performance.now() - t0;
  const timings = (buildMs: number) => ({ generateMs, buildMs, totalMs: performance.now() - t0 });
  if (!gen.ok) return { kind: "invalid", errors: gen.errors, ...timings(0) };
  const input = { ...gen.input, sign };

  const key = await cacheKey(input, builder.toolchainVersion);
  const hit = await cache?.get(key);
  if (hit) return { kind: "built", ...hit, signed: sign, source: input.source, cached: true, ...timings(0) };

  const t1 = performance.now();
  const r = await builder.build(input);
  const buildMs = performance.now() - t1;
  if (!r.ok) {
    return { kind: "failed", stage: r.stage, message: r.message, log: r.log, source: input.source, ...timings(buildMs) };
  }
  // Store copies: the originals are transferred to the main thread.
  await cache?.set(key, { a78: r.a78.slice(), bin: r.bin.slice(), symbols: r.symbols, at: Date.now() });
  return {
    kind: "built",
    a78: r.a78,
    bin: r.bin,
    signed: r.signed,
    symbols: r.symbols,
    source: input.source,
    cached: false,
    ...timings(buildMs),
  };
}
