// Runs template behaviour tests (templates/<id>/tests/*.json) in MAME's a7800
// driver, as a second opinion on the js7800 runner in
// app/src/harness/behaviour.ts. MAME runs behaviour.lua as an autoboot script,
// which plays the steps frame by frame and reports raw RAM bytes; the checks
// happen here, with the same rules as the js7800 runner.

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Builder } from "@cartridge-studio/toolchain";
import { generate } from "../../app/src/codegen/generate.ts";
import { parseSymbols } from "../../app/src/emulator/core-host.ts";
import { projectFor, type BehaviourResult, type BehaviourTest, type Step } from "../../app/src/harness/behaviour.ts";
import type { Template } from "../../app/src/project/schema.ts";

const LUA = fs.readFileSync(path.join(import.meta.dirname, "behaviour.lua"), "utf8");

/** Frames the BIOS may take to hand over to the cartridge (the real one needs a few). */
const BOOT_FRAMES = 600;

type Condition = Extract<Step, { expect: unknown }>["expect"];

export interface Mame {
  binary: string;
  version: string;
  /** Where MAME finds a7800's BIOS. */
  rompath: string;
  /** "real" when a7800's BIOS dump was found, else "stub" (see stubBios). */
  bios: "real" | "stub";
}

/**
 * Finds MAME and a7800's BIOS, or explains what's missing.
 * MAME_PATH overrides the binary, MAME_ROMPATH where to look for the BIOS
 * (`a7800.zip` or `a7800/7800.u7`), and MAME_BIOS=stub skips the real one.
 */
export function findMame(env = process.env): Mame | { missing: string } {
  const binary = env.MAME_PATH || "mame";
  const probe = spawnSync(binary, ["-version"], { encoding: "utf8" });
  if (probe.error || probe.status !== 0) {
    return {
      missing:
        `MAME isn't installed (tried "${binary}"), so the MAME behaviour tests are skipped. ` +
        `Install it with \`brew install mame\` (or your package manager), or set MAME_PATH. See harness/README.md.`,
    };
  }
  const version = probe.stdout.trim().split(/\s/)[0] ?? "unknown";
  const dirs = (env.MAME_ROMPATH ?? "").split(path.delimiter).filter(Boolean);
  const found = env.MAME_BIOS === "stub" ? undefined : dirs.find(hasA7800Bios);
  if (found) return { binary, version, rompath: found, bios: "real" };
  const rompath = fs.mkdtempSync(path.join(os.tmpdir(), "cs-mame-bios-"));
  fs.mkdirSync(path.join(rompath, "a7800"));
  fs.writeFileSync(path.join(rompath, "a7800", "7800.u7"), stubBios());
  return { binary, version, rompath, bios: "stub" };
}

function hasA7800Bios(dir: string): boolean {
  return fs.existsSync(path.join(dir, "a7800.zip")) || fs.existsSync(path.join(dir, "a7800", "7800.u7"));
}

/**
 * A 4 KB stand-in for the 7800 BIOS, so the tests run without the copyrighted
 * dump. It skips the cartridge signature check and hands over the way the real
 * BIOS finishes: from zero-page RAM, write INPTCTRL = $07 (lock, MARIA on,
 * BIOS off), then jump through the cartridge's reset vector. MAME warns that
 * the checksum is wrong and runs it anyway.
 */
export function stubBios(): Uint8Array {
  const rom = new Uint8Array(0x1000).fill(0xff);
  // prettier-ignore
  const code = [
    0x78,             // $F000 sei
    0xd8,             //       cld
    0xa2, 0xff,       //       ldx #$ff
    0x9a,             //       txs
    0xa2, 0x06,       //       ldx #6
    0xbd, 0x13, 0xf0, // copy: lda handover,x
    0x95, 0x80,       //       sta $80,x
    0xca,             //       dex
    0x10, 0xf8,       //       bpl copy
    0x4c, 0x80, 0x00, //       jmp $0080
    0x40,             // $F012 rti (NMI and IRQ)
    0xa9, 0x07,       // $F013 handover: lda #$07
    0x85, 0x01,       //       sta INPTCTRL
    0x6c, 0xfc, 0xff, //       jmp ($fffc)
  ];
  rom.set(code, 0);
  rom.set([0x12, 0xf0, 0x00, 0xf0, 0x12, 0xf0], 0xffa); // NMI, RESET, IRQ vectors
  return rom;
}

