// .cartridge files (SPEC.md, "File export"): the project JSON, zipped with a
// thumbnail of the game. Opening one goes through the same migrations,
// template upgrades and validation as a saved project.

import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { loadProject, type LoadResult } from "../project/load.ts";
import type { Project, Template } from "../project/schema.ts";

export const CARTRIDGE_EXTENSION = ".cartridge";
const FORMAT = "cartridge-studio";
const FORMAT_VERSION = 1;

export function writeCartridgeFile(project: Project, thumbnailPng?: Uint8Array): Uint8Array {
  const files: Record<string, Uint8Array> = {
    "cartridge.json": strToU8(JSON.stringify({ format: FORMAT, version: FORMAT_VERSION }, null, 2)),
    "project.json": strToU8(JSON.stringify(project, null, 2)),
  };
  if (thumbnailPng) files["thumbnail.png"] = thumbnailPng;
  // Fixed timestamps keep the file identical for identical projects.
  return zipSync(files, { level: 9, mtime: new Date("2026-01-01T00:00:00Z") });
}

export interface OpenedCartridge {
  result: LoadResult;
  thumbnail?: Uint8Array;
}

export function readCartridgeFile(bytes: Uint8Array, templates: Record<string, Template>): OpenedCartridge {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return { result: { ok: false, errors: ["This isn't a Cartridge Studio game file."] } };
  }
  const marker = files["cartridge.json"];
  const project = files["project.json"];
  if (!marker || !project) return { result: { ok: false, errors: ["This isn't a Cartridge Studio game file."] } };
  try {
    const meta = JSON.parse(strFromU8(marker)) as { format?: string; version?: number };
    if (meta.format !== FORMAT) return { result: { ok: false, errors: ["This isn't a Cartridge Studio game file."] } };
    if ((meta.version ?? 0) > FORMAT_VERSION) {
      return { result: { ok: false, errors: ["This game file was saved by a newer version of Cartridge Studio."] } };
    }
    return { result: loadProject(JSON.parse(strFromU8(project)), templates), thumbnail: files["thumbnail.png"] };
  } catch {
    return { result: { ok: false, errors: ["This game file is damaged."] } };
  }
}
