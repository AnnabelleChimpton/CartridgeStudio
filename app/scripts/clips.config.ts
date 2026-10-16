// Vitest config for scripts/make-clips.test.ts, kept out of the normal suite.
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["scripts/make-clips.test.ts"], testTimeout: 20 * 60_000 } });
