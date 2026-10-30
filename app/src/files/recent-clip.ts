import { create } from "zustand";

export const useRecentClip = create<{ gif: Uint8Array | null; set: (gif: Uint8Array | null) => void }>((set) => ({
  gif: null,
  set: (gif) => set({ gif }),
}));
