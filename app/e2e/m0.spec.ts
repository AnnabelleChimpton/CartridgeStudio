// M0 gate checks: the test program compiles to .a78/.bin in the browser, the
// ROM runs in js7800, and the build time is measured (and logged) with and
// without CPU throttling as a stand-in for a mid-range laptop.

import { expect, test, type Page } from "@playwright/test";

interface BuildRecord {
  ok: boolean;
  wallMs: number;
  workerMs: number;
  stages: string;
}

async function firstBuild(page: Page, url = "/") {
  await page.goto(url);
  await expect(page.getByTestId("last-build")).toContainText("ok", { timeout: 30_000 });
}

const lastBuild = (page: Page) => page.evaluate(() => window.__m0!.builds[0] as BuildRecord);

test("builds the test ROM in the browser and runs it in js7800", async ({ page }) => {
  await firstBuild(page);
  const build = await lastBuild(page);
  console.log(`first build: wall ${build.wallMs.toFixed(1)} ms (${build.stages})`);
  expect(build.wallMs).toBeLessThan(2000);

  const result = await page.evaluate(async () => {
    const m = window.__m0!;
    const e = m.emulator!;
    const last = m.last!;
    const pixel = () => {
      const c = document.querySelector<HTMLCanvasElement>("#js7800__screen")!;
      return Array.from(c.getContext("2d")!.getImageData(5, 120, 1, 1).data.slice(0, 3));
    };
    const before = await e.framebufferHash();
    await e.stepFrames(30);
    const after = await e.framebufferHash();

    const idle = { up: false, down: false, left: false, right: false };
    const bg = pixel();
    e.setInput({ ...idle, fire: true });
    await e.stepFrames(10);
    const bgFire = pixel();
    e.setInput({ ...idle, fire: false });
    await e.stepFrames(10);

    return {
      ok: last.ok,
      a78: last.ok ? last.a78.length : 0,
      bin: last.ok ? last.bin.length : 0,
      animates: before !== after,
      bg,
      bgFire,
      bgAfter: pixel(),
    };
  });

  expect(result.ok).toBe(true);
  expect(result.a78).toBe(128 + 32768);
  expect(result.bin).toBe(32768);
  expect(result.animates).toBe(true); // the enemy bounces on its own
  expect(result.bgFire).not.toEqual(result.bg); // fire recolors the background
  expect(result.bgAfter).toEqual(result.bg);
});

test("keys typed in the source editor do not reach the game", async ({ page }) => {
  await firstBuild(page);
  const editor = page.getByLabel("7800basic source");
  await editor.click();
  await editor.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(el.value.length, el.value.length));
  await page.keyboard.type(" rem zx");
  await expect(editor).toHaveValue(/ rem zx$/);

  // Holding Space in the editor types a space and must not press fire.
  const pixel = () =>
    page.evaluate(async () => {
      await window.__m0!.emulator!.stepFrames(10);
      const c = document.querySelector<HTMLCanvasElement>("#js7800__screen")!;
      return Array.from(c.getContext("2d")!.getImageData(5, 120, 1, 1).data.slice(0, 3));
    });
  const bg = await pixel();
  await page.keyboard.down("Space");
  expect(await pixel()).toEqual(bg);
  await page.keyboard.up("Space");
  await expect(editor).toHaveValue(/ rem zx $/);
});

// CPU throttling only slows the page's main thread, not dedicated workers, so
// the throttled runs build on the main thread (`?builder=inline`). Real builds
// always run in the worker.
for (const rate of [1, 4, 6]) {
  test(`build time with ${rate}x CPU throttling`, async ({ page, context, browserName }) => {
    // The 1x run needs no CDP, so it measures warm builds in every engine.
    if (rate !== 1) {
      test.skip(browserName !== "chromium", "CPU throttling uses CDP, which is Chromium-only");
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    }

    const t0 = Date.now();
    await firstBuild(page, rate === 1 ? "/" : "/?builder=inline");
    const coldMs = Date.now() - t0;
    const ready = await page.evaluate(() => window.__m0!.ready!);
    const first = await lastBuild(page);

    const walls: number[] = [];
    const workers: number[] = [];
    for (let i = 0; i < 10; i++) {
      await page.getByRole("button", { name: "Build & run" }).click();
      await expect
        .poll(() => page.evaluate(() => window.__m0!.builds.length), { timeout: 30_000 })
        .toBe(i + 2);
      const b = await lastBuild(page);
      expect(b.ok).toBe(true);
      walls.push(b.wallMs);
      workers.push(b.workerMs);
    }
    walls.sort((a, b) => a - b);
    workers.sort((a, b) => a - b);
    const median = (xs: number[]) => (xs[4]! + xs[5]!) / 2;

    console.log(
      `[${test.info().project.name} ${rate}x${rate === 1 ? ", worker" : ", main thread"}] page load to first ROM ${coldMs} ms · toolchain ready ${ready.totalMs.toFixed(0)} ms · ` +
        `first build ${first.wallMs.toFixed(0)} ms · warm builds: median ${median(walls).toFixed(0)} ms wall ` +
        `(${median(workers).toFixed(0)} ms in builder), max ${walls[9]!.toFixed(0)} ms`,
    );
    expect(median(walls)).toBeLessThan(2000);
  });
}
