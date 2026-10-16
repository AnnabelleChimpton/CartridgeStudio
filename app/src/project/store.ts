// Document stores with undo/redo history (SPEC.md, "State"). Edits are
// recipes applied to a copy, so every history entry is an independent,
// serializable snapshot. One store per kind of game: template projects here,
// kit games in kit/store.ts.

import { create } from "zustand";
import type { Project } from "./schema.ts";

const HISTORY_LIMIT = 200;
/** Edits with the same key this close together merge into one undo step (slider drags, typing). */
const COALESCE_MS = 800;

export interface HistoryState<T> {
  project: T;
  past: T[];
  future: T[];
  lastEdit: { key: string; at: number } | null;
  edit: (recipe: (draft: T) => void, key?: string) => void;
  undo: () => void;
  redo: () => void;
  /** Replaces the document and clears history (loading a file, starting over). */
  load: (project: T) => void;
}

export function createHistoryStore<T>() {
  return create<HistoryState<T>>()((set, get) => ({
    project: undefined as unknown as T, // set by load() before first render
    past: [],
    future: [],
    lastEdit: null,

    edit(recipe, key) {
      const { project, past, lastEdit } = get();
      const draft = structuredClone(project);
      recipe(draft);
      if (JSON.stringify(draft) === JSON.stringify(project)) return;
      const now = Date.now();
      const merge = key !== undefined && lastEdit?.key === key && now - lastEdit.at < COALESCE_MS;
      set({
        project: draft,
        past: merge ? past : [...past, project].slice(-HISTORY_LIMIT),
        future: [],
        lastEdit: key === undefined ? null : { key, at: now },
      });
    },

    undo() {
      const { project, past, future } = get();
      const prev = past.at(-1);
      if (prev === undefined) return;
      set({ project: prev, past: past.slice(0, -1), future: [project, ...future], lastEdit: null });
    },

    redo() {
      const { project, past, future } = get();
      const next = future[0];
      if (next === undefined) return;
      set({ project: next, past: [...past, project], future: future.slice(1), lastEdit: null });
    },

    load(project) {
      set({ project, past: [], future: [], lastEdit: null });
    },
  }));
}

export const useProjectStore = createHistoryStore<Project>();
