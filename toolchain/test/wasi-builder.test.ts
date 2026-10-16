// Runs the same WasiBuilder the browser worker uses, under Node, against the
// packed 7800basic release. Requires `npm run fetch -w toolchain` first.

import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import lock from "../toolchain.lock.json" with { type: "json" };
import { M0_SPRITES, WasiBuilder, encodeIndexedPng, readPack } from "../src/index.ts";

const root = path.dirname(import.meta.dirname);
const packPath = path.join(root, "vendor", `${lock.name}-${lock.version}.pack`);
const source = fs.readFileSync(path.join(root, "src/fixtures/m0-test.bas"), "utf8");
const files = Object.fromEntries(
  Object.entries(M0_SPRITES).map(([name, rows]) => [name, encodeIndexedPng(rows)]),
);

let builder: WasiBuilder;

beforeAll(async () => {
  builder = await WasiBuilder.create(readPack(fs.readFileSync(packPath)));
});

describe("WasiBuilder", () => {
  it("builds the M0 test program into a signed 32 KB ROM and an .a78", async () => {
    const result = await builder.build({ source, files });
    if (!result.ok) throw new Error(`${result.stage}: ${result.message}\n${result.log}`);

    expect(result.bin.length).toBe(32 * 1024);
    expect(result.a78.length).toBe(128 + 32 * 1024);
    // A78 header: version byte, then the fixed 16-byte magic text.
    expect(new TextDecoder().decode(result.a78.subarray(1, 10))).toBe("ATARI7800");
    // The ROM body inside the .a78 is the signed .bin.
    expect(result.a78.subarray(128)).toEqual(result.bin);
    // 7800sign writes a non-empty signature at the start of the last 4 KB bank's hash area.
    expect(result.log).toContain("Wrote back");
    expect(result.symbols).toMatch(/playerx/);

    console.log(
      `build ${result.totalMs.toFixed(0)} ms: ` +
        result.timings.map((t) => `${t.stage} ${t.ms.toFixed(0)}`).join(", "),
    );
  });

  it("is deterministic", async () => {
    const a = await builder.build({ source, files });
    const b = await builder.build({ source, files });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.a78).toEqual(b.a78);
  });

  it("builds with the optimizer enabled", async () => {
    const result = await builder.build({ source, files, optimize: true });
    expect(result.ok).toBe(true);
  });

  it("reports compile errors with the failing stage", async () => {
    const result = await builder.build({ source: " plotsprite nosuchsprite 0 0 0\n", files });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(["7800basic", "dasm"]).toContain(result.stage);
  });
});

describe("signing", () => {
  it("can skip signing; the unsigned ROM differs only in the signature", async () => {
    const signed = await builder.build({ source, files });
    const unsigned = await builder.build({ source, files, sign: false });
    if (!signed.ok || !unsigned.ok) throw new Error("build failed");
    expect(signed.signed).toBe(true);
    expect(unsigned.signed).toBe(false);
    expect(unsigned.log).not.toContain("Wrote back");
    expect(unsigned.timings.map((t) => t.stage)).not.toContain("7800sign");

    // 7800sign writes 120 bytes of signature into the last bank; nothing else changes.
    let differing = 0;
    for (let i = 0; i < signed.bin.length; i++) if (signed.bin[i] !== unsigned.bin[i]) differing++;
    expect(differing).toBeGreaterThan(0);
    expect(differing).toBeLessThanOrEqual(120);
    expect(unsigned.a78.subarray(128)).toEqual(unsigned.bin);
  });
});
