// The box back's spec plate, measured from the build: the cartridge image's
// size, what the game takes of it (from the toolchain's "bytes of ROM space
// left" report), display objects per zone, the date and the toolchain.

import type { BuildStats } from "../code/build-log.ts";
import type { PrintSpec } from "./pdf.ts";

export interface SpecInput {
  /** The raw ROM image (no .a78 header): its length is the cartridge size. */
  bin: Uint8Array;
  /** From the build log; without it the plate gives the cartridge size only. */
  stats?: BuildStats;
  colors: number;
  toolchain: string;
  runtime?: string;
  app?: string;
  built?: Date;
}

export function printSpec({ bin, stats, colors, toolchain, runtime, app, built = new Date() }: SpecInput): PrintSpec {
  const free = stats ? [...stats.areas, ...stats.graphics].reduce((n, a) => n + Math.max(0, a.bytes), 0) : undefined;
  const hasReport = !!stats && stats.areas.length > 0;
  return {
    cartBytes: bin.length,
    ...(hasReport && free !== undefined ? { romBytes: Math.max(0, bin.length - free) } : {}),
    colors,
    ...(stats?.zoneObjects ? { zoneObjects: stats.zoneObjects } : {}),
    built,
    toolchain,
    ...(runtime ? { runtime } : {}),
    ...(app ? { app } : {}),
  };
}
