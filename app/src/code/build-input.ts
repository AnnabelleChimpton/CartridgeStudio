// What the toolchain gets for a code project: game.bas as written and one PNG
// per graphic. Problems here are the creator's to fix, so they read like
// build errors.

import { encodeIndexedPng, type BuildInput } from "@cartridge-studio/toolchain";
import { CodeProjectSchema, graphicFile, type CodeProject } from "./schema.ts";

export type CodeInput = { ok: true; input: BuildInput & { files: Record<string, Uint8Array> } } | { ok: false; errors: string[] };

export function codeBuildInput(project: CodeProject): CodeInput {
  const parsed = CodeProjectSchema.safeParse(project);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  if (!project.source.trim()) return { ok: false, errors: ["game.bas is empty."] };
  const files: Record<string, Uint8Array> = {};
  for (const g of project.graphics) files[graphicFile(g)] = encodeIndexedPng(g.rows);
  return { ok: true, input: { source: project.source, files } };
}
