// Downloads the pinned 7800basic WebAssembly release, verifies its hash and
// packs the tools, include directory and license files into one archive
// (toolchain/vendor/7800basic-<version>.pack) that the build worker fetches once.
//
// The upstream files are copied byte for byte; nothing is modified.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lock = JSON.parse(fs.readFileSync(path.join(root, "toolchain.lock.json"), "utf8"));
const vendor = path.join(root, "vendor");
const tarball = path.join(vendor, path.basename(new URL(lock.url).pathname));
const extractDir = path.join(vendor, `${lock.name}-${lock.version}`);
const packFile = path.join(vendor, `${lock.name}-${lock.version}.pack`);

fs.mkdirSync(vendor, { recursive: true });

if (!fs.existsSync(tarball)) {
  console.log(`Downloading ${lock.url}`);
  const res = await fetch(lock.url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  fs.writeFileSync(tarball, Buffer.from(await res.arrayBuffer()));
}

const digest = createHash("sha256").update(fs.readFileSync(tarball)).digest("hex");
if (digest !== lock.sha256) {
  fs.rmSync(tarball);
  throw new Error(`SHA-256 mismatch for ${tarball}: got ${digest}, expected ${lock.sha256}`);
}

// Extract into a fresh, empty directory.
fs.rmSync(extractDir, { recursive: true, force: true });
fs.mkdirSync(extractDir);
execFileSync("tar", ["-xzf", tarball, "-C", extractDir]);
const dist = path.join(extractDir, "7800basic");

/** @type {{ path: string, data: Buffer }[]} */
const entries = [];
for (const tool of lock.tools) {
  entries.push({ path: `${tool}.wasm`, data: fs.readFileSync(path.join(dist, `${tool}.wasm`)) });
}
for (const name of fs.readdirSync(path.join(dist, "includes")).sort()) {
  const full = path.join(dist, "includes", name);
  if (fs.statSync(full).isFile()) {
    entries.push({ path: `includes/${name}`, data: fs.readFileSync(full) });
  }
}
for (const name of lock.licenses) {
  entries.push({ path: name, data: fs.readFileSync(path.join(dist, name)) });
}

// Pack format (read by toolchain/src/pack.ts):
//   8 bytes  magic "CSPACK01"
//   4 bytes  little-endian length of the JSON header
//   N bytes  JSON header { name, version, sha256, files: [{ path, offset, size }] }
//   ...      file data, offsets relative to the end of the header
let offset = 0;
const files = entries.map((e) => {
  const f = { path: e.path, offset, size: e.data.length };
  offset += e.data.length;
  return f;
});
const header = Buffer.from(
  JSON.stringify({ name: lock.name, version: lock.version, sha256: lock.sha256, files }),
);
const len = Buffer.alloc(4);
len.writeUInt32LE(header.length);
fs.writeFileSync(
  packFile,
  Buffer.concat([Buffer.from("CSPACK01"), len, header, ...entries.map((e) => e.data)]),
);

console.log(
  `Packed ${entries.length} files (${(fs.statSync(packFile).size / 1024).toFixed(0)} KB) -> ${path.relative(process.cwd(), packFile)}`,
);
