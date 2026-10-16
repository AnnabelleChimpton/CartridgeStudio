// Keeps the game being edited in IndexedDB so work survives reloads (no
// account). Template projects and kit games are kept separately, plus which
// one was open last.

import { createStore, get, set } from "idb-keyval";
import { KitGameSchema, type KitGame } from "../kit/schema.ts";
import { loadProject } from "./load.ts";
import type { Project, Template } from "./schema.ts";

const store = () => createStore("cartridge-studio", "projects");
const CURRENT = "current";
const CURRENT_KIT = "current-kit";
const MODE = "mode";

export type EditorMode = "template" | "kit";

export interface Session {
  mode: EditorMode | null;
  project: Project | null;
  kit: KitGame | null;
}

/** What was being edited, each part only if it still loads. */
export async function loadSession(templates: Record<string, Template>): Promise<Session> {
  const session: Session = { mode: null, project: null, kit: null };
  try {
    const [rawProject, rawKit, mode] = await Promise.all([
      get<unknown>(CURRENT, store()),
      get<unknown>(CURRENT_KIT, store()),
      get<unknown>(MODE, store()),
    ]);
    if (rawProject) {
      const r = loadProject(rawProject, templates);
      if (r.ok) session.project = r.project;
      else console.warn("[project] the saved game couldn't be loaded:", r.errors);
    }
    if (rawKit) {
      const r = KitGameSchema.safeParse(rawKit);
      if (r.success) session.kit = r.data;
      else console.warn("[project] the saved kit game couldn't be loaded:", r.error.issues);
    }
    if (mode === "template" || mode === "kit") session.mode = mode;
    // Saves from before the kit had no mode: they were template projects.
    if (!session.mode && session.project) session.mode = "template";
  } catch {
    // Private windows can refuse IndexedDB; start fresh.
  }
  return session;
}

async function put(key: string, value: unknown) {
  try {
    await set(key, value, store());
  } catch {
    // Private windows can refuse IndexedDB; the editor still works without saving.
  }
}

export const saveProject = (project: Project) => put(CURRENT, project);
export const saveKitGame = (game: KitGame) => put(CURRENT_KIT, game);
export const saveMode = (mode: EditorMode) => put(MODE, mode);
