// Rebuilds public/vendor/js7800/js7800.min.js from the pinned upstream commit,
// unmodified, using js7800's own build steps (dbConvert + webpack).
//
//   node scripts/build-js7800.mjs <empty-work-dir>

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "https://github.com/raz0red/js7800.git";
const COMMIT = "fe918ce422bc130972c45510809f2caec4450efe";

const appDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const work = process.argv[2];
if (!work) throw new Error("usage: node scripts/build-js7800.mjs <empty-work-dir>");
fs.mkdirSync(work, { recursive: true });
if (fs.readdirSync(work).length) throw new Error(`${work} is not empty`);

const src = path.join(work, "js7800");
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: "inherit", ...opts });

run("git", ["clone", "--quiet", REPO, src]);
run("git", ["checkout", "--quiet", COMMIT], { cwd: src });
run("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: src });
fs.writeFileSync(
  path.join(src, "src/js/prosystem/ProSystemDat.js"),
  execFileSync("node", ["db/convert.js", "db/ProSystem.dat"], { cwd: src }),
);
// webpack 4 needs the legacy OpenSSL provider on current Node.
run("npx", ["webpack", "--mode=production"], {
  cwd: src,
  env: { ...process.env, NODE_OPTIONS: "--openssl-legacy-provider" },
});

const out = path.join(appDir, "public/vendor/js7800");
for (const f of ["dist/js7800.min.js", "LICENSE", "LICENSE-third-party"]) {
  fs.copyFileSync(path.join(src, f), path.join(out, path.basename(f)));
}
console.log(`js7800 ${COMMIT} -> ${path.relative(process.cwd(), out)}`);
