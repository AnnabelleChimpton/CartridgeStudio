// Schema migrations run when a project is loaded. Each entry upgrades a
// project from version n to n + 1. There is only schema 1 so far.

import { CURRENT_SCHEMA } from "./schema.ts";

type Migration = (project: Record<string, unknown>) => Record<string, unknown>;

const MIGRATIONS: Record<number, Migration> = {
  // 1: (p) => ({ ...p, schema: 2, ... }),
};

export function migrate(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  let project = input as Record<string, unknown>;
  let version = typeof project.schema === "number" ? project.schema : 0;
  if (version > CURRENT_SCHEMA) {
    throw new Error("This game was saved by a newer version of Cartridge Studio.");
  }
  while (version < CURRENT_SCHEMA) {
    const step = MIGRATIONS[version];
    if (!step) throw new Error(`No migration from schema ${version}`);
    project = step(project);
    version++;
  }
  return project;
}
