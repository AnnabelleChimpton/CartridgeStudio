// Writes THIRD_PARTY_NOTICES.txt: every third-party component the app ships,
// with its version, where its source is and its licence text in full.
//
//   node scripts/third-party-notices.mjs          write the file
//   node scripts/third-party-notices.mjs --check  fail if the file is out of date
//
// Sources: package-lock.json for the npm packages bundled into the app (dev-only
// and optional packages are left out), toolchain/toolchain.lock.json and the
// fetched release for 7800basic and dasm (run `npm run setup` first), the
// vendored js7800 core's README and licences, and the fonts' OFL files.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8").replace(/\r\n/g, "\n").trimEnd();
const OUT = path.join(root, "THIRD_PARTY_NOTICES.txt");
const RULE = "=".repeat(78);

const sections = [];
const section = (title, lines, texts) => sections.push({ title, lines, texts });

// ---- The 7800basic toolchain, with dasm ----
const lock = JSON.parse(read("toolchain", "toolchain.lock.json"));
const release = path.join("toolchain", "vendor", `${lock.name}-${lock.version}`, "7800basic");
if (!fs.existsSync(path.join(root, release))) {
  console.error(`Missing ${release}. Run \`npm run setup\` first.`);
  process.exit(1);
}
section(
  `7800basic ${lock.version}`,
  [
    "By Mike Saarna (RevEng), derived from batari Basic by Fred Quimby.",
    "Includes sign7800 by Bruce Tomlin, zlib, libpng and LZSA (see its licence).",
    `Release: ${lock.url}`,
    `Source: https://github.com/7800-devtools/7800basic/tree/v${lock.version}`,
    "Licence: GNU GPL v2 (compiler); CC0 (6502 runtime and generated assembly);",
    "LGPL v2 (sign7800); zlib licence (LZSA). Games built with it belong to their creators.",
    "Shipped as the WebAssembly build from the release above, run unmodified.",
  ],
  [read(release, "LICENSE.txt")],
);
section(
  `dasm (as bundled with 7800basic ${lock.version})`,
  [
    "By the dasm team.",
    "Source: https://github.com/dasm-assembler/dasm",
    "Licence: GNU GPL v2.",
  ],
  [read(release, "dasm.LICENSE.txt")],
);

// ---- js7800 ----
const js7800Readme = read("app", "public", "vendor", "js7800-core", "README.md");
const commit = /Commit: `([0-9a-f]{40})`/.exec(js7800Readme)?.[1];
if (!commit) throw new Error("No commit in app/public/vendor/js7800-core/README.md");
section(
  `js7800 (commit ${commit.slice(0, 7)})`,
  [
    "By raz0red, based on the ProSystem emulator by Greg Stanton.",
    `Source: https://github.com/raz0red/js7800/tree/${commit}`,
    "Licence: GNU GPL v2 or later.",
    "Built from unmodified upstream source, with two worker-safe I/O stand-ins",
    "(app/js7800-core/audio-stub.js and mouse-stub.js) in place of web/audio.js",
    "and web/mouse.js.",
  ],
  [read("app", "public", "vendor", "js7800-core", "LICENSE"), read("app", "public", "vendor", "js7800-core", "LICENSE-third-party")],
);

// ---- Fonts ----
section(
  "Press Start 2P (font, used in printed box art)",
  ["By CodeMan38.", "Source: https://fonts.google.com/specimen/Press+Start+2P", "Licence: SIL Open Font License 1.1."],
  [read("app", "public", "fonts", "press-start-2p-OFL.txt")],
);
section(
  "Atkinson Hyperlegible (font, used in printed box art and manuals)",
  ["By the Braille Institute.", "Source: https://fonts.google.com/specimen/Atkinson+Hyperlegible", "Licence: SIL Open Font License 1.1."],
  [read("app", "public", "fonts", "atkinson-hyperlegible-OFL.txt")],
);

// ---- npm packages bundled into the app ----
const pkgLock = JSON.parse(read("package-lock.json"));
const LICENSE_FILE = /^(licen[cs]e|copying)(\b|[-._])/i;
const packages = Object.entries(pkgLock.packages)
  .filter(([key, p]) => key.includes("node_modules/") && !p.dev && !p.devOptional && !p.optional && !p.link)
  .map(([key, p]) => ({ name: key.slice(key.lastIndexOf("node_modules/") + "node_modules/".length), dir: key, ...p }))
  .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
for (const p of packages) {
  const dir = path.join(root, p.dir);
  if (!fs.existsSync(dir)) throw new Error(`${p.dir} isn't installed. Run \`npm ci\` first.`);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  const repo = typeof meta.repository === "string" ? meta.repository : meta.repository?.url;
  const files = fs.readdirSync(dir).filter((f) => LICENSE_FILE.test(f)).sort();
  section(
    `${p.name} ${p.version}`,
    [`Licence: ${p.license ?? meta.license ?? "see below"}`, ...(repo ? [`Source: ${repo.replace(/^git\+/, "")}`] : [])],
    files.length ? files.map((f) => read(p.dir, f)) : [`(No licence file in the package; its package.json says ${meta.license}.)`],
  );
}

const text =
  [
    "Cartridge Studio - third-party notices",
    "",
    "Cartridge Studio is free software under the GNU General Public License,",
    "version 3 or later (see LICENSE). It ships the components below, each under",
    "its own licence. The 7800basic toolchain, dasm and js7800 are separate GPL v2",
    "programs the app runs; their complete corresponding source is at the links given.",
    "",
    "Atari is a trademark of its owner. Cartridge Studio is not affiliated with",
    "or endorsed by Atari.",
    "",
    "This file is generated by scripts/third-party-notices.mjs; don't edit it by hand.",
    "",
    "Contents",
    ...sections.map((s) => `  - ${s.title}`),
    "",
    ...sections.flatMap((s) => [RULE, s.title, RULE, ...s.lines, "", ...s.texts.flatMap((t) => [t, ""])]),
  ].join("\n") + "\n";

if (process.argv.includes("--check")) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (current !== text) {
    console.error("THIRD_PARTY_NOTICES.txt is out of date. Run `npm run notices` and commit the result.");
    process.exit(1);
  }
  console.log(`THIRD_PARTY_NOTICES.txt is up to date (${sections.length} components).`);
} else {
  fs.writeFileSync(OUT, text);
  console.log(`Wrote THIRD_PARTY_NOTICES.txt (${sections.length} components, ${(text.length / 1024).toFixed(0)} KB).`);
}
