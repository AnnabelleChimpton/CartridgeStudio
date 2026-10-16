// "My games": every game made in this browser, kept in IndexedDB so work
// survives reloads (no account). Each game has three keys: `meta:<id>` (title,
// kind and dates, for the start screen), `game:<id>` (the kit game or code
// project) and `thumb:<id>` (a PNG of the running game). `open` says which game
// was being edited.
//
// Saves from before the library (one slot per kind: `current-kit`,
// `current-code`, `current` for Classic shooter games) move into it on first
// load. Classic shooter games become code projects (the Classic editor is
// retired; see ejectTemplate).
//
// A save this version can't read (damaged, or from a newer version) is never
// overwritten: it's moved to a `recovered-<time>-<key>` key and the editor
// says so. If even the move fails, saving to that key is switched off for the
// rest of the visit.

import { createStore, del, get, keys, set } from "idb-keyval";
import { ejectTemplate } from "../code/eject.ts";
import { CodeProjectSchema, type CodeProject } from "../code/schema.ts";
import { loadKit } from "../kit/migrations.ts";
import type { KitGame } from "../kit/schema.ts";
import { loadProject } from "./load.ts";
import type { Project, Template } from "./schema.ts";

/** The two kinds of game there are editors for. */
export type EditorMode = "kit" | "code";

/** The game as the editor holds it. */
export type GameData = { kind: "kit"; game: KitGame } | { kind: "code"; game: CodeProject };

/** What the start screen shows for a game. */
export interface GameMeta {
  id: string;
  kind: EditorMode;
  title: string;
  created: number;
  updated: number;
}

export interface GameEntry extends GameMeta {
  thumbnail?: Uint8Array;
}

