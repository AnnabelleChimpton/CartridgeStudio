// Creator tests (Coder tier): checks a creator records by playing, kept as
// tests.json. Each test is a behaviour test (harness/behaviour.ts): the
// joystick from power-on, frame by frame, then an expectation on a variable.
// The file names its variables in its own watch map, so it reads the same in
// Cartridge Studio, in the exported source and in any emulator harness.
//
// tests.json is a sidecar, not a field of the game: the cartridge file and My
// games keep it next to project.json. Kit games and code projects store it
// the same way, and the kit's schema (owned by the kit model) is untouched.

import { z } from "zod";
import type { CoreHost } from "../emulator/core-host.ts";
import type { Recording } from "../emulator/protocol.ts";
import { BehaviourTestSchema, runRomOnHost, type BehaviourResult, type Step, type WatchMap } from "../harness/behaviour.ts";

export const TESTS_FORMAT = "cartridge-studio-tests";
export const TESTS_FILE = "tests.json";
export const MAX_TESTS = 50;
/** Steps in one test: a long, busy playthrough is a few hundred. */
export const MAX_STEPS = 2000;
/** The most tests.json may hold, written out. */
export const MAX_TESTS_BYTES = 1024 * 1024;
/** The longest recording kept: ten minutes of play. */
export const MAX_RECORDED_FRAMES = 36_000;

const WatchEntrySchema = z
  .object({
    symbol: z.string().regex(/^[A-Za-z_]\w{0,63}$/),
    offset: z.number().int().min(0).max(255).optional(),
    bytes: z.number().int().min(1).max(4).optional(),
    bcd: z.boolean().optional(),
  })
  .strict();

export const CreatorTestSchema = z
  .object({
    name: z.string().max(80),
    steps: BehaviourTestSchema.shape.steps.max(MAX_STEPS),
  })
  .strict();
export type CreatorTest = z.infer<typeof CreatorTestSchema>;

export const TestsFileSchema = z
  .object({
    format: z.literal(TESTS_FORMAT),
    version: z.literal(1),
    /** Variable names the tests use, and where each one is. */
    watch: z.record(z.string().regex(/^[A-Za-z_]\w{0,63}$/), WatchEntrySchema),
    tests: z.array(CreatorTestSchema).max(MAX_TESTS),
  })
  .strict();
export type TestsFile = z.infer<typeof TestsFileSchema>;

export const emptyTests = (): TestsFile => ({ format: TESTS_FORMAT, version: 1, watch: {}, tests: [] });

/** A stored or opened tests.json, or null if it isn't one this version can run. */
export function readTests(json: unknown): TestsFile | null {
  const r = TestsFileSchema.safeParse(json);
  return r.success ? r.data : null;
}

export const testsJson = (file: TestsFile) => `${JSON.stringify(file, null, 2)}\n`;

/** The file for exports: nothing when there are no tests. */
export const testsBytes = (file: TestsFile | undefined) => (file && file.tests.length ? new TextEncoder().encode(testsJson(file)) : undefined);

// ---- Recording a check ----

export type Op = "eq" | "ne" | "gte" | "lte";
export const OPS: { op: Op; words: string }[] = [
  { op: "eq", words: "is" },
  { op: "gte", words: "is at least" },
  { op: "lte", words: "is at most" },
  { op: "ne", words: "is not" },
];

/** What a check looks at: a known variable (score) or any symbol, by its watch entry. */
export interface CheckTarget {
  name: string;
  entry: WatchMap[string];
}

export interface Check {
  target: CheckTarget;
  op: Op;
  value: number;
}

/** The recorded joystick as steps: one per run of frames with the same controls held. */
export function stepsFromRecording(rec: Recording): Step[] {
  return rec.runs.filter((r) => r.frames > 0).map((r) => (r.hold.length ? { hold: [...r.hold], frames: r.frames } : { frames: r.frames }));
}

const sameEntry = (a: WatchMap[string], b: WatchMap[string]) =>
  a.symbol === b.symbol && (a.offset ?? 0) === (b.offset ?? 0) && (a.bytes ?? 1) === (b.bytes ?? 1) && !!a.bcd === !!b.bcd;

/** The name a check's variable goes by in the file: its own, unless another variable has it. */
function watchName(watch: WatchMap, t: CheckTarget): string {
  let name = t.name;
  for (let n = 2; watch[name] && !sameEntry(watch[name]!, t.entry); n++) name = `${t.name}_${n}`;
  return name;
}

/** Adds a test: the recording, then the check at the frame it ends on. */
export function addRecordedTest(file: TestsFile, name: string, rec: Recording, check: Check): TestsFile {
  if (file.tests.length >= MAX_TESTS) throw new Error(`A game keeps at most ${MAX_TESTS} tests.`);
  if (rec.frames > MAX_RECORDED_FRAMES) throw new Error("That recording is longer than ten minutes; record a shorter one.");
  const key = watchName(file.watch, check.target);
  const steps: Step[] = [...stepsFromRecording(rec), { expect: { [key]: { [check.op]: check.value } } }];
  if (steps.length > MAX_STEPS) throw new Error("That recording changes the controls too often to keep; record a shorter one.");
  const next = {
    ...file,
    watch: { ...file.watch, [key]: { ...check.target.entry } },
    tests: [...file.tests, { name: name.trim().slice(0, 80) || `Check ${file.tests.length + 1}`, steps }],
  };
  if (testsJson(next).length > MAX_TESTS_BYTES) throw new Error("The tests are too big to keep together; remove some first.");
  return next;
}

/** Takes a test out, and any variable no other test uses. */
export function removeTest(file: TestsFile, index: number): TestsFile {
  const tests = file.tests.filter((_, i) => i !== index);
  const used = new Set(tests.flatMap((t) => conditionNames(t.steps)));
  return { ...file, tests, watch: Object.fromEntries(Object.entries(file.watch).filter(([k]) => used.has(k))) };
}

function conditionNames(steps: Step[]): string[] {
  return steps.flatMap((s) =>
    "expect" in s ? Object.keys(s.expect) : "until" in s ? [...Object.keys(s.until), ...conditionNames(s.steps)] : "repeat" in s ? conditionNames(s.steps) : [],
  );
}

/** "score is at least 50", for the list and the announcement. */
export function describeTest(test: CreatorTest): string {
  const last = test.steps.at(-1);
  if (!last || !("expect" in last)) return `${test.steps.length} steps`;
  return Object.entries(last.expect)
    .map(([name, c]) => {
      const want = typeof c === "number" ? { eq: c } : c;
      return Object.entries(want)
        .map(([op, v]) => `${name} ${OPS.find((o) => o.op === op)?.words ?? op} ${v}`)
        .join(" and ");
    })
    .join(", ");
}

/** How many frames a test plays before its last check. */
export function testFrames(steps: Step[]): number {
  return steps.reduce((n, s) => n + ("frames" in s ? s.frames : "repeat" in s ? s.repeat * testFrames(s.steps) : 0), 0);
}

// ---- Running ----

export interface TestResult extends BehaviourResult {
  name: string;
}

/** Runs every test against one build, in order, on a headless core (a worker in the app). */
export async function runCreatorTests(host: CoreHost, a78: Uint8Array, symbols: string, file: TestsFile): Promise<TestResult[]> {
  const out: TestResult[] = [];
  for (const t of file.tests) out.push({ name: t.name, ...(await runRomOnHost(host, a78, symbols, file.watch, t.steps)) });
  return out;
}