/** Steps as a Lua table literal, with an id on each expect and until step. */
function toLua(steps: Step[], conditions: Condition[]): string {
  const value = (v: unknown): string => {
    if (typeof v === "number") return String(v);
    if (typeof v === "string") return JSON.stringify(v);
    if (Array.isArray(v)) return `{${v.map(value).join(", ")}}`;
    const entries = Object.entries(v as Record<string, unknown>).map(([k, x]) => `[${JSON.stringify(k)}] = ${value(x)}`);
    return `{${entries.join(", ")}}`;
  };
  const step = (s: Step): string => {
    if ("expect" in s || "until" in s) {
      const id = conditions.push("expect" in s ? s.expect : s.until) - 1;
      const rest = "steps" in s ? { ...s, steps: undefined } : s;
      const fields = value(Object.fromEntries(Object.entries(rest).filter(([, x]) => x !== undefined)));
      const nested = "steps" in s ? `, steps = {${s.steps.map(step).join(", ")}}` : "";
      return `{id = ${id}, ${fields.slice(1, -1)}${nested}}`;
    }
    if ("repeat" in s) return `{["repeat"] = ${s.repeat}, steps = {${s.steps.map(step).join(", ")}}}`;
    return value(s);
  };
  return `{${steps.map(step).join(",\n  ")}}`;
}

type Watch = Template["manifest"]["watch"][string] & { address: number };

function decode(w: Watch, bytes: number[]): number {
  if (w.bcd) return Number(bytes.map((b) => b.toString(16).padStart(2, "0")).join(""));
  return bytes.reduce((n, b, i) => n + b * 256 ** i, 0); // little-endian
}

// The same comparison rules as app/src/harness/behaviour.ts.
function failures(cond: Condition, read: (name: string) => number): string[] {
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
    if (bad) out.push(`${name} is ${v}, expected ${JSON.stringify(c)}`);
  }
  return out;
}

type Report =
  | { type: "boot"; frames: number }
  | { type: "expect" | "timeout"; id: number; frame: number; bytes: Record<string, number[]> }
  | { type: "error"; message: string }
  | { type: "done"; frame: number };

export interface MameResult extends BehaviourResult {
  /** Frames the BIOS ran before the cartridge took over. */
  bootFrames?: number;
}

export async function runInMame(
  test: BehaviourTest,
  template: Template,
  builder: Builder,
  mame: Mame,
  { timeoutMs = 120_000 } = {},
): Promise<MameResult> {
  const gen = generate(projectFor(test, template), template);
  if (!gen.ok) return { passed: false, frames: 0, failure: `Project invalid: ${gen.errors.join("; ")}` };
  // Signed, because the real BIOS refuses an unsigned cartridge.
  const built = await builder.build({ ...gen.input, sign: true });
  if (!built.ok) return { passed: false, frames: 0, failure: `Build failed in ${built.stage}: ${built.message}` };
  return runRomInMame(built.a78, built.symbols, template.manifest.watch, test, mame, { timeoutMs });
}

