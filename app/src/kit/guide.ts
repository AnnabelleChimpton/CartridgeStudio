// The getting-started guide's state: which starter the current kit game came
// from, whether its guide is showing, and which steps are done. Kept per game
// in localStorage, so a dismissed guide stays dismissed after a reload and a
// new game gets a fresh one. Storage can be missing or full; the guide then
// simply forgets.

import { create } from "zustand";

export const GUIDE_STEPS = ["draw", "paint", "play"] as const;
export type GuideStep = (typeof GUIDE_STEPS)[number];

export interface GameGuide {
  /** The starter the game came from, for its ideas and to tell what changed. */
  preset: string | null;
  open: boolean;
  done: GuideStep[];
}

interface Saved {
  current: string | null;
  games: Record<string, GameGuide>;
}

const KEY = "cartridge-studio:kit-guide";
/** Guides kept for older games; a game is replaced whenever a new one starts. */
const KEEP = 20;

function read(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Saved | null;
    if (s && typeof s.games === "object" && s.games) return s;
  } catch {
    // No storage, or something else wrote there.
  }
  return { current: null, games: {} };
}

function write(s: Saved) {
  try {
    const ids = Object.keys(s.games);
    for (const id of ids.slice(0, Math.max(0, ids.length - KEEP))) if (id !== s.current) delete s.games[id];
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private mode or full: the guide works for this visit only.
  }
}

interface GuideState extends Saved {
  /** A new game from a starter: its guide opens. */
  start: (preset: string | null, open?: boolean) => void;
  setOpen: (open: boolean) => void;
  complete: (step: GuideStep) => void;
}

export const useGuide = create<GuideState>()((set, get) => {
  const update = (recipe: (g: GameGuide) => GameGuide) => {
    const { current, games } = get();
    if (!current || !games[current]) return;
    const next = { current, games: { ...games, [current]: recipe(games[current]) } };
    set(next);
    write(next);
  };
  return {
    ...read(),
    start(preset, open = true) {
      const id = `${preset ?? "file"}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const next = { current: id, games: { ...get().games, [id]: { preset, open, done: [] } } };
      set(next);
      write(next);
    },
    setOpen(open) {
      if (!get().current) get().start(null, open);
      else update((g) => ({ ...g, open }));
    },
    complete(step) {
      update((g) => (g.done.includes(step) ? g : { ...g, done: [...g.done, step] }));
    },
  };
});

/** The current game's guide, if it has one. */
export const useCurrentGuide = () => useGuide((s) => (s.current ? (s.games[s.current] ?? null) : null));
