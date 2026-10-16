// My games: many games in one store, old single-slot saves moved in once
// (Classic shooter games as code), and saves that wait for a pause or a flush.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blankCodeProject } from "../code/eject.ts";
import { KIT_PRESETS } from "../kit/presets.ts";
import {
  addGame,
  autosave,
  deleteGame,
  duplicateGame,
  flushOnLeave,
  flushSave,
  listGames,
  loadGame,
  loadSession,
  renameGame,
  setOpen,
  setStorage,
  type GameData,
  type KeyValue,
} from "./persist.ts";
import { TEMPLATES, getTemplate } from "./templates.ts";

function memory(entries: Record<string, unknown> = {}): KeyValue & { map: Map<string, unknown> } {
  const map = new Map(Object.entries(entries));
  return {
    map,
    get: async (k) => map.get(k),
    set: async (k, v) => void map.set(k, v),
    del: async (k) => void map.delete(k),
    keys: async () => [...map.keys()],
  };
}

const kit = (i = 0): GameData => ({ kind: "kit", game: structuredClone(KIT_PRESETS[i]!.game) });
const code = (): GameData => ({ kind: "code", game: blankCodeProject() });

let store: ReturnType<typeof memory>;
beforeEach(() => {
  store = memory();
  setStorage(store);
});
afterEach(() => {
  vi.useRealTimers();
  setStorage(null);
});

describe("moving single-slot saves into My games", () => {
  it("keeps every kind, opens the one that was open, and drops the old keys", async () => {
    store = memory({ "current-kit": kit().game, "current-code": code().game, mode: "code" });
    const s = await loadSession(TEMPLATES, store);
    expect(s.migrated).toBe(true);
    expect(s.open?.data.kind).toBe("code");
    setStorage(store);
    expect((await listGames()).map((g) => g.kind).sort()).toEqual(["code", "kit"]);
    expect([...store.map.keys()].filter((k) => k.startsWith("current") || k === "mode")).toEqual([]);
    // Only once: the next load just opens the game.
    const again = await loadSession(TEMPLATES, store);
    expect(again.migrated).toBe(false);
    expect(again.open?.id).toBe(s.open?.id);
    expect(await listGames()).toHaveLength(2);
  });

  it("turns a Classic shooter save into a code project and says so", async () => {
    const sample = structuredClone(getTemplate("fixed-shooter").sample);
    // Saves from before the kit had no mode: they were Classic shooter games.
    store = memory({ current: sample });
    const s = await loadSession(TEMPLATES, store);
    expect(s.open?.data.kind).toBe("code");
    const game = s.open!.data.game as ReturnType<typeof blankCodeProject>;
    expect(game.title).toBe(sample.title);
    expect(game.source).toContain("drawscreen");
    expect(s.notices.join(" ")).toMatch(/Classic shooter editor, which has been retired\. It now opens as a code project/);
  });

  it("starts empty on a first visit", async () => {
    const s = await loadSession(TEMPLATES, store);
    expect(s.open).toBeNull();
    expect(await listGames()).toEqual([]);
  });
});

describe("the library", () => {
  it("adds games rather than replacing them, newest first", async () => {
    const a = await addGame(kit(0));
    vi.useFakeTimers({ now: Date.now() + 60_000 });
    const b = await addGame(code(), new Uint8Array([1, 2, 3]));
    const games = await listGames();
    expect(games.map((g) => g.id)).toEqual([b, a]);
    expect(games[0]!.thumbnail).toEqual(new Uint8Array([1, 2, 3]));
    expect(games[1]!.title).toBe(KIT_PRESETS[0]!.game.title);
  });

  it("renames, duplicates and deletes", async () => {
    const id = await addGame(kit(0));
    await renameGame(id, "Moth Patrol");
    const { data } = await loadGame(id);
    expect(data?.game.title).toBe("Moth Patrol");
    // A kit game's title screen follows its name until it's given words of its own.
    expect(data?.kind === "kit" && data.game.text.title).toBe("Moth Patrol");

    const copy = (await duplicateGame(id))!;
    expect((await loadGame(copy)).data?.game.title).toBe("Moth Patrol (copy)");
    expect(await listGames()).toHaveLength(2);

    await deleteGame(id);
    expect((await listGames()).map((g) => g.id)).toEqual([copy]);
    expect([...store.map.keys()].some((k) => k.endsWith(id))).toBe(false);
  });

  it("sets aside a game this version can't read, and takes it off the list", async () => {
    const id = await addGame(kit(0));
    store.map.set(`game:${id}`, { kit: 999 });
    const { data, recovered } = await loadGame(id);
    expect(data).toBeNull();
    expect(recovered[0]!.key).toMatch(new RegExp(`^recovered-.*-game:${id}$`));
    expect(store.map.get(recovered[0]!.key!)).toEqual({ kit: 999 });
    expect(await listGames()).toEqual([]);
  });
});

describe("autosave", () => {
  it("waits for a pause, and a flush writes at once", async () => {
    vi.useFakeTimers();
    const id = await addGame(kit(0));
    const edited = renamedKit(kit(0), "One");
    autosave(id, edited);
    expect((await loadGame(id)).data?.game.title).toBe("One"); // loadGame flushes first
    autosave(id, renamedKit(kit(0), "Two"));
    await vi.advanceTimersByTimeAsync(600);
    expect((store.map.get(`game:${id}`) as { title: string }).title).toBe("Two");
    autosave(id, renamedKit(kit(0), "Three"));
    await flushSave();
    expect((store.map.get(`game:${id}`) as { title: string }).title).toBe("Three");
  });

  it("doesn't count opening a game as a change, but does count undoing back to it", async () => {
    const data = kit(0);
    const id = await addGame(data);
    const before = (store.map.get(`meta:${id}`) as { updated: number }).updated;
    setOpen(id, data);
    autosave(id, data);
    await flushSave();
    expect((store.map.get(`meta:${id}`) as { updated: number }).updated).toBe(before);
    store.map.set(`game:${id}`, { ...data.game, title: "Changed" });
    autosave(id, renamedKit(data, "Changed"));
    autosave(id, data);
    await flushSave();
    expect((store.map.get(`game:${id}`) as { title: string }).title).toBe(data.game.title);
  });
});

describe("leaving the page", () => {
  it("keeps a waiting save in localStorage, and the next load puts it in My games if IndexedDB missed it", async () => {
    const local = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => local.get(k) ?? null,
      setItem: (k: string, v: string) => void local.set(k, v),
      removeItem: (k: string) => void local.delete(k),
    });
    try {
      const id = await addGame(kit(0));
      setOpen(id, kit(0));
      // The page goes before IndexedDB writes: drop what flushSave sends.
      const lost = memory(Object.fromEntries(store.map));
      setStorage({ ...lost, set: async () => undefined });
      autosave(id, renamedKit(kit(0), "Kept"));
      vi.useFakeTimers({ now: Date.now() + 1000 });
      flushOnLeave();
      expect(local.size).toBe(1);
      const s = await loadSession(TEMPLATES, lost);
      expect(s.open?.data.game.title).toBe("Kept");
      expect(local.size).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

function renamedKit(data: GameData, title: string): GameData {
  return { ...data, game: { ...data.game, title } } as GameData;
}
