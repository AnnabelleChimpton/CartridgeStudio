// Template behaviour tests (SPEC.md, "Test layers"): scripted joystick input
// against a ROM built from a project, with checks on game variables read from
// RAM. Test files live in templates/<id>/tests/*.json and name variables by
// the template's `watch` map, so the same files can drive other emulators.

import { z } from "zod";
import type { Builder } from "@cartridge-studio/toolchain";
import { generate } from "../codegen/generate.ts";
import type { CoreHost, JoystickInput } from "../emulator/core-host.ts";
import { parseSymbols } from "../emulator/core-host.ts";
import type { Project, Template } from "../project/schema.ts";

/** Joystick 1, and the console's Pause, Reset and Select switches. */
const Control = z.enum(["up", "down", "left", "right", "fire", "pause", "reset", "select"]);

const Comparison = z.union([
  z.number(),
  z
    .object({
      eq: z.number(),
      ne: z.number(),
      gt: z.number(),
      gte: z.number(),
      lt: z.number(),
      lte: z.number(),
      multipleOf: z.number(),
    })
    .partial(),
]);
const Condition = z.record(z.string(), Comparison);
type Condition = z.infer<typeof Condition>;

export type Step =
  | { hold?: z.infer<typeof Control>[]; frames: number }
  | { repeat: number; steps: Step[] }
  | { until: Condition; maxFrames: number; steps: Step[] }
  | { expect: Condition };

const StepSchema: z.ZodType<Step> = z.lazy(() =>
  z.union([
    z.object({ expect: Condition }).strict(),
    z.object({ repeat: z.number().int().positive(), steps: z.array(StepSchema) }).strict(),
    z.object({ until: Condition, maxFrames: z.number().int().positive(), steps: z.array(StepSchema) }).strict(),
    z.object({ hold: z.array(Control).optional(), frames: z.number().int().positive() }).strict(),
  ]),
);

export const BehaviourTestSchema = z
  .object({
    name: z.string(),
    /** Changes to the template's sample project: params and sounds merge, rules replace. */
    project: z
      .object({
        params: z.record(z.string(), z.number()).optional(),
        sounds: z.record(z.string(), z.string()).optional(),
        rules: z.array(z.object({ when: z.string(), then: z.array(z.string()) })).optional(),
      })
      .strict()
      .default({}),
    steps: z.array(StepSchema).min(1),
  })
  .strict();
export type BehaviourTest = z.infer<typeof BehaviourTestSchema>;

export interface BehaviourResult {
  passed: boolean;
  frames: number;
  failure?: string;
}

class Failure extends Error {}

export function projectFor(test: BehaviourTest, template: Template): Project {
  const p = structuredClone(template.sample);
  Object.assign(p.params, test.project.params ?? {});
  Object.assign(p.sounds, test.project.sounds ?? {});
  if (test.project.rules) p.rules = structuredClone(test.project.rules);
  return p;
}

export async function runBehaviourTest(
  test: BehaviourTest,
  template: Template,
  builder: Builder,
  host: CoreHost,
): Promise<BehaviourResult> {
  const gen = generate(projectFor(test, template), template);
  if (!gen.ok) return { passed: false, frames: 0, failure: `Project invalid: ${gen.errors.join("; ")}` };
  const built = await builder.build({ ...gen.input, sign: false });
  if (!built.ok) return { passed: false, frames: 0, failure: `Build failed in ${built.stage}: ${built.message}` };
  return runRomOnHost(host, built.a78, built.symbols, template.manifest.watch, test.steps);
}

/** Game variables by name: a symbol (plus `offset` bytes, e.g. one slot of an object table). */
export type WatchMap = Record<string, { symbol: string; offset?: number; bytes?: number; bcd?: boolean }>;

const WANT_WORDS: Record<string, string> = { eq: "", ne: "anything but ", gt: "more than ", gte: "at least ", lt: "less than ", lte: "at most ", multipleOf: "a multiple of " };

/** A comparison in words: "at least 10 and at most 20". */
export const expectedWords = (want: Record<string, number | undefined>) =>
  Object.entries(want)
    .filter(([, n]) => n !== undefined)
    .map(([op, n]) => `${WANT_WORDS[op] ?? `${op} `}${n}`)
    .join(" and ");

/** A variable's bytes as a number: little-endian, or BCD digits in memory order (the score). */
export function decodeValue(bytes: Uint8Array, bcd = false): number {
  if (bcd) return Number([...bytes].map((b) => b.toString(16).padStart(2, "0")).join(""));
  return bytes.reduce((n, b, i) => n + b * 256 ** i, 0);
}

/** Runs steps against a built ROM in the headless core; `watch` names game variables by symbol. */
export async function runRomOnHost(
  host: CoreHost,
  a78: Uint8Array,
  symbolTable: string,
  watch: WatchMap,
  steps: Step[],
): Promise<BehaviourResult> {
  const symbols = parseSymbols(symbolTable);
  await host.load(a78);

  const read = (name: string): number => {
    const w = watch[name];
    if (!w) throw new Failure(`"${name}" isn't in the template's watch list`);
    const base = symbols.get(w.symbol);
    if (base === undefined) throw new Failure(`The ROM has no symbol "${w.symbol}"`);
    return decodeValue(host.readMemory(base + (w.offset ?? 0), w.bytes ?? 1), w.bcd);
  };

  const failures = (cond: Condition): string[] => {
    const out: string[] = [];
    for (const [name, c] of Object.entries(cond)) {
      const v = read(name);
      const want = typeof c === "number" ? { eq: c } : c;
      const bad =
        (want.eq !== undefined && v !== want.eq) ||
        (want.ne !== undefined && v === want.ne) ||
        (want.gt !== undefined && !(v > want.gt)) ||
        (want.gte !== undefined && !(v >= want.gte)) ||
        (want.lt !== undefined && !(v < want.lt)) ||
        (want.lte !== undefined && !(v <= want.lte)) ||
        (want.multipleOf !== undefined && v % want.multipleOf !== 0);
      if (bad) out.push(`${name} is ${v}, expected ${expectedWords(want)}`);
    }
    return out;
  };

  const exec = (steps: Step[]) => {
    for (const step of steps) {
      if ("expect" in step) {
        const f = failures(step.expect);
        if (f.length) throw new Failure(`At frame ${host.frame}: ${f.join("; ")}`);
      } else if ("repeat" in step) {
        for (let i = 0; i < step.repeat; i++) exec(step.steps);
      } else if ("until" in step) {
        const start = host.frame;
        while (failures(step.until).length) {
          if (host.frame - start >= step.maxFrames) {
            throw new Failure(`Still waiting after ${step.maxFrames} frames: ${failures(step.until).join("; ")}`);
          }
          const before = host.frame;
          exec(step.steps);
          if (host.frame === before) throw new Failure("An `until` step must advance frames");
        }
      } else {
        const held = new Set(step.hold ?? []);
        const input: JoystickInput = {
          up: held.has("up"),
          down: held.has("down"),
          left: held.has("left"),
          right: held.has("right"),
          fire: held.has("fire"),
          pause: held.has("pause"),
          reset: held.has("reset"),
          select: held.has("select"),
        };
        host.setInput(input);
        host.step(step.frames);
        host.setInput({ up: false, down: false, left: false, right: false, fire: false });
      }
    }
  };

  try {
    exec(steps);
    return { passed: true, frames: host.frame };
  } catch (e) {
    if (e instanceof Failure) return { passed: false, frames: host.frame, failure: e.message };
    throw e;
  }
}
