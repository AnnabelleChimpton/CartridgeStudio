import { describe, expect, it } from "vitest";
import { loadProject } from "./load.ts";
import type { Project } from "./schema.ts";
import { TEMPLATES, getTemplate } from "./templates.ts";

const template = getTemplate("fixed-shooter");

/** The sample as template 0.1.0 saved it: one enemy frame, no sounds. */
function v010(): Project {
  const p = structuredClone(template.sample);
  p.template.version = "0.1.0";
  const enemy = p.sprites.find((s) => s.role === "enemy")!;
  enemy.frames = [enemy.frames[0]!.map((r) => r.replace(/2/g, "3"))];
  p.sounds = {};
  return p;
}

describe("loadProject", () => {
  it("loads a current project unchanged", () => {
    const r = loadProject(structuredClone(template.sample), TEMPLATES);
    expect(r.ok && r.project).toEqual(template.sample);
  });

  it("upgrades a 0.1.0 project, keeping the creator's art", () => {
    const old = v010();
    const r = loadProject(old, TEMPLATES);
    if (!r.ok) throw new Error(r.errors.join("\n"));
    expect(r.project.template.version).toBe(template.manifest.version);
    const enemy = r.project.sprites.find((s) => s.role === "enemy")!;
    const original = old.sprites.find((s) => s.role === "enemy")!.frames[0];
    expect(enemy.frames).toEqual([original, original]);
    expect(old.template.version).toBe("0.1.0"); // input untouched
  });

  it("refuses versions it can't upgrade and things that aren't projects", () => {
    const p = structuredClone(template.sample);
    p.template.version = "9.9.9";
    expect(loadProject(p, TEMPLATES)).toEqual({ ok: false, errors: [expect.stringContaining("can't be upgraded")] });
    expect(loadProject({ hello: 1 }, TEMPLATES).ok).toBe(false);
    expect(loadProject({ ...template.sample, template: { id: "platformer", version: "1.0.0" } }, TEMPLATES)).toEqual({
      ok: false,
      errors: ['This game needs the "platformer" template.'],
    });
  });
});
