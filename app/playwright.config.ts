import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5179",
    // Tests drive the full editor: Maker mode. First visits get Starter; shell.spec.ts covers it.
    storageState: { cookies: [], origins: [{ origin: "http://localhost:5179", localStorage: [{ name: "cs-tier", value: "maker" }] }] },
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
    command: "npm run build && npx vite preview --port 5179",
    url: "http://localhost:5179",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
