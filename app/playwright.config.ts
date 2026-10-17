import { defineConfig, devices } from "@playwright/test";

// Its own port (strict), so test runs in other worktrees can't answer for this one.
const PORT = Number(process.env.E2E_PORT ?? 5217);

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Tests drive the full editor: 7800basic mode shows every tab. First visits get Kit; shell.spec.ts covers it.
    storageState: { cookies: [], origins: [{ origin: `http://localhost:${PORT}`, localStorage: [{ name: "cs-tier", value: "7800basic" }] }] },
  },
  projects: [
    {
      name: "chromium",
      // Locally use the installed Chrome; CI installs Playwright's Chromium.
      use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome" },
    },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    // Test the production build, not the dev server.
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
