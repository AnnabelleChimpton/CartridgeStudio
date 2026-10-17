// Vitest config for scripts/make-site.test.ts, kept out of the normal suite.
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["scripts/make-site.test.ts"], testTimeout: 10 * 60_000 } });
