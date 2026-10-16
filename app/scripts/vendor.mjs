// Copies the packed 7800basic toolchain (built by `npm run fetch -w toolchain`)
// into public/toolchain so the build worker can fetch it, along with its
// license files so they are served next to it, and the app's LICENSE and
// THIRD_PARTY_NOTICES.txt into public/legal.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toolchainDir = path.join(appDir, "../toolchain");
const lock = JSON.parse(fs.readFileSync(path.join(toolchainDir, "toolchain.lock.json"), "utf8"));
const id = `${lock.name}-${lock.version}`;
const pack = path.join(toolchainDir, "vendor", `${id}.pack`);

if (!fs.existsSync(pack)) {
  console.error(`Missing ${pack}. Run \`npm run fetch -w toolchain\` first.`);
  process.exit(1);
}

const out = path.join(appDir, "public/toolchain");
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(pack, path.join(out, `${id}.pack`));
for (const name of lock.licenses) {
  fs.copyFileSync(
    path.join(toolchainDir, "vendor", id, "7800basic", name),
    path.join(out, `${id}-${name}`),
  );
}
// The app's own licence and the third-party notices, for the About dialog.
const legal = path.join(appDir, "public/legal");
fs.mkdirSync(legal, { recursive: true });
fs.copyFileSync(path.join(appDir, "../LICENSE"), path.join(legal, "LICENSE.txt"));
fs.copyFileSync(path.join(appDir, "../THIRD_PARTY_NOTICES.txt"), path.join(legal, "THIRD_PARTY_NOTICES.txt"));
console.log(`Vendored ${id}.pack`);
