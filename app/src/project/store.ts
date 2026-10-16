// Project store: the project JSON plus undo/redo history (SPEC.md, "State").
// Edits are recipes applied to a copy, so every history entry is an
// independent, serializable snapshot.

import { create } from "zustand";
import type { Project } from "./schema.ts";

const HISTORY_LIMIT = 200;
/** Edits with the same key this close together merge into one undo step (slider drags, typing). */
const COALESCE_MS = 800;

interface ProjectState {
  project: Project;
  past: Project[];
  future: Project[];
  lastEdit: { key: string; at: number } | null;
  edit: (recipe: (draft: Project) => void, key?: string) => void;
  undo: () => void;
  redo: () => void;
  /** Replaces the project and clears history (loading a file, starting over). */
  load: (project: Project) => void;
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  project: undefined as unknown as Project, // set by load() before first render
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
    if (!prev) return;
    set({ project: prev, past: past.slice(0, -1), future: [project, ...future], lastEdit: null });
  },

  redo() {
    const { project, past, future } = get();
    const next = future[0];
    if (!next) return;
    set({ project: next, past: [...past, project], future: future.slice(1), lastEdit: null });
  },

  load(project) {
    set({ project, past: [], future: [], lastEdit: null });
  },
}));
