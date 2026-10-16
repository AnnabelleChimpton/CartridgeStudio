// Template upgrades: when a template's version changes, a saved project made
// with an older version is brought up to date on load, keeping the creator's
// work (SPEC.md: "Templates are versioned separately so old projects keep
// building"). Each step goes from one version to the next.

import type { Project, Template } from "./schema.ts";

interface Upgrade {
  from: string;
  to: string;
  run: (project: Project) => void;
}

const UPGRADES: Record<string, Upgrade[]> = {
  "fixed-shooter": [
    {
      // 0.2.0 animates the enemy (2 frames) and adds sound slots, which fall
      // back to the template's defaults when unset.
      from: "0.1.0",
      to: "0.2.0",
      run(p) {
        const enemy = p.sprites.find((s) => s.role === "enemy");
        if (enemy && enemy.frames.length === 1) enemy.frames.push([...enemy.frames[0]!]);
      },
    },
  ],
};

/** Returns the project upgraded to the template's version (a copy), or throws if there's no path. */
export function upgradeProject(project: Project, template: Template): Project {
  const target = template.manifest.version;
  if (project.template.version === target) return project;
  const out = structuredClone(project);
  const steps = UPGRADES[template.manifest.id] ?? [];
  while (out.template.version !== target) {
    const step = steps.find((s) => s.from === out.template.version);
    if (!step) {
      throw new Error(`This game was made with ${template.manifest.name} ${out.template.version}, which can't be upgraded.`);
    }
    step.run(out);
    out.template.version = step.to;
  }
  return out;
}
