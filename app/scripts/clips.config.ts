import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["scripts/make-clips.test.ts"], testTimeout: 20 * 60_000 } });
