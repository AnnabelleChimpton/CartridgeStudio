// Game files come from anywhere: whatever the bytes, reading one returns a
// result (never throws) and never accepts something the schemas don't.

import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { blankCodeProject } from "../code/eject.ts";
import { KIT_PRESETS } from "../kit/presets.ts";
import { TEMPLATES, getTemplate } from "../project/templates.ts";
import { MAX_CARTRIDGE_BYTES, readCartridgeFile, writeCartridgeFile } from "./cartridge-file.ts";

/** A small deterministic PRNG, so a failure can be replayed. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

const samples = [
  writeCartridgeFile(structuredClone(getTemplate("fixed-shooter").sample)),
  writeCartridgeFile(structuredClone(KIT_PRESETS[0]!.game)),
  writeCartridgeFile(blankCodeProject()),
];

describe("readCartridgeFile on untrusted input", () => {
  it("survives random corruption of real game files", () => {
    const rand = rng(7800);
    for (let n = 0; n < 600; n++) {
      const bytes = samples[n % samples.length]!.slice();
      const flips = 1 + Math.floor(rand() * 8);
      for (let f = 0; f < flips; f++) bytes[Math.floor(rand() * bytes.length)] = Math.floor(rand() * 256);
      const cut = rand() < 0.2 ? bytes.subarray(0, Math.floor(rand() * bytes.length)) : bytes;
      expect(() => readCartridgeFile(cut, TEMPLATES)).not.toThrow();
    }
  });

  it("survives random bytes and hostile JSON", () => {
    const rand = rng(2600);
    for (let n = 0; n < 200; n++) {
      const junk = new Uint8Array(Math.floor(rand() * 2000)).map(() => Math.floor(rand() * 256));
      expect(readCartridgeFile(junk, TEMPLATES).result.ok).toBe(false);
    }
    const hostile = ['{"code":1}', '{"kit":1,"types":"x"}', "[]", "null", '{"__proto__":{"ok":true}}', '"'.repeat(3)];
    for (const kind of [undefined, "kit", "code", "future"]) {
      for (const project of hostile) {
        const zip = zipSync({
          "cartridge.json": strToU8(JSON.stringify({ format: "cartridge-studio", version: 1, kind })),
          "project.json": strToU8(project),
        });
        expect(readCartridgeFile(zip, TEMPLATES).result.ok).toBe(false);
      }
    }
  });

  it("refuses oversized files and entries, and ignores entries it doesn't know", () => {
    expect(readCartridgeFile(new Uint8Array(MAX_CARTRIDGE_BYTES + 1), TEMPLATES).result).toEqual({
      ok: false,
      errors: ["This file is too big to be a Cartridge Studio game file."],
    });
    // A project.json that unpacks to more than its limit is never read.
    const meta = strToU8(JSON.stringify({ format: "cartridge-studio", version: 1, kind: "code" }));
    const bomb = zipSync({ "cartridge.json": meta, "project.json": new Uint8Array(1600 * 1024).fill(32) }, { level: 9 });
    expect(bomb.length).toBeLessThan(MAX_CARTRIDGE_BYTES);
    expect(readCartridgeFile(bomb, TEMPLATES).result.ok).toBe(false);
    // Extra entries don't matter.
    const ok = zipSync({ "cartridge.json": meta, "project.json": strToU8(JSON.stringify(blankCodeProject())), "../../evil.sh": strToU8("rm -rf /") });
    expect(readCartridgeFile(ok, TEMPLATES).result).toEqual({ ok: true, code: blankCodeProject() });
  });
});
