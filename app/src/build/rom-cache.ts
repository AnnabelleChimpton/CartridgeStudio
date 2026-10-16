// Build results cached in IndexedDB, keyed by a hash of everything that goes
// into the compiler, so undo and redo reload instantly (SPEC.md, "How it runs").

import { createStore, del, get, keys, set } from "idb-keyval";
import type { BuildInput } from "@cartridge-studio/toolchain";

export interface CachedRom {
  a78: Uint8Array;
  bin: Uint8Array;
  symbols: string;
  at: number;
}

export interface RomCache {
  get(key: string): Promise<CachedRom | undefined>;
  set(key: string, rom: CachedRom): Promise<void>;
}

const MAX_ENTRIES = 100;

export async function cacheKey(input: BuildInput, toolchainVersion: string): Promise<string> {
  const enc = new TextEncoder();
  const flags = `${input.optimize ? 1 : 0}${(input.sign ?? true) ? 1 : 0}`;
  const parts: Uint8Array[] = [enc.encode(`${toolchainVersion}\0${flags}\0${input.source}\0`)];
  for (const name of Object.keys(input.files ?? {}).sort()) {
    parts.push(enc.encode(`${name}\0`), input.files![name]!);
  }
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    all.set(p, o);
    o += p.length;
  }
  const digest = await crypto.subtle.digest("SHA-256", all);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** IndexedDB-backed cache; falls back to doing nothing where IndexedDB is unavailable. */
export function idbRomCache(): RomCache {
  let store: ReturnType<typeof createStore> | null = null;
  try {
    store = createStore("cartridge-studio-roms", "roms");
  } catch {
    store = null;
  }
  return {
    async get(key) {
      if (!store) return undefined;
      try {
        return await get<CachedRom>(key, store);
      } catch {
        return undefined;
      }
    },
    async set(key, rom) {
      if (!store) return;
      try {
        await set(key, rom, store);
        const all = await keys(store);
        if (all.length > MAX_ENTRIES) {
          // Evict the oldest entries; the cache is only a speed-up.
          const entries = await Promise.all(all.map(async (k) => [k, (await get<CachedRom>(k, store!))?.at ?? 0] as const));
          entries.sort((a, b) => a[1] - b[1]);
          await Promise.all(entries.slice(0, all.length - MAX_ENTRIES).map(([k]) => del(k, store!)));
        }
      } catch {
        // Ignore quota and private-mode errors.
      }
    },
  };
}
