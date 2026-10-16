// Builds public/vendor/js7800-core/js7800-core.js: js7800's emulation core
// (src/js/prosystem/*) as one ES module the emulator worker loads at runtime,
// built from unmodified upstream source at the pinned commit, with two
// worker-safe I/O stand-ins: js7800's page-bound web/audio.js and web/mouse.js
// are swapped for the ones in js7800-core/.
//
//   node scripts/build-js7800.mjs <work-dir>
//
// <work-dir> is either empty (js7800 is cloned there) or holds a previous
// clone at the pinned commit.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const REPO = "https://github.com/raz0red/js7800.git";
const COMMIT = "fe918ce422bc130972c45510809f2caec4450efe";

const appDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const coreDir = path.join(appDir, "js7800-core");
const outDir = path.join(appDir, "public/vendor/js7800-core");

const work = process.argv[2];
if (!work) throw new Error("usage: node scripts/build-js7800.mjs <work-dir>");
fs.mkdirSync(work, { recursive: true });
const src = path.join(work, "js7800");

if (!fs.existsSync(src)) {
  if (fs.readdirSync(work).length) throw new Error(`${work} is neither empty nor a previous clone`);
  execFileSync("git", ["clone", "--quiet", REPO, src], { stdio: "inherit" });
}
execFileSync("git", ["checkout", "--quiet", COMMIT], { cwd: src, stdio: "inherit" });
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: src }).toString().trim();
if (head !== COMMIT) throw new Error(`Expected js7800 ${COMMIT}, found ${head}`);
const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: src }).toString().trim();
if (dirty) throw new Error(`The js7800 checkout has local changes:\n${dirty}`);

// js7800's own build step: generate the cartridge database module.
const dat = path.join(src, "src/js/prosystem/ProSystemDat.js");
if (!fs.existsSync(dat)) {
  fs.writeFileSync(dat, execFileSync("node", ["db/convert.js", "db/ProSystem.dat"], { cwd: src }));
}

await build({
  configFile: false,
  root: coreDir,
  publicDir: false,
  logLevel: "warn",
  resolve: { alias: { "@js7800": path.join(src, "src/js") } },
  plugins: [
    {
      name: "js7800-worker-stand-ins",
      enforce: "pre",
      resolveId(source, importer) {
        if (!importer) return null;
        if (source.endsWith("/web/audio.js")) return path.join(coreDir, "audio-stub.js");
        if (source.endsWith("/web/mouse.js")) return path.join(coreDir, "mouse-stub.js");
        return null;
      },
    },
    {
      // js7800's webpack config loads palettes with url-loader; do the same.
      name: "pal-data-url",
      load(id) {
        if (!id.endsWith(".pal")) return null;
        const b64 = fs.readFileSync(id).toString("base64");
        return `export default "data:application/octet-stream;base64,${b64}";`;
      },
    },
  ],
  build: {
    lib: { entry: path.join(coreDir, "entry.js"), formats: ["es"], fileName: () => "js7800-core.js" },
    outDir,
    emptyOutDir: true,
    minify: true,
    sourcemap: false,
    target: "es2020",
  },
});

for (const f of ["LICENSE", "LICENSE-third-party"]) fs.copyFileSync(path.join(src, f), path.join(outDir, f));
fs.writeFileSync(
  path.join(outDir, "README.md"),
  `# js7800 emulation core (worker build)

- Upstream: https://github.com/raz0red/js7800
- Commit: \`${COMMIT}\`
- License: GPL v2 or later (\`LICENSE\`, \`LICENSE-third-party\`)
- Contents: js7800's \`src/js/prosystem/*\` core plus its event and md5
  helpers, built from unmodified upstream source, with two worker-safe I/O
  stand-ins: \`web/audio.js\` and \`web/mouse.js\` are replaced at bundle time by
  \`app/js7800-core/audio-stub.js\` and \`mouse-stub.js\`. The entry module is
  \`app/js7800-core/entry.js\`.
- Rebuild: \`node app/scripts/build-js7800.mjs <work-dir>\`

The app loads this file only in its emulator worker
(\`app/src/emulator/emulator.worker.ts\`).
`,
);
const size = fs.statSync(path.join(outDir, "js7800-core.js")).size;
console.log(`js7800 core ${COMMIT.slice(0, 7)} -> ${path.relative(process.cwd(), outDir)} (${(size / 1024).toFixed(0)} KB)`);
