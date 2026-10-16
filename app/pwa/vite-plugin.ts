/// <reference types="node" />
// Writes dist/sw.js after a production build: pwa/sw.js with the list of every
// file in dist/ (the app shell plus public/: toolchain, js7800 core, audio
// worklet, fonts, icons) and a version hashed from their contents, so each
// build gets its own cache and an unchanged build keeps the old one.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Plugin, ResolvedConfig } from "vite";

const SW_SOURCE = new URL("./sw.js", import.meta.url);
const SKIP = [/^sw\.js$/, /\.map$/, /(^|\/)\.DS_Store$/];

function listFiles(dir: string, base = dir): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(full, base) : [path.relative(base, full).split(path.sep).join("/")];
  });
}

export function serviceWorker(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "cartridge-studio-service-worker",
    apply: "build",
    configResolved(c) {
      config = c;
    },
    closeBundle: {
      order: "post",
      handler() {
        const outDir = path.resolve(config.root, config.build.outDir);
        const files = listFiles(outDir)
          .filter((f) => !SKIP.some((re) => re.test(f)))
          .sort();
        const hash = createHash("sha256");
        for (const f of files) hash.update(f).update("\0").update(fs.readFileSync(path.join(outDir, f)));
        const source = fs.readFileSync(SW_SOURCE, "utf8");
        hash.update(source);
        const version = hash.digest("hex").slice(0, 12);
        // Paths are relative to sw.js, which sits at the base URL.
        const precache = ["./", ...files.map((f) => `./${f}`)];
        const sw = source
          .replace('"__CS_VERSION__"', JSON.stringify(version))
          .replace("/* __CS_PRECACHE__ */ []", JSON.stringify(precache, null, 1));
        fs.writeFileSync(path.join(outDir, "sw.js"), sw);
        config.logger.info(`sw.js: ${files.length} files precached, version ${version}`);
      },
    },
  };
}
