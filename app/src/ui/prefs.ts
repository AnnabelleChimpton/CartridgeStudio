// Per-browser display preference: the tier (what the editor shows by
// default). It is written to <html data-tier="starter|maker|coder"> so CSS
// can follow it. See design/DIRECTION.md, Three tiers.

import { useSyncExternalStore } from "react";

export type Tier = "starter" | "maker" | "coder";

export const TIERS: { id: Tier; label: string; detail: string }[] = [
  { id: "starter", label: "Starter", detail: "Things, the room and the game. The simplest place to begin." },
  { id: "maker", label: "Maker", detail: "Adds rules, counters and the developer drawer." },
  { id: "coder", label: "Coder", detail: "Everything, with the generated 7800basic code close at hand." },
];

function pref<T extends string>(key: string, allowed: readonly T[], fallback: T, apply: (v: T) => void) {
  const listeners = new Set<() => void>();
  let value = fallback;
  try {
    const stored = localStorage.getItem(key) as T | null;
    if (stored && allowed.includes(stored)) value = stored;
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

const tier = pref<Tier>("cs-tier", ["starter", "maker", "coder"], "starter", (v) => root()?.setAttribute("data-tier", v));
export const setTier = tier.set;
export const useTier = () => useSyncExternalStore(tier.subscribe, tier.get);