/** Runs a test's steps against an already built (signed) ROM; `watch` names game variables by symbol. */
export async function runRomInMame(
  a78: Uint8Array,
  symbolTable: string,
  watchSymbols: Record<string, { symbol: string; offset?: number; bytes?: number; bcd?: boolean }>,
  test: Pick<BehaviourTest, "name" | "steps">,
  mame: Mame,
  { timeoutMs = 120_000 } = {},
): Promise<MameResult> {
  const built = { a78 };
  const symbols = parseSymbols(symbolTable);
  const watch: Record<string, Watch> = {};
  for (const [name, w] of Object.entries(watchSymbols)) {
    const base = symbols.get(w.symbol);
    if (base !== undefined) watch[name] = { symbol: w.symbol, bytes: w.bytes ?? 1, bcd: w.bcd ?? false, address: base + (w.offset ?? 0) };
  }
  const conditions: Condition[] = [];
  const steps = toLua(test.steps, conditions);
  for (const cond of conditions) {
    for (const name of Object.keys(cond)) {
      const w = watchSymbols[name];
      if (!w) return { passed: false, frames: 0, failure: `"${name}" isn't in the template's watch list` };
      if (!watch[name]) return { passed: false, frames: 0, failure: `The ROM has no symbol "${w.symbol}"` };
    }
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cs-mame-"));
  try {
    const rom = path.join(dir, "game.a78");
    const script = path.join(dir, "test.lua");
    const out = path.join(dir, "out.jsonl");
    fs.writeFileSync(rom, built.a78);
    const watchLua = Object.entries(watch)
      .map(([n, w]) => `[${JSON.stringify(n)}] = {address = ${w.address}, bytes = ${w.bytes ?? 1}, bcd = ${!!w.bcd}}`)
      .join(",\n  ");
    fs.writeFileSync(
      script,
      `STEPS = ${steps}\nWATCH = {\n  ${watchLua}\n}\nOUT = ${JSON.stringify(out)}\nBOOT_FRAMES = ${BOOT_FRAMES}\n\n${LUA}`,
    );
    const log = await runMame(mame, dir, rom, script, timeoutMs);
    const reports: Report[] = fs.existsSync(out)
      ? fs.readFileSync(out, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Report)
      : [];
    return check(reports, conditions, watch, test, log);
  } finally {
    if (process.env.MAME_KEEP) console.log(`Kept ${dir}`);
    else fs.rmSync(dir, { recursive: true, force: true });
  }
}

function check(
  reports: Report[],
  conditions: Condition[],
  watch: Record<string, Watch>,
  test: Pick<BehaviourTest, "name" | "steps">,
  log: string,
): MameResult {
  let frames = 0;
  let bootFrames: number | undefined;
  for (const r of reports) {
    if (r.type === "boot") bootFrames = r.frames;
    else if (r.type === "error") return { passed: false, frames, bootFrames, failure: `MAME script: ${r.message}` };
    else if (r.type === "done") return { passed: true, frames: r.frame, bootFrames };
    else {
      frames = r.frame;
      const cond = conditions[r.id]!;
      const f = failures(cond, (name) => decode(watch[name]!, r.bytes[name]!));
      if (r.type === "timeout") {
        const until = findUntil(test.steps, cond);
        return { passed: false, frames, bootFrames, failure: `Still waiting after ${until?.maxFrames} frames: ${f.join("; ")}` };
      }
      if (f.length) return { passed: false, frames, bootFrames, failure: `At frame ${r.frame}: ${f.join("; ")}` };
    }
  }
  return { passed: false, frames, bootFrames, failure: `MAME stopped before the test finished.\n${log.trim().slice(-2000)}` };
}

function findUntil(steps: Step[], cond: Condition): Extract<Step, { until: unknown }> | undefined {
  for (const s of steps) {
    if ("until" in s && s.until === cond) return s;
    if ("steps" in s) {
      const found = findUntil(s.steps, cond);
      if (found) return found;
    }
  }
  return undefined;
}

function runMame(mame: Mame, dir: string, rom: string, script: string, timeoutMs: number): Promise<string> {
  const args = [
    "a7800",
    "-cart", rom,
    "-rompath", mame.rompath,
    "-autoboot_script", script,
    "-autoboot_delay", "0",
    // Headless, unthrottled, and nothing read from or saved to a local MAME setup.
    "-video", "none",
    "-sound", "none",
    "-nothrottle",
    "-seconds_to_run", "36000",
    "-skip_gameinfo",
    "-noreadconfig",
    "-cfg_directory", path.join(dir, "cfg"),
    "-nvram_directory", path.join(dir, "nvram"),
    "-homepath", dir,
  ];
  return new Promise((resolve) => {
    const child = spawn(mame.binary, args, {
      cwd: dir,
      stdio: ["ignore", "pipe", "pipe"],
      // Keeps SDL off the display: on macOS MAME otherwise starts fullscreen
      // and blanks the screen for a moment, even with -video none.
      env: { ...process.env, SDL_VIDEODRIVER: "dummy" },
    });
    let log = "";
    child.stdout.on("data", (d: Buffer) => (log += d.toString()));
    child.stderr.on("data", (d: Buffer) => (log += d.toString()));
    const timer = setTimeout(() => {
      log += `\n[killed after ${timeoutMs} ms]`;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.on("close", () => {
      clearTimeout(timer);
      resolve(log);
    });
  });
}
