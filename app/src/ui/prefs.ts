// Per-browser display preference: the tier, named by what you touch (what
// the editor shows by default). It is written to
// <html data-tier="kit|rules|7800basic"> so CSS can follow it.

import { useSyncExternalStore } from "react";

export type Tier = "kit" | "rules" | "7800basic";

export const TIERS: { id: Tier; label: string; detail: string }[] = [
  { id: "kit", label: "Kit", detail: "Things, the room, the rules and the game settings." },
  { id: "rules", label: "Rules", detail: "Adds the Counters tab." },
  { id: "7800basic", label: "7800basic", detail: "Everything, with the generated code and cartridge stats open beside it." },
];

/** What the tiers were called before Oct 2026, as older browsers stored them. */
const OLD_TIERS: Record<string, Tier> = { starter: "kit", maker: "rules", coder: "7800basic" };

/** A stored tier, with the old names read as the new ones; null for anything else. */
export function readTier(stored: string | null): Tier | null {
  if (stored === null) return null;
  const t = OLD_TIERS[stored] ?? stored;
  return TIERS.some((x) => x.id === t) ? (t as Tier) : null;
}

function pref<T extends string>(key: string, read: (stored: string | null) => T | null, fallback: T, apply: (v: T) => void) {
  const listeners = new Set<() => void>();
  let value = fallback;
  try {
    const stored = localStorage.getItem(key);
    const v = read(stored);
    if (v !== null) value = v;
    // Old names are rewritten once, so the stored value is always a current one.
    if (v !== null && v !== stored) localStorage.setItem(key, v);
  } catch {
    // Storage blocked: keep the default for this visit.
  }
  apply(value);
  return {
    get: () => value,
    set(v: T) {
      value = v;
      try {
        localStorage.setItem(key, v);
      } catch {
        // Not remembered, but still applied.
      }
      apply(v);
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
  };
}

const root = () => (typeof document === "undefined" ? null : document.documentElement);

const tier = pref<Tier>("cs-tier", readTier, "kit", (v) => root()?.setAttribute("data-tier", v));
export const setTier = tier.set;
export const useTier = () => useSyncExternalStore(tier.subscribe, tier.get);
