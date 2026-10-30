import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["scripts/make-site.test.ts"], testTimeout: 10 * 60_000 } });
