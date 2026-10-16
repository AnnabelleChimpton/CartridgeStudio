// The latest clip made in Show it, so packages and jam entries can include it.
// It lives only until the page closes.

import { create } from "zustand";

export const useRecentClip = create<{ gif: Uint8Array | null; set: (gif: Uint8Array | null) => void }>((set) => ({
  gif: null,
  set: (gif) => set({ gif }),
}));
