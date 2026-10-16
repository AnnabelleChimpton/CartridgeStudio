// .cartridge files (SPEC.md, "File export"): the project JSON, zipped with a
// thumbnail of the game. Opening one goes through the same migrations,
// template upgrades and validation as a saved project.

import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { MAX_TESTS_BYTES, TESTS_FILE, readTests, testsBytes, type TestsFile } from "../code/creator-tests.ts";
import { CodeProjectSchema, isCodeProject, type CodeProject } from "../code/schema.ts";
import { KIT_RUNTIME_VERSION } from "../kit/generate.ts";
import { loadKit } from "../kit/migrations.ts";
import type { KitGame } from "../kit/schema.ts";
import { loadProject, type LoadResult } from "../project/load.ts";
import type { Project, Template } from "../project/schema.ts";
import { APP_VERSION } from "../version.ts";

export const CARTRIDGE_EXTENSION = ".cartridge";
/** Game files are a few hundred KB at most; anything much bigger isn't one. */
export const MAX_CARTRIDGE_BYTES = 2 * 1024 * 1024;
/** The only entries read, and the most each may unpack to. Anything else in the ZIP is ignored. */
const ENTRY_LIMITS: Record<string, number> = {
  "cartridge.json": 4 * 1024,
  "project.json": 1536 * 1024,
  "thumbnail.png": 512 * 1024,
  "game.bas": 512 * 1024,
  [TESTS_FILE]: MAX_TESTS_BYTES,
};
const FORMAT = "cartridge-studio";
const FORMAT_VERSION = 1;

/**
 * Writes a template project, a kit game or a code project. `cartridge.json`
 * says which (no `kind` means a template project), and which app and kit
 * runtime wrote it. A code project's game.bas is also stored as a plain file,
 * so the source is readable without the app. Creator tests, if there are
 * any, ride along as tests.json.
 */
export function writeCartridgeFile(project: Project | KitGame | CodeProject, thumbnailPng?: Uint8Array, tests?: TestsFile): Uint8Array {
  const kind = "kit" in project ? { kind: "kit", kitRuntime: KIT_RUNTIME_VERSION } : isCodeProject(project) ? { kind: "code" } : {};
  const files: Record<string, Uint8Array> = {
    "cartridge.json": strToU8(JSON.stringify({ format: FORMAT, version: FORMAT_VERSION, appVersion: APP_VERSION, ...kind }, null, 2)),
    "project.json": strToU8(JSON.stringify(project, null, 2)),
  };
  if (thumbnailPng) files["thumbnail.png"] = thumbnailPng;
  if (isCodeProject(project)) files["game.bas"] = strToU8(project.source);
  const testsFile = testsBytes(tests);
  if (testsFile) files[TESTS_FILE] = testsFile;
  // Fixed timestamps keep the file identical for identical projects.
  return zipSync(files, { level: 9, mtime: new Date("2026-01-01T00:00:00Z") });
}

export interface OpenedCartridge {
  result: LoadResult | { ok: true; kit: KitGame } | { ok: true; code: CodeProject };
  thumbnail?: Uint8Array;
  /** The game's creator tests, if it has any this version can run. */
  tests?: TestsFile;
}

/** tests.json, if there is one this version can run; a damaged one is left behind rather than refusing the game. */
function testsOf(files: Record<string, Uint8Array>): { tests?: TestsFile } {
  const raw = files[TESTS_FILE];
  if (!raw) return {};
  try {
    const tests = readTests(JSON.parse(strFromU8(raw)));
    return tests ? { tests } : {};
  } catch {
    return {};
  }
}

export function readCartridgeFile(bytes: Uint8Array, templates: Record<string, Template>): OpenedCartridge {
  // Files come from anywhere: bound what they can cost before reading them.
  if (bytes.length > MAX_CARTRIDGE_BYTES) return { result: { ok: false, errors: ["This file is too big to be a Cartridge Studio game file."] } };
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (f) => f.name in ENTRY_LIMITS && f.originalSize <= ENTRY_LIMITS[f.name]! && f.size <= MAX_CARTRIDGE_BYTES });
  } catch {
    return { result: { ok: false, errors: ["This isn't a Cartridge Studio game file."] } };
  }
  // The sizes in a ZIP's headers can lie; check what actually came out.
  if (Object.entries(files).some(([name, data]) => data.length > ENTRY_LIMITS[name]!)) {
    return { result: { ok: false, errors: ["This game file is damaged."] } };
  }
  const marker = files["cartridge.json"];
  const project = files["project.json"];
  if (!marker || !project) return { result: { ok: false, errors: ["This isn't a Cartridge Studio game file."] } };
  try {
    const meta = JSON.parse(strFromU8(marker)) as { format?: string; version?: number; kind?: string };
    if (meta.format !== FORMAT) return { result: { ok: false, errors: ["This isn't a Cartridge Studio game file."] } };
    if ((meta.version ?? 0) > FORMAT_VERSION) {
      return { result: { ok: false, errors: ["This game file was saved by a newer version of Cartridge Studio."] } };
    }
    const json: unknown = JSON.parse(strFromU8(project));
    if (meta.kind === "kit") {
      const kit = loadKit(json);
      if (!kit.ok) return { result: { ok: false, errors: [kit.newer ? "This game file was saved by a newer version of Cartridge Studio." : "This game file is damaged."] } };
      return { result: { ok: true, kit: kit.game }, thumbnail: files["thumbnail.png"], ...testsOf(files) };
    }
    if (meta.kind === "code") {
      const code = CodeProjectSchema.safeParse(json);
      if (!code.success) return { result: { ok: false, errors: ["This game file is damaged."] } };
      return { result: { ok: true, code: code.data }, thumbnail: files["thumbnail.png"], ...testsOf(files) };
    }
    if (meta.kind !== undefined) return { result: { ok: false, errors: ["This game file was saved by a newer version of Cartridge Studio."] } };
    return { result: loadProject(json, templates), thumbnail: files["thumbnail.png"], ...testsOf(files) };
  } catch {
    return { result: { ok: false, errors: ["This game file is damaged."] } };
  }
}
