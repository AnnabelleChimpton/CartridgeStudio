// A code project as plain files (the source folder, code/export.ts), for the
// source export and the submission package.

import { encodeIndexedPng } from "@cartridge-studio/toolchain";
import { strToU8 } from "fflate";
import { KIT_TOOLCHAIN, type SourceExtras } from "../files/exports.ts";
import { sourceFolder } from "./export.ts";
import { graphicFile, type CodeProject } from "./schema.ts";

export function codeSourceFiles(project: CodeProject, extras: SourceExtras = {}): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = { "game.bas": strToU8(project.source) };
  for (const g of project.graphics) files[graphicFile(g)] = encodeIndexedPng(g.rows);
  return sourceFolder({ title: project.title, madeFrom: project.origin ? `a code project, made from ${project.origin}` : "a code project", files, ...extras });
}

export const codeCredits = () =>
  `It was built with ${KIT_TOOLCHAIN}
  (GPL v2; ROMs built from your own source are yours, and its runtime
  routines are CC0).`;
