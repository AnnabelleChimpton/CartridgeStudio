import { defineConfig } from "vitest/config";

// Emulator tests outside the app's own suite. Each MAME run is a separate
// process, so the per-test timeout is generous.
export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ["**/*.test.ts"],
    testTimeout: 180_000,
    hookTimeout: 60_000,
  },
});
