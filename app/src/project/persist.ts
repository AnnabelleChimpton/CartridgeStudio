// Keeps the game being edited in IndexedDB so work survives reloads (no
// account). Template projects, kit games and code projects are kept
// separately, plus which one was open last.
//
// A save this version can't read (damaged, or from a newer version) is never
// overwritten: it's moved to a `recovered-<time>-<kind>` key and the editor
// says so. If even the move fails, saving to that key is switched off for the
// rest of the visit.

import { createStore, del, get, set } from "idb-keyval";
import { CodeProjectSchema, type CodeProject } from "../code/schema.ts";
import { loadKit } from "../kit/migrations.ts";
import type { KitGame } from "../kit/schema.ts";
import { loadProject } from "./load.ts";
import type { Project, Template } from "./schema.ts";

const CURRENT = "current";
const CURRENT_KIT = "current-kit";
const CURRENT_CODE = "current-code";
const MODE = "mode";

export type EditorMode = "template" | "kit" | "code";

/** The storage loadSession and the save functions use (IndexedDB in the app, a Map in tests). */
export interface KeyValue {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
}

const idb = (): KeyValue => {
  const store = createStore("cartridge-studio", "projects");
  return { get: (k) => get(k, store), set: (k, v) => set(k, v, store), del: (k) => del(k, store) };
};
let kv: KeyValue | null = null;
const storage = () => (kv ??= idb());

/** A save that couldn't be read, and where it was put. */
export interface Recovered {
  kind: "kit game" | "game" | "code project";
  /** The key it was moved to, or null if it couldn't be moved (it was left where it was). */
  key: string | null;
  errors: string[];
}

export interface Session {
  mode: EditorMode | null;
  project: Project | null;
  kit: KitGame | null;
  code: CodeProject | null;
  recovered: Recovered[];
}

/** Keys that hold a save this visit couldn't read or move; they're never written. */
const unreadable = new Set<string>();

async function setAside(store: KeyValue, key: string, raw: unknown, kind: Recovered["kind"], errors: string[]): Promise<Recovered> {
  const to = `recovered-${new Date().toISOString().replace(/[:.]/g, "-")}-${key}`;
  try {
    await store.set(to, raw);
    await store.del(key);
    return { kind, key: to, errors };
  } catch {
    unreadable.add(key);
    return { kind, key: null, errors };
  }
}

/** What was being edited, each part only if it still loads. */
export async function loadSession(templates: Record<string, Template>, store: KeyValue = storage()): Promise<Session> {
  const session: Session = { mode: null, project: null, kit: null, code: null, recovered: [] };
  let raw: [unknown, unknown, unknown, unknown];
  try {
    raw = await Promise.all([store.get(CURRENT), store.get(CURRENT_KIT), store.get(MODE), store.get(CURRENT_CODE)]);
  } catch {
    // Private windows can refuse IndexedDB; start fresh.
    return session;
  }
  const [rawProject, rawKit, mode, rawCode] = raw;
  if (rawProject !== undefined) {
    let r: ReturnType<typeof loadProject>;
    try {
      r = loadProject(rawProject, templates);
    } catch (e) {
      r = { ok: false, errors: [e instanceof Error ? e.message : String(e)] };
    }
    if (r.ok) session.project = r.project;
    else session.recovered.push(await setAside(store, CURRENT, rawProject, "game", r.errors));
  }
  if (rawKit !== undefined) {
    const r = loadKit(rawKit);
    if (r.ok) session.kit = r.game;
    else session.recovered.push(await setAside(store, CURRENT_KIT, rawKit, "kit game", r.errors));
  }
  if (rawCode !== undefined) {
    const r = CodeProjectSchema.safeParse(rawCode);
    if (r.success) session.code = r.data;
    else session.recovered.push(await setAside(store, CURRENT_CODE, rawCode, "code project", r.error.issues.map((i) => i.message)));
  }
  if (mode === "template" || mode === "kit" || mode === "code") session.mode = mode;
  // Saves from before the kit had no mode: they were template projects.
  if (!session.mode && session.project) session.mode = "template";
  return session;
}

/** A sentence for the editor about saves that were set aside. */
export function recoveredMessage(recovered: Recovered[]): string | null {
  if (!recovered.length) return null;
  return recovered
    .map((r) =>
      r.key
        ? `Your saved ${r.kind} couldn't be opened by this version of Cartridge Studio (${r.errors[0]}). Nothing was lost: it's kept in this browser as "${r.key}".`
        : `Your saved ${r.kind} couldn't be opened by this version of Cartridge Studio (${r.errors[0]}). It's been left untouched, and this visit won't save over it.`,
    )
    .join(" ");
}

async function put(key: string, value: unknown) {
  if (unreadable.has(key)) return;
  try {
    await storage().set(key, value);
  } catch {
    // Private windows can refuse IndexedDB; the editor still works without saving.
  }
}

export const saveProject = (project: Project) => put(CURRENT, project);
export const saveKitGame = (game: KitGame) => put(CURRENT_KIT, game);
export const saveCodeProject = (project: CodeProject) => put(CURRENT_CODE, project);
export const saveMode = (mode: EditorMode) => put(MODE, mode);
