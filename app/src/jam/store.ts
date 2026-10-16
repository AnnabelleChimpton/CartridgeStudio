// The jam a creator has joined and their entry's details. Both are kept in
// this browser (localStorage) because a jam lasts days.

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
  /** An SPDX id from LICENCES; empty until chosen. */
  licence: string;
  /** May the organizer put it on a compilation? */
  compilation: boolean;
}

export const EMPTY_WORDS: EntryWords = { title: "", credits: "", description: "", controls: "", licence: "", compilation: false };

interface JamState {
  brief: JamBrief | null;
  words: EntryWords;
  join: (b: JamBrief) => void;
  leave: () => void;
  setWords: (w: Partial<EntryWords>) => void;
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
  join: (brief) => {
    write(BRIEF_KEY, brief);
    // A different jam starts with fresh words, keeping who you are and how you license your work.
    if (get().brief?.name !== brief.name) {
      const { credits, licence } = get().words;
      const words = { ...EMPTY_WORDS, credits, licence };
      write(ENTRY_KEY, words);
      set({ brief, words });
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
}));
