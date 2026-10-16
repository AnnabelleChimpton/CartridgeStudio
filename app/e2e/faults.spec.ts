// Worker faults fail clearly: a build that throws says so at once (not as a
// timeout), and an emulator whose loop throws offers "Restart the preview".

import { expect, test, type Page } from "@playwright/test";

async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /^Cat vs\. Vacuums/ }).click();
  await expect(page.getByTestId("build-status")).toContainText("Up to date", { timeout: 30_000 });
}

/** Resolves with the next frame number the current emulator draws (or null after 5 s). */
const nextFrame = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number | null>((resolve) => {
        const off = window.__cs!.emulator!.onFrame((f) => {
          off();
          resolve(f);
        });
        setTimeout(() => {
          off();
          resolve(null);
        }, 5000);
      }),
  );

test("a build that throws in the worker reports a fault, not a timeout", async ({ page }) => {
  await start(page);
  const r = await page.evaluate(async () => {
    const s = window.__cs!.createService!({ timeoutMs: 60_000 });
    try {
      await s.ready;
      const t0 = performance.now();
      // Not a game at all: the generator throws inside the worker.
      const result = await s.build(null as never, { sign: false });
      return { ...result, wallMs: performance.now() - t0 };
    } finally {
      s.dispose();
    }
  });
  expect(r).toMatchObject({ kind: "failed", stage: "worker" });
  expect(r.kind === "failed" && r.message).toMatch(/^Internal error in the build worker: /);
  expect(r.wallMs).toBeLessThan(10_000);
});

test("an emulator fault offers a restart that brings the game back", async ({ page }) => {
  await start(page);
  expect(await nextFrame(page)).not.toBeNull();

  await page.evaluate(() => window.__cs!.emulator!.injectFault());
  const alert = page.getByTestId("emu-fault");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("The game preview stopped. Your game is saved.");
  // The raw error is one click away.
  await alert.getByText("Details").click();
  await expect(alert.locator("pre")).toContainText("Injected fault");
  expect(await nextFrame(page)).toBeNull();

  await alert.getByRole("button", { name: "Restart the preview" }).click();
  await expect(alert).toBeHidden();
  expect(await nextFrame(page)).not.toBeNull();
  // The new canvas is the game's, and keyboard play still reaches it.
  await expect(page.getByRole("application", { name: "Game preview" })).toHaveCount(1);
});
