// Offline: one visit caches the whole app, then with the network gone it still
// loads, runs the 7800basic toolchain, plays the game and saves the ROM.

import { expect, test, type Page } from "@playwright/test";
import { autosaved } from "./wait.ts";

/** Opens the start screen and waits for the service worker to take over. */
async function firstVisit(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^Yarn Hunt/ })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect(page.getByTestId("offline-status")).toHaveText("Works offline", { timeout: 30_000 });
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

const cachedPaths = (page: Page) =>
  page.evaluate(async () => {
    const names = await caches.keys();
    const cache = await caches.open(names.find((n) => n.startsWith("cartridge-studio-"))!);
    return (await cache.keys()).map((r) => new URL(r.url).pathname);
  });

test("the first visit caches the toolchain, emulator and audio; print extras wait for first use", async ({ page }) => {
  await firstVisit(page);
  const cached = await cachedPaths(page);
  for (const re of [/^\/$/, /^\/toolchain\/.+\.pack$/, /^\/vendor\/js7800-core\/js7800-core\.js$/, /^\/audio\//, /^\/assets\/build\.worker-/]) {
    expect(cached.some((p) => re.test(p)), String(re)).toBe(true);
  }
  expect(cached.filter((p) => /^\/fonts\/|^\/assets\/pdf-/.test(p))).toEqual([]);

  await page.evaluate(() => fetch("/fonts/atkinson-hyperlegible-bold.ttf").then((r) => r.arrayBuffer()));
  expect(await cachedPaths(page)).toContain("/fonts/atkinson-hyperlegible-bold.ttf");
});

test("after one visit the app builds and saves a ROM offline", async ({ page, context, browserName }) => {
  test.skip(browserName === "webkit", "Playwright's WebKit fails offline navigations before the service worker answers");

  // Only the start screen online: the page never fetches the toolchain or the
  // emulator core, so everything below must come from the service worker.
  await firstVisit(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId("offline-status")).toHaveText("Offline: everything still works");

  await page.getByRole("button", { name: /^Yarn Hunt/ }).click();
  await expect(page.getByTestId("build-status")).toContainText("Built in", { timeout: 30_000 });
  const build = await page.evaluate(() => {
    const b = window.__cs!.last!;
    return b.kind === "built" ? { cached: b.cached, a78: b.a78.length } : { kind: b.kind };
  });
  expect(build).toEqual({ cached: false, a78: expect.any(Number) as number });

  // The emulator runs too.
  await expect
    .poll(() => page.evaluate(() => window.__cs!.emulator?.framebufferHash() ?? null), { timeout: 15_000 })
    .not.toBeNull();

  // The signed ROM, from Show it's console guide.
  await page.getByRole("region", { name: "Show it" }).getByRole("button", { name: /^Put it on a cart/ }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("dialog", { name: "Put it on a cart" }).getByRole("button", { name: /\.a78/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.a78$/);
  const chunks: Buffer[] = [];
  for await (const c of await download.createReadStream()) chunks.push(c as Buffer);
  expect(Buffer.concat(chunks).subarray(1, 10).toString("latin1")).toBe("ATARI7800");

  await page.keyboard.press("Escape");

  // The game autosaved to IndexedDB and comes back on an offline reload.
  await page.getByLabel("Game title").fill("Offline Hunt");
  await autosaved(page, "Offline Hunt");
  await page.reload();
  await expect(page.getByLabel("Game title")).toHaveValue("Offline Hunt", { timeout: 30_000 });
});

test("a new version offers a reload", async ({ page }) => {
  await firstVisit(page);
  const prompt = page.getByRole("status").getByText("A new version is ready");
  await expect(prompt).toHaveCount(0);

  // A new script URL installs a new worker, just as a new build would.
  await page.evaluate(() => navigator.serviceWorker.register("/sw.js?next").then(() => undefined));
  await expect(prompt).toBeVisible({ timeout: 30_000 });

  await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reload" }).click()]);
  await expect(page.getByTestId("offline-status")).toHaveText("Works offline");
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toMatch(/\/sw\.js\?next$/);
  await expect(prompt).toHaveCount(0);
});
