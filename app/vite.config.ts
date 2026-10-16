import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** The app's version and commit, stamped into packages and jam entries (src/version.ts). */
function appVersion(): string {
  const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };
  try {
    return `${pkg.version}+${execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim()}`;
  } catch {
    return pkg.version;
  }
}

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  build: { rollupOptions: { input: { main: "index.html", organize: "organize.html" } } },
  worker: { format: "es" },
  server: { port: 5178, strictPort: true },
  preview: { port: 5178, strictPort: true },
  test: { include: ["src/**/*.test.ts"] },
});
