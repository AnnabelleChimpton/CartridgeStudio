// The numbers behind the Play panel's status line, from the build itself:
// how long it took and how much of the cartridge the game fills.

import type { BuildStats } from "../code/build-log.ts";

/** The ROM size game.bas asks for (`set romsize 48k`); 32 KB is 7800basic's default. */
export function romBytes(source: string | undefined): number {
  const m = /^\s+set\s+romsize\s+(\d+)k/im.exec(source ?? "");
  return (m ? Number(m[1]) : 32) * 1024;
}

export interface CartFill {
  /** Bytes the game uses: the cart size less the ROM space and graphics space dasm reports left. Over the size when the game doesn't fit. */
  used: number;
  /** The cart size game.bas asks for. */
  total: number;
  level: "ok" | "near" | "over";
}

/** How full the cartridge is, from the compiler's report; undefined when the build didn't report ROM space. */
export function cartFill(stats: BuildStats | undefined, source: string | undefined): CartFill | undefined {
  if (!stats?.areas.length) return undefined;
  const total = romBytes(source);
  const free = [...stats.areas, ...stats.graphics].reduce((sum, a) => sum + a.bytes, 0);
  const used = total - free;
  const over = [...stats.areas, ...stats.graphics].some((a) => a.bytes < 0);
  return { used, total, level: over ? "over" : used / total > 0.9 ? "near" : "ok" };
}

/** Kilobytes as the status line says them: whole numbers, one decimal under 10. */
export const kb = (bytes: number) => {
  const k = bytes / 1024;
  return k < 10 ? String(Math.round(k * 10) / 10) : String(Math.round(k));
};

/** "Built in 0.4 s · 12 of 32 KB". */
export function builtStatus(ms: number, fill: CartFill | undefined): string {
  const time = `Built in ${(ms / 1000).toFixed(1)} s`;
  return fill ? `${time} · ${kb(fill.used)} of ${kb(fill.total)} KB` : time;
}
