// Code generation (SPEC.md, "Templates and code generation"): pure,
// deterministic, no network. Validate, resolve params, group rules by trigger,
// emit one PNG per sprite, render the engine template into game.bas.

import Handlebars from "handlebars";
import { encodeIndexedPng, type BuildInput } from "@cartridge-studio/toolchain";
import type { Project, SoundEffect, Template } from "../project/schema.ts";
import { resolveParam, resolveSound, validateProject } from "../project/validate.ts";
import { lintBasic } from "./lint.ts";

export type GenerateResult =
  | { ok: true; input: BuildInput & { files: Record<string, Uint8Array> } }
  | { ok: false; errors: string[] };

/** `player.shoot` -> `action_player_shoot` */
export const actionLabel = (id: string) => `action_${id.replace(/\./g, "_")}`;

/** Graphics file for a sprite frame: `enemy.png`, `enemy_1.png`, ... (7800basic plots frame n from the n-th consecutive graphic). */
export const frameFile = (role: string, frame: number) => (frame === 0 ? `${role}.png` : `${role}_${frame}.png`);

const hex = (n: number) => `$${n.toString(16).toUpperCase().padStart(2, "0")}`;

/** A 7800basic `data` block in playsfx's TIA format: header, chunks, end marker. */
export function soundData(label: string, sfx: SoundEffect): string {
  const priority = Math.min(255, sfx.chunks.length);
  return [
    ` data ${label}`,
    ` $10, ${hex(priority)}, ${hex(sfx.framesPerChunk)}`,
    ...sfx.chunks.map(([f, c, v]) => ` ${hex(f)}, ${hex(c)}, ${hex(v)}`),
    " $00, $00, $00",
    "end",
  ].join("\n");
}

/** Keeps titles to characters that are safe inside a `rem` line. */
export function sanitizeTitle(title: string): string {
  return title.replace(/[^A-Za-z0-9 .,!?'&-]/g, "").replace(/\s+/g, " ").trim().slice(0, 32) || "Untitled";
}

export function generate(input: unknown, template: Template): GenerateResult {
  const v = validateProject(input, template);
  if (!v.ok) return v;
  const project: Project = v.project;
  const m = template.manifest;

  const paletteIndex = new Map(project.palettes.map((p, i) => [p.id, i]));
  const spriteFor = (role: string) => {
    const s = project.sprites.find((sp) => sp.role === role);
    if (!s) throw new Error(`Template uses unknown sprite role "${role}"`);
    return s;
  };

  // Rules grouped by the hook their trigger fills, in project order.
  const hookLines = new Map<string, string[]>();
  const usedActions = new Set<string>();
  project.rules.forEach((rule, i) => {
    const trigger = m.triggers.find((t) => t.id === rule.when)!;
    const lines = hookLines.get(trigger.hook) ?? [];
    lines.push(` rem rule ${i + 1}: ${rule.when} -> ${rule.then.join(", ")}`);
    for (const action of rule.then) {
      lines.push(` gosub ${actionLabel(action)}`);
      usedActions.add(action);
    }
    hookLines.set(trigger.hook, lines);
  });

  const hb = Handlebars.create();
  hb.registerHelper("param", (id: string) => resolveParam(m, project, id));
  hb.registerHelper("subtract", (a: number, b: number) => a - b);
  hb.registerHelper("palette", (role: string) => paletteIndex.get(spriteFor(role).palette));
  hb.registerHelper("incgraphics", () =>
    m.sprites
      .flatMap((s) => Array.from({ length: s.frames }, (_, f) => ` incgraphic ${frameFile(s.role, f)} 160A 0 1 2 3`))
      .join("\n"),
  );
  // Sounds used so far; {{soundData}} must come after every {{sound}} in the engine.
  const usedSounds = new Map<string, SoundEffect>();
  hb.registerHelper("sound", (slot: string) => {
    const sfx = resolveSound(m, project, template.soundLibrary, slot);
    if (!sfx) return ` rem no sound for ${slot}`;
    usedSounds.set(slot, sfx);
    return ` playsfx sfx_${slot}`;
  });
  hb.registerHelper("soundData", () =>
    [...usedSounds].map(([slot, sfx]) => ` rem sound ${slot}: ${sfx.id}\n${soundData(`sfx_${slot}`, sfx)}`).join("\n\n"),
  );
  hb.registerHelper("paletteRegisters", () =>
    project.palettes
      .map((p, i) => ` rem palette ${p.id}\n P${i}C1 = ${p.colors[0]} : P${i}C2 = ${p.colors[1]} : P${i}C3 = ${p.colors[2]}`)
      .join("\n"),
  );
  hb.registerHelper("background", () => project.background.color);
  hb.registerHelper("hook", function (this: unknown, name: string, options: Handlebars.HelperOptions) {
    if (!m.triggers.some((t) => t.hook === name)) throw new Error(`Template uses unknown hook "${name}"`);
    const lines = hookLines.get(name);
    return lines ? lines.join("\n") : options.fn(this).replace(/^\n|\n$/g, "");
  });
  hb.registerHelper("actions", () =>
    m.actions
      .filter((a) => usedActions.has(a.id))
      .map((a) => {
        const snippet = template.actions[a.id];
        if (!snippet) throw new Error(`Template has no snippet for action "${a.id}"`);
        const body = hb.compile(snippet, { noEscape: true, strict: true, ignoreStandalone: true })({});
        return ` rem action ${a.id}\n${body.trimEnd()}\n`;
      })
      .join("\n"),
  );

  let source: string;
  try {
    const render = hb.compile(template.engine, { noEscape: true, strict: true, ignoreStandalone: true });
    source = render({ title: sanitizeTitle(project.title), templateVersion: m.version, romSize: m.romSize });
  } catch (e) {
    return { ok: false, errors: [`Template error: ${e instanceof Error ? e.message : String(e)}`] };
  }
  source = source.replace(/\n{3,}/g, "\n\n");

  const lint = lintBasic(source);
  if (lint.length) {
    return { ok: false, errors: lint.map((l) => `Template error on line ${l.line}: ${l.message}`) };
  }

  const files: Record<string, Uint8Array> = {};
  for (const role of m.sprites) {
    spriteFor(role.role).frames.forEach((frame, f) => (files[frameFile(role.role, f)] = encodeIndexedPng(frame)));
  }

  return { ok: true, input: { source, files } };
}
