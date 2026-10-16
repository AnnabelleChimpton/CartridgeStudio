// The manual's text (SPEC.md, "Print PDF"): drafted from the template's
// sentences, the project's rules and its settings, then editable by the
// creator before export. Plain text with light markup: `# ` starts a heading,
// `- ` a bullet, and a blank line separates paragraphs.

import type { Project, Template } from "../project/schema.ts";
import { resolveParam } from "../project/validate.ts";

export interface ManualBlock {
  kind: "heading" | "paragraph" | "bullet";
  text: string;
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function joinAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

const filler = (project: Project, template: Template) => (text: string) =>
  text.replace(/\{(\w+)\}/g, (_, id: string) => String(resolveParam(template.manifest, project, id)));

/** The template's facts that apply to this project, with settings filled in (for the box back). */
export function manualFacts(project: Project, template: Template): string[] {
  const m = template.manifest;
  const fill = filler(project, template);
  return (m.manual?.facts ?? [])
    .filter((f) => typeof f === "string" || resolveParam(m, project, f.if) !== 0)
    .map((f) => fill(typeof f === "string" ? f : f.text));
}

export function draftManual(project: Project, template: Template): string {
  const m = template.manifest;
  const fill = filler(project, template);
  const out: string[] = [];

  if (m.manual) {
    out.push("# How to play", fill(m.manual.intro), "", "# Controls", ...m.manual.controls.map((c) => `- ${fill(c)}`), "");
  }

  const rules = project.rules.flatMap((r) => {
    const trigger = m.triggers.find((t) => t.id === r.when);
    const actions = r.then.map((a) => m.actions.find((x) => x.id === a)?.label).filter((a): a is string => !!a);
    if (!trigger || actions.length === 0) return [];
    return [`- When ${lowerFirst(trigger.label)}, ${joinAnd(actions.map(lowerFirst))}.`];
  });
  if (rules.length) out.push("# Rules", ...rules, "");

  if (m.manual) {
    const facts = manualFacts(project, template).map((f) => `- ${f}`);
    if (facts.length) out.push("# Good to know", ...facts, "");
    out.push(fill(m.manual.gameOver));
  }
  return out.join("\n").trim() + "\n";
}

export function parseManual(text: string): ManualBlock[] {
  const blocks: ManualBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) flush();
    else if (line.startsWith("# ")) {
      flush();
      blocks.push({ kind: "heading", text: line.slice(2).trim() });
    } else if (line.startsWith("- ")) {
      flush();
      blocks.push({ kind: "bullet", text: line.slice(2).trim() });
    } else paragraph.push(line);
  }
  flush();
  return blocks;
}

/** The manual text to print: the creator's edit if there is one, otherwise the draft. */
export const manualText = (project: Project, template: Template) =>
  project.cartridge.manualText ?? draftManual(project, template);
