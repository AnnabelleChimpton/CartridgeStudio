// Kit migrations: every frozen old game still loads and builds, and saves this
// version can't read are set aside rather than lost.

import { strToU8, unzipSync, zipSync, strFromU8 } from "fflate";
import { beforeAll, describe, expect, it } from "vitest";
import type { WasiBuilder } from "@cartridge-studio/toolchain";
import { readCartridgeFile, writeCartridgeFile } from "../files/cartridge-file.ts";
import { nodeBuilder } from "../harness/node.ts";
import { loadSession, recoveredMessage, type KeyValue } from "../project/persist.ts";
import { SOUND_LIBRARY, TEMPLATES } from "../project/templates.ts";
import { APP_VERSION } from "../version.ts";
import { KIT_RUNTIME_VERSION, validateKit } from "./generate.ts";
import { NEWER_KIT, loadKit } from "./migrations.ts";
import { KIT_VERSION } from "./schema.ts";
import { buildKitRom } from "./tests.ts";

const fixtures = import.meta.glob<unknown>("./fixtures/v*/*.json", { import: "default", eager: true });

let builder: WasiBuilder;
beforeAll(async () => {
  builder = await nodeBuilder();
});

describe("frozen old kit games", () => {
  it("there are fixtures for version 1", () => expect(Object.keys(fixtures).filter((p) => p.includes("/v1/")).length).toBe(4));

  for (const [path, json] of Object.entries(fixtures)) {
    it(`${path} migrates, validates and builds`, async () => {
      const r = loadKit(structuredClone(json));
      if (!r.ok) throw new Error(r.errors.join("\n"));
      expect(r.game.kit).toBe(KIT_VERSION);
      const v = validateKit(r.game, SOUND_LIBRARY);
      if (!v.ok) throw new Error(v.errors.join("\n"));
      const rom = await buildKitRom(r.game, SOUND_LIBRARY, builder);
      expect(rom.ok ? null : rom.failure).toBeNull();
    });
  }
});

describe("loadKit", () => {
  const maze = () => structuredClone(Object.entries(fixtures).find(([p]) => p.endsWith("/maze.json"))![1]) as Record<string, unknown>;

  it("refuses games from a newer version, without a version, or not games at all", () => {
    expect(loadKit({ ...maze(), kit: KIT_VERSION + 1 })).toEqual({ ok: false, errors: [NEWER_KIT], newer: true });
    const { kit: _, ...unversioned } = maze();
    expect(loadKit(unversioned).ok).toBe(false);
    expect(loadKit("hello").ok).toBe(false);
    expect(loadKit([]).ok).toBe(false);
  });

  it("says when a current game is damaged", () => {
    const r = loadKit({ ...maze(), lives: "many" });
    expect(r.ok ? [] : r.errors[0]).toMatch(/^This game file is damaged \(lives:/);
  });
});

/** A Map with the KeyValue shape; `failSet` makes writes throw. */
function memory(entries: Record<string, unknown>, failSet = false): KeyValue & { map: Map<string, unknown> } {
  const map = new Map(Object.entries(entries));
  return {
    map,
    get: async (k) => map.get(k),
    set: async (k, v) => {
      if (failSet) throw new Error("quota");
      map.set(k, v);
    },
    del: async (k) => void map.delete(k),
  };
}

describe("saved sessions", () => {
  const maze = Object.entries(fixtures).find(([p]) => p.endsWith("/maze.json"))![1];

  it("loads a good kit save", async () => {
    const s = await loadSession(TEMPLATES, memory({ "current-kit": maze, mode: "kit" }));
    expect(s.kit?.title).toBe("Yarn Hunt");
    expect(s.recovered).toEqual([]);
  });

  it("moves a save it can't read to a recovered key instead of dropping it", async () => {
    const newer = { ...(maze as object), kit: KIT_VERSION + 1 };
    const store = memory({ "current-kit": newer, mode: "kit" });
    const s = await loadSession(TEMPLATES, store);
    expect(s.kit).toBeNull();
    expect(store.map.has("current-kit")).toBe(false);
    const key = s.recovered[0]!.key!;
    expect(key).toMatch(/^recovered-.*-current-kit$/);
    expect(store.map.get(key)).toEqual(newer);
    expect(recoveredMessage(s.recovered)).toContain(`kept in this browser as "${key}"`);
  });

  it("leaves a save in place when it can't be moved", async () => {
    const store = memory({ "current-kit": { kit: 1, title: 5 } }, true);
    const s = await loadSession(TEMPLATES, store);
    expect(s.recovered[0]!.key).toBeNull();
    expect(store.map.get("current-kit")).toEqual({ kit: 1, title: 5 });
    expect(recoveredMessage(s.recovered)).toContain("won't save over it");
  });
});

describe(".cartridge files for kit games", () => {
  const maze = loadKit(Object.entries(fixtures).find(([p]) => p.endsWith("/maze.json"))![1]);
  if (!maze.ok) throw new Error("maze fixture");

  it("record the app and kit runtime versions, and open through the migrations", () => {
    const bytes = writeCartridgeFile(maze.game);
    const meta = JSON.parse(strFromU8(unzipSync(bytes)["cartridge.json"]!)) as Record<string, unknown>;
    expect(meta).toMatchObject({ kind: "kit", appVersion: APP_VERSION, kitRuntime: KIT_RUNTIME_VERSION });
    expect(readCartridgeFile(bytes, TEMPLATES).result).toEqual({ ok: true, kit: maze.game });
  });

  it("refuse a kit game from a newer version with a clear message", () => {
    const bytes = zipSync({
      "cartridge.json": strToU8('{"format":"cartridge-studio","version":1,"kind":"kit"}'),
      "project.json": strToU8(JSON.stringify({ ...maze.game, kit: KIT_VERSION + 1 })),
    });
    const r = readCartridgeFile(bytes, TEMPLATES).result;
    expect(r.ok ? null : r.errors).toEqual(["This game file was saved by a newer version of Cartridge Studio."]);
  });
});
