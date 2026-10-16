import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  worker: { format: "es" },
  server: { port: 5178, strictPort: true },
  preview: { port: 5178, strictPort: true },
  test: { include: ["src/**/*.test.ts"] },
});
