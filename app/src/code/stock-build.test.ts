// The exported source folder builds unchanged with stock 7800basic: its own
// build.sh runs the release's 7800basic.sh, as a coder would. The release
// runs its tools under wasmtime; here a few lines of Node's WASI stand in for
// wasmtime, so the test needs nothing installed. The ROM must match ours.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { kitSourceFiles, sourceFiles } from "../files/exports.ts";
import { nodeBuilder } from "../harness/node.ts";
import { KIT_PRESETS } from "../kit/presets.ts";
import { SOUND_LIBRARY, getTemplate } from "../project/templates.ts";
import { codeSourceFiles } from "./code-files.ts";
import { blankCodeProject } from "./eject.ts";

const BAS_DIR = path.resolve(import.meta.dirname, "../../../toolchain/vendor/7800basic-0.41/7800basic");

/** `wasmtime [run] [--dir=X]… tool.wasm args…`, which is all 7800basic.sh asks of it. */
const SHIM = `const { WASI } = require("node:wasi");
const fs = require("node:fs");
let args = process.argv.slice(2);
if (args[0] === "--version") { console.log("wasmtime (node wasi stand-in)"); process.exit(0); }
if (args[0] === "run") args = args.slice(1);
const preopens = {};
while (args[0] && args[0].startsWith("--dir=")) { const d = args.shift().slice(6); preopens[d] = d; }
const [file, ...rest] = args;
const wasi = new WASI({ version: "preview1", args: [file, ...rest], env: {}, preopens, returnOnExit: true });
const instance = new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(file)), wasi.getImportObject());
process.exitCode = wasi.start(instance);
`;

function stockBuild(files: Record<string, Uint8Array>): { bin: Buffer; a78: Buffer; log: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cs-stock-"));
  const shims = path.join(root, "shims");
  const folder = path.join(root, "game");
  fs.mkdirSync(shims);
  fs.mkdirSync(folder);
  fs.writeFileSync(path.join(shims, "wasmtime.cjs"), SHIM);
  fs.writeFileSync(path.join(shims, "wasmtime"), `#!/bin/sh\nexec "${process.execPath}" --no-warnings "${shims}/wasmtime.cjs" "$@"\n`, { mode: 0o755 });
  for (const [name, data] of Object.entries(files)) fs.writeFileSync(path.join(folder, name), data);
  try {
    const log = execFileSync("sh", ["build.sh"], {
      cwd: folder,
      env: { ...process.env, PATH: `${shims}:${process.env.PATH}`, bas7800dir: BAS_DIR },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { bin: fs.readFileSync(path.join(folder, "game.bas.bin")), a78: fs.readFileSync(path.join(folder, "game.bas.a78")), log };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

/** What Cartridge Studio builds from the same folder (signed, as downloads are). */
async function ours(files: Record<string, Uint8Array>) {
  const builder = await nodeBuilder();
  const pngs = Object.fromEntries(Object.entries(files).filter(([n]) => n.endsWith(".png")));
  const r = await builder.build({ source: new TextDecoder().decode(files["game.bas"]), files: pngs, sign: true });
  if (!r.ok) throw new Error(r.log);
  return r;
}

describe.skipIf(!fs.existsSync(BAS_DIR))("the exported folder with stock 7800basic", () => {
  it("builds a kit game to the same ROM", async () => {
    const files = kitSourceFiles(structuredClone(KIT_PRESETS.find((p) => p.id === "ghost-panic")!.game), SOUND_LIBRARY);
    const stock = stockBuild(files);
    expect(stock.log).toContain("bytes of ROM space left");
    expect(stock.bin.equals(Buffer.from((await ours(files)).bin))).toBe(true);
    expect(stock.a78.subarray(1, 10).toString("latin1")).toBe("ATARI7800");
  }, 60_000);

  it("builds a template game and a code project", async () => {
    const t = getTemplate("fixed-shooter");
    for (const files of [sourceFiles(structuredClone(t.sample), t), codeSourceFiles(blankCodeProject())]) {
      expect(stockBuild(files).bin.equals(Buffer.from((await ours(files)).bin))).toBe(true);
    }
  }, 60_000);
});
