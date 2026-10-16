// Turns stored or imported JSON into a current project: schema migrations,
// then the template upgrade, then validation against the template.

import { migrate } from "./migrations.ts";
import { ProjectSchema, type Project, type Template } from "./schema.ts";
import { upgradeProject } from "./upgrades.ts";
import { validateProject } from "./validate.ts";

export type LoadResult = { ok: true; project: Project } | { ok: false; errors: string[] };

export function loadProject(input: unknown, templates: Record<string, Template>): LoadResult {
  try {
    const parsed = ProjectSchema.safeParse(migrate(input));
    if (!parsed.success) return { ok: false, errors: ["This isn't a Cartridge Studio game, or it's damaged."] };
    const template = templates[parsed.data.template.id];
    if (!template) return { ok: false, errors: [`This game needs the "${parsed.data.template.id}" template.`] };
    return validateProject(upgradeProject(parsed.data, template), template);
  } catch (e) {
    return { ok: false, errors: [e instanceof Error ? e.message : String(e)] };
  }
}
