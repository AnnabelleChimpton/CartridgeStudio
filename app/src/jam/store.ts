// The jam a creator has joined, their entry's words and their latest clip.
// The brief and the words are kept in this browser (localStorage) because a
// jam lasts days; the clip only lives until the page closes.

import { create } from "zustand";
import { parseBrief, type JamBrief } from "./brief.ts";

const BRIEF_KEY = "cartridge-studio:jam";
const ENTRY_KEY = "cartridge-studio:jam-entry";

export interface EntryWords {
  /** Empty means the game's own title. */
  title: string;
  credits: string;
  description: string;
  controls: string;
}

export const EMPTY_WORDS: EntryWords = { title: "", credits: "", description: "", controls: "" };

interface JamState {
  brief: JamBrief | null;
  words: EntryWords;
  clip: Uint8Array | null;
  join: (b: JamBrief) => void;
  leave: () => void;
  setWords: (w: Partial<EntryWords>) => void;
  setClip: (gif: Uint8Array | null) => void;
}

function read<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private windows can refuse storage; the jam still works until the page closes.
  }
}

function savedBrief(): JamBrief | null {
  const raw = read<unknown>(BRIEF_KEY);
  if (!raw) return null;
  const r = parseBrief(raw);
  return r.ok ? r.brief : null;
}

export const useJamStore = create<JamState>((set, get) => ({
  brief: savedBrief(),
  words: { ...EMPTY_WORDS, ...read<Partial<EntryWords>>(ENTRY_KEY) },
  clip: null,
  join: (brief) => {
    write(BRIEF_KEY, brief);
    // A different jam starts with fresh words.
    if (get().brief?.name !== brief.name) {
      write(ENTRY_KEY, null);
      set({ brief, words: { ...EMPTY_WORDS, credits: get().words.credits } });
    } else set({ brief });
  },
  leave: () => {
    write(BRIEF_KEY, null);
    set({ brief: null });
  },
  setWords: (w) => {
    const words = { ...get().words, ...w };
    write(ENTRY_KEY, words);
    set({ words });
  },
  setClip: (clip) => set({ clip }),
}));
