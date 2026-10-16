import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { serviceWorker } from "./pwa/vite-plugin.ts";

export default defineConfig({
  plugins: [react(), serviceWorker({ lazy: [/^assets\/pdf-.*\.js$/, /^fonts\//] })],
  worker: { format: "es" },
  server: { port: 5178, strictPort: true },
  preview: { port: 5178, strictPort: true },
  test: { include: ["src/**/*.test.ts"] },
});
