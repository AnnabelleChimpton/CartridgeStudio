// The debugger drawer's arithmetic (DebuggerDrawer.tsx): dasm's symbol table
// as a pickable list, watch values in hex and decimal, the measured frame
// rate from the main-loop counter, and the kit's 24-slot object table. No
// React and no emulator here, so all of it is unit tested.

import { decodeValue, type WatchMap } from "../harness/behaviour.ts";

/** Where on the 7800 an address is: RAM, the cartridge, or something else (registers, or a plain number). */
export type Area = "ram" | "rom" | "other";

export interface DasmSymbol {
  name: string;
  address: number;
  area: Area;
}

/** The 7800's RAM: zero page, the stack page and the 4 KB block (Maria's registers sit below $40). */
export function areaOf(address: number): Area {
  if ((address >= 0x40 && address <= 0xff) || (address >= 0x140 && address <= 0x1ff) || (address >= 0x1800 && address <= 0x27ff)) return "ram";
  if (address >= 0x4000 && address <= 0xffff) return "rom";
  return "other";
}

/**
 * dasm's `-s` symbol table as a list to pick from: RAM variables first, then
 * the rest, each group by name. Local labels (`0.loop`) and symbols dasm
 * never resolved (`????`) are left out.
 */
export function parseSymbolTable(text: string): DasmSymbol[] {
  const out: DasmSymbol[] = [];
  const seen = new Set<string>();
  for (const line of text.split("\n")) {
    const m = /^([A-Za-z_][\w]*)\s+([0-9a-fA-F]{4})(\s+\?\?\?\?)?/.exec(line);
    if (!m || m[3] || seen.has(m[1]!)) continue;
    seen.add(m[1]!);
    const address = parseInt(m[2]!, 16);
    out.push({ name: m[1]!, address, area: areaOf(address) });
  }
  const rank: Record<Area, number> = { ram: 0, rom: 1, other: 2 };
  return out.sort((a, b) => rank[a.area] - rank[b.area] || a.name.localeCompare(b.name));
}

/** One line of the watch list: a name, and where its bytes are. */
export interface Watch {
  label: string;
  symbol: string;
  offset?: number;
  bytes?: number;
  bcd?: boolean;
}

/** The watch list a game starts with: the known variables (KIT_WATCH) its ROM has. */
export function seedWatches(base: WatchMap, symbols: ReadonlyMap<string, number>): Watch[] {
  return Object.entries(base)
    .filter(([, w]) => symbols.has(w.symbol))
    .map(([label, w]) => ({ label, ...w }));
}

/** The memory a watch reads, or null if this build has no such symbol. */
export function watchRange(w: Watch, symbols: ReadonlyMap<string, number>): [number, number] | null {
  const base = symbols.get(w.symbol);
  return base === undefined ? null : [(base + (w.offset ?? 0)) & 0xffff, w.bytes ?? 1];
}

export interface WatchValue {
  /** As the game means it: little-endian, or the score's BCD digits. */
  value: number;
  /** The bytes as hex: the value's for numbers, the stored bytes for BCD (which read as the digits). */
  hex: string;
}

export function watchValue(w: Watch, bytes: Uint8Array): WatchValue {
  const value = decodeValue(bytes, w.bcd);
  const hex = w.bcd
    ? [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")
    : value.toString(16).padStart(bytes.length * 2, "0");
  return { value, hex: `$${hex.toUpperCase()}` };
}

/** The address as people write it in 7800basic and dasm: `$01A6`. */
export const hexAddress = (n: number) => `$${n.toString(16).toUpperCase().padStart(4, "0")}`;

// ---- Measured frame rate ----

/** The main-loop counter (loopslo, loopshi) as read after an emulator frame. */
export interface LoopSample {
  frame: number;
  loops: number;
}

export interface FrameRate {
  /** Main-loop passes per second of console time. */
  fps: number;
  /** Console time per pass of the main loop. */
  msPerLoop: number;
  /** Frames the figure is measured over. */
  frames: number;
}

/** Measured over the samples' span; null until frames have run. `hz` is 60 on NTSC. */
export function frameRate(samples: readonly LoopSample[], hz = 60): FrameRate | null {
  const first = samples[0];
  const last = samples.at(-1);
  if (!first || !last) return null;
  const frames = last.frame - first.frame;
  if (frames <= 0) return null;
  const loops = (last.loops - first.loops) & 0xffff;
  return { fps: (hz * loops) / frames, msPerLoop: loops ? ((1000 / hz) * frames) / loops : Infinity, frames };
}

/** Adds a sample, keeping about `window` frames; a restart (frames going back) starts afresh. */
export function addSample(samples: readonly LoopSample[], s: LoopSample, window = 120): LoopSample[] {
  const last = samples.at(-1);
  if (last && s.frame < last.frame) return [s];
  if (last && s.frame === last.frame) return [...samples.slice(0, -1), s];
  const kept = [...samples, s];
  while (kept.length > 2 && s.frame - kept[1]!.frame >= window) kept.shift();
  return kept;
}

export const LOOP_SYMBOLS = ["loopslo", "loopshi"] as const;

// ---- The kit's object table ----

/** The kit runtime's object table: 24 slots, a byte per slot in each array (engine.bas.hbs). */
export const OBJECT_SLOTS = 24;
export const EMPTY_SLOT = 255;
export const OBJECT_FIELDS = ["otype", "ox", "oy", "otimer"] as const;

export interface ObjectSlot {
  slot: number;
  /** Index into the game's things, or null for an empty slot. */
  type: number | null;
  x: number;
  y: number;
  timer: number;
}

/** The object table's memory, or null if this ROM doesn't have one. */
export function objectRanges(symbols: ReadonlyMap<string, number>): [number, number][] | null {
  const ranges = OBJECT_FIELDS.map((f) => symbols.get(f));
  return ranges.every((a) => a !== undefined) ? ranges.map((a) => [a!, OBJECT_SLOTS]) : null;
}

/** The four arrays (otype, ox, oy, otimer) as rows. */
export function objectSlots([type, x, y, timer]: Uint8Array[]): ObjectSlot[] {
  return Array.from({ length: OBJECT_SLOTS }, (_, slot) => ({
    slot,
    type: type![slot] === EMPTY_SLOT ? null : type![slot]!,
    x: x![slot]!,
    y: y![slot]!,
    timer: timer![slot]!,
  }));
}
