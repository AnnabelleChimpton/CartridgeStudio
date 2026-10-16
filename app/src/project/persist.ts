// Keeps the current project in IndexedDB so work survives reloads (no account).

import { createStore, get, set } from "idb-keyval";
import { loadProject } from "./load.ts";
import type { Project, Template } from "./schema.ts";

const store = () => createStore("cartridge-studio", "projects");
const CURRENT = "current";

/** The saved project, upgraded to its template's current version, if it loads and validates; otherwise null. */
export async function loadSavedProject(templates: Record<string, Template>): Promise<Project | null> {
  try {
    const raw: unknown = await get(CURRENT, store());
    if (!raw) return null;
    const r = loadProject(raw, templates);
    if (!r.ok) console.warn("[project] the saved game couldn't be loaded:", r.errors);
    return r.ok ? r.project : null;
  } catch {
    return null;
  }
}

export async function saveProject(project: Project): Promise<void> {
  try {
    await set(CURRENT, project, store());
  } catch {
    // Private windows can refuse IndexedDB; the editor still works without saving.
  }
}