/** The storage the library uses (IndexedDB in the app, a Map in tests). */
export interface KeyValue {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

const idb = (): KeyValue => {
  const store = createStore("cartridge-studio", "projects");
  return {
    get: (k) => get(k, store),
    set: (k, v) => set(k, v, store),
    del: (k) => del(k, store),
    keys: async () => (await keys(store)).map(String),
  };
};
let kv: KeyValue | null = null;
const storage = () => (kv ??= idb());
/** Points the library at other storage (tests). */
export function setStorage(store: KeyValue | null) {
  kv = store;
  unreadable.clear();
  createdAt.clear();
  pending = null;
}

const OPEN = "open";
/** Set once the single-slot saves have moved into the library. */
const LIBRARY = "library";
const OLD_TEMPLATE = "current";
const OLD_KIT = "current-kit";
const OLD_CODE = "current-code";
const OLD_MODE = "mode";

const metaKey = (id: string) => `meta:${id}`;
const gameKey = (id: string) => `game:${id}`;
const thumbKey = (id: string) => `thumb:${id}`;

const newId = () => (typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

/** A save that couldn't be read, and where it was put. */
export interface Recovered {
  kind: "kit game" | "game" | "code project";
  /** The key it was moved to, or null if it couldn't be moved (it was left where it was). */
  key: string | null;
  errors: string[];
}

export interface Session {
  /** The game that was open, if it still loads. */
  open: { id: string; data: GameData } | null;
  recovered: Recovered[];
  /** Plain-words notes about saves that changed on the way in (a Classic shooter game that's now code). */
  notices: string[];
  /** The single-slot saves moved into My games on this load. */
  migrated: boolean;
}

/** Keys that hold a save this visit couldn't read or move; they're never written. */
const unreadable = new Set<string>();
/** When each game seen this visit was made, so saving needn't read it first. */
const createdAt = new Map<string, number>();

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

/** What a Classic shooter game becomes now its editor is retired, in plain words. */
export function classicNotice(title: string) {
  return `“${title || "Untitled"}” was made in the Classic shooter editor, which has been retired. It now opens as a code project: the same game as 7800basic code, with the same live preview. To keep making games without code, start a new one from a starting game.`;
}

/** A Classic shooter (template) project as the code project it now opens as. */
export function classicToCode(project: Project, templates: Record<string, Template>): CodeProject {
  const template = templates[project.template.id];
  if (!template) throw new Error(`No template “${project.template.id}”`);
  return ejectTemplate(project, template);
}

/** Reads a stored game, or says why it can't be read. */
function readGame(kind: unknown, raw: unknown): { ok: true; data: GameData } | { ok: false; errors: string[] } {
  if (kind === "kit") {
    const r = loadKit(raw);
    return r.ok ? { ok: true, data: { kind: "kit", game: r.game } } : { ok: false, errors: r.errors };
  }
  if (kind === "code") {
    const r = CodeProjectSchema.safeParse(raw);
    return r.success ? { ok: true, data: { kind: "code", game: r.data } } : { ok: false, errors: r.error.issues.map((i) => i.message) };
  }
  return { ok: false, errors: ["This version doesn't know this kind of game."] };
}

const metaOf = (id: string, data: GameData, created: number, updated = created): GameMeta => ({
  id,
  kind: data.kind,
  title: data.game.title,
  created,
  updated,
});

/** Moves the one-slot-per-kind saves into the library, once. */
async function migrate(store: KeyValue, templates: Record<string, Template>, session: Session): Promise<string | null> {
  if ((await store.get(LIBRARY)) !== undefined) return null;
  session.migrated = true;
  const [rawTemplate, rawKit, rawCode, mode] = await Promise.all([store.get(OLD_TEMPLATE), store.get(OLD_KIT), store.get(OLD_CODE), store.get(OLD_MODE)]);
  const now = Date.now();
  const opened: Partial<Record<"template" | "kit" | "code", string>> = {};
  const add = async (slot: "template" | "kit" | "code", data: GameData, at: number) => {
    const id = newId();
    await store.set(gameKey(id), data.game);
    await store.set(metaKey(id), metaOf(id, data, at));
    createdAt.set(id, at);
    opened[slot] = id;
  };
  if (rawKit !== undefined) {
    const r = loadKit(rawKit);
    if (r.ok) await add("kit", { kind: "kit", game: r.game }, now);
    else session.recovered.push(await setAside(store, OLD_KIT, rawKit, "kit game", r.errors));
  }
  if (rawCode !== undefined) {
    const r = CodeProjectSchema.safeParse(rawCode);
    if (r.success) await add("code", { kind: "code", game: r.data }, now - 1);
    else session.recovered.push(await setAside(store, OLD_CODE, rawCode, "code project", r.error.issues.map((i) => i.message)));
  }
  if (rawTemplate !== undefined) {
    let code: CodeProject | null = null;
    let errors: string[];
    try {
      const r = loadProject(rawTemplate, templates);
      if (r.ok) code = classicToCode(r.project, templates);
      errors = r.ok ? [] : r.errors;
    } catch (e) {
      errors = [e instanceof Error ? e.message : String(e)];
    }
    if (code) {
      await add("template", { kind: "code", game: code }, now - 2);
      session.notices.push(classicNotice(code.title));
    } else session.recovered.push(await setAside(store, OLD_TEMPLATE, rawTemplate, "game", errors));
  }
  await store.set(LIBRARY, 1);
  // The old keys go only once the library has them (set-aside ones are gone already).
  for (const k of [OLD_TEMPLATE, OLD_KIT, OLD_CODE, OLD_MODE]) if (!unreadable.has(k)) await store.del(k);
  // Saves from before the kit had no mode: they were template projects.
  const slot = mode === "kit" || mode === "code" || mode === "template" ? mode : "template";
  return opened[slot] ?? null;
}

/** Opens a game from the library, setting it aside if this version can't read it. */
async function loadFrom(store: KeyValue, id: string, session?: Session): Promise<GameData | null> {
  const [meta, raw] = (await Promise.all([store.get(metaKey(id)), store.get(gameKey(id))])) as [GameMeta | undefined, unknown];
  if (!meta || raw === undefined) return null;
  createdAt.set(id, meta.created);
  const r = readGame(meta.kind, raw);
  if (r.ok) return r.data;
  const recovered = await setAside(store, gameKey(id), raw, meta.kind === "code" ? "code project" : "kit game", r.errors);
  // Off the start screen: it can't be opened. The data itself is kept (above).
  if (recovered.key) await Promise.all([store.del(metaKey(id)), store.del(thumbKey(id))]).catch(() => undefined);
  session?.recovered.push(recovered);
  return null;
}

/** Moves old saves in if need be, then opens what was being edited. */
export async function loadSession(templates: Record<string, Template>, store: KeyValue = storage()): Promise<Session> {
  const session: Session = { open: null, recovered: [], notices: [], migrated: false };
  try {
    const migrated = await migrate(store, templates, session);
    await applyStash(store);
    const id = migrated ?? ((await store.get(OPEN)) as string | undefined);
    if (migrated) await store.set(OPEN, migrated);
    if (typeof id === "string") {
      const data = await loadFrom(store, id, session);
      if (data) session.open = { id, data };
    }
  } catch {
    // Private windows can refuse IndexedDB; start fresh.
  }
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

// Autosave: editors call autosave() on every change; it's written after a
// short pause, or at once by flushSave() (leaving a game, or the page).
const SAVE_DEBOUNCE_MS = 500;
let pending: { id: string; data: GameData; timer: ReturnType<typeof setTimeout> } | null = null;
/** What each game looked like when opened, so opening alone doesn't count as an edit. */
const opened = new Map<string, unknown>();

async function write(id: string, data: GameData) {
  const now = Date.now();
  // Both writes start at once, with nothing read first, so a flush on pagehide gets them going before the page goes.
  await Promise.all([put(gameKey(id), data.game), put(metaKey(id), metaOf(id, data, createdAt.get(id) ?? now, now))]);
}

/** Saves the open game after a short pause. */
export function autosave(id: string, data: GameData) {
  if (opened.get(id) === data.game) return;
  opened.delete(id);
  if (pending) clearTimeout(pending.timer);
  pending = { id, data, timer: setTimeout(() => void flushSave(), SAVE_DEBOUNCE_MS) };
}

/** Where leaving the page keeps a save still waiting, in case the page goes before IndexedDB has it. */
const STASH = "cartridge-studio:unsaved";

/**
 * Leaving the page (pagehide, or hidden): writes any save still waiting, and
 * keeps a copy in localStorage, which is written at once. The next load puts
 * it in My games if IndexedDB didn't get it.
 */
export function flushOnLeave() {
  const p = pending;
  if (!p) return;
  try {
    localStorage.setItem(STASH, JSON.stringify({ id: p.id, kind: p.data.kind, game: p.data.game, at: Date.now() }));
  } catch {
    // No storage, or full: IndexedDB may still get it.
  }
  void flushSave();
}

/** A save kept by flushOnLeave that IndexedDB never got. */
async function applyStash(store: KeyValue) {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STASH);
  } catch {
    return;
  }
  if (!raw) return;
  try {
    const s = JSON.parse(raw) as { id: string; kind: unknown; game: unknown; at: number };
    const meta = (await store.get(metaKey(s.id))) as GameMeta | undefined;
    const r = readGame(s.kind, s.game);
    if (meta && meta.updated < s.at && r.ok) {
      await store.set(gameKey(s.id), r.data.game);
      await store.set(metaKey(s.id), metaOf(s.id, r.data, meta.created, s.at));
    }
  } catch {
    // Damaged: nothing to put back.
  }
  try {
    localStorage.removeItem(STASH);
  } catch {
    // Read above, so this works too.
  }
}

/** Writes any save still waiting. */
export async function flushSave() {
  const p = pending;
  if (!p) return;
  clearTimeout(p.timer);
  pending = null;
  await write(p.id, p.data);
}

/** Drops a waiting save for this game (it's being deleted). */
function cancelSave(id: string) {
  if (pending?.id !== id) return;
  clearTimeout(pending.timer);
  pending = null;
}

/** Remembers which game is open, and what it looked like then. */
export function setOpen(id: string | null, data?: GameData) {
  if (id && data) opened.set(id, data.game);
  void (id ? put(OPEN, id) : storage().del(OPEN).catch(() => undefined));
}

/** Adds a game to the library and returns its id. */
export async function addGame(data: GameData, thumbnail?: Uint8Array): Promise<string> {
  const id = newId();
  const now = Date.now();
  await put(gameKey(id), data.game);
  await put(metaKey(id), metaOf(id, data, now));
  createdAt.set(id, now);
  if (thumbnail) await put(thumbKey(id), thumbnail);
  return id;
}

export const saveThumbnail = (id: string, png: Uint8Array) => put(thumbKey(id), png);

/** Every game, most recently changed first. */
export async function listGames(store: KeyValue = storage()): Promise<GameEntry[]> {
  try {
    const ids = (await store.keys()).filter((k) => k.startsWith("meta:")).map((k) => k.slice(5));
    const games = await Promise.all(
      ids.map(async (id) => {
        const [meta, thumb] = (await Promise.all([store.get(metaKey(id)), store.get(thumbKey(id))])) as [GameMeta | undefined, unknown];
        if (!meta) return null;
        const entry: GameEntry = { ...meta };
        if (thumb instanceof Uint8Array) entry.thumbnail = thumb;
        return entry;
      }),
    );
    return games.filter((g) => g !== null).sort((a, b) => b.updated - a.updated);
  } catch {
    return [];
  }
}

/** Opens a game; null if it's gone or can't be read (it's then set aside, and `recovered` says where). */
export async function loadGame(id: string): Promise<{ data: GameData | null; recovered: Recovered[] }> {
  await flushSave();
  const session: Session = { open: null, recovered: [], notices: [], migrated: false };
  try {
    return { data: await loadFrom(storage(), id, session), recovered: session.recovered };
  } catch {
    return { data: null, recovered: [] };
  }
}

/** Gives a game a new name: its title (and a kit game's title screen, while it follows the title). */
export function renamed<T extends GameData>(data: T, title: string): T {
  const game = structuredClone(data.game);
  if ("kit" in game && game.text.title === game.title) game.text.title = title;
  game.title = title;
  return { ...data, game };
}

export async function renameGame(id: string, title: string) {
  const { data } = await loadGame(id);
  if (data) await write(id, renamed(data, title));
}

/** Copies a game, thumbnail and all, as “<title> (copy)”. */
export async function duplicateGame(id: string): Promise<string | null> {
  const { data } = await loadGame(id);
  if (!data) return null;
  let thumb: unknown;
  try {
    thumb = await storage().get(thumbKey(id));
  } catch {
    thumb = undefined;
  }
  return addGame(renamed(data, `${data.game.title || "Untitled"} (copy)`), thumb instanceof Uint8Array ? thumb : undefined);
}

export async function deleteGame(id: string) {
  cancelSave(id);
  opened.delete(id);
  const store = storage();
  try {
    await Promise.all([store.del(metaKey(id)), store.del(gameKey(id)), store.del(thumbKey(id))]);
  } catch {
    // Nothing more to do; it stays on the list.
  }
}
