// M1 core loop: the sample project builds into a ROM that plays in the
// preview, and every edit rebuilds and reloads it.

import { expect, test, type Page } from "@playwright/test";

interface BuildRecord {
  n: number;
  kind: string;
  cached: boolean;
  wallMs: number;
  generateMs: number;
  buildMs: number;
}

async function open(page: Page, url = "/") {
  await page.goto(url);
  await expect(page.getByTestId("build-status")).toContainText("Up to date", { timeout: 30_000 });
}

const buildCount = (page: Page) => page.evaluate(() => window.__cs!.builds.length);

/** Waits for build number `n` and returns its record. */
async function waitForBuild(page: Page, n: number): Promise<BuildRecord> {
  await expect.poll(() => buildCount(page), { timeout: 30_000 }).toBeGreaterThanOrEqual(n);
  await expect(page.getByTestId("build-status")).not.toHaveText("Building…");
  return page.evaluate(() => window.__cs!.builds[0] as BuildRecord);
}

/** Lit pixels in a region of the 320×240 picture (game line 0 is about y=25). */
const litPixels = (page: Page, x: number, y: number, w: number, h: number, pred = "r+g+b>60") =>
  page.evaluate(
    async ({ x, y, w, h, pred }) => {
      const d = await window.__cs!.emulator!.readPixels(x, y, w, h);
      const test = new Function("r", "g", "b", `return ${pred}`) as (r: number, g: number, b: number) => boolean;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (test(d[i]!, d[i + 1]!, d[i + 2]!)) n++;
      return n;
    },
    { x, y, w, h, pred },
  );

/** A canvas region's pixels as a string, for comparing. */
const regionPixels = (page: Page, x: number, y: number, w: number, h: number) =>
  page.evaluate(
    async ({ x, y, w, h }) => Array.from(await window.__cs!.emulator!.readPixels(x, y, w, h)).join(","),
    { x, y, w, h },
  );

test("the sample game builds and plays", async ({ page }) => {
  await open(page);
  const rom = await page.evaluate(() => {
    const last = window.__cs!.last!;
    return last.kind === "built" ? { a78: last.a78.length, bin: last.bin.length } : null;
  });
  expect(rom).toEqual({ a78: 128 + 32768, bin: 32768 });

  const animates = await page.evaluate(async () => {
    const e = window.__cs!.emulator!;
    const a = await e.framebufferHash();
    await e.stepFrames(20);
    return a !== (await e.framebufferHash());
  });
  expect(animates).toBe(true);

  // Tap fire for a few seconds; enemies drift over the ship, so a shot lands
  // and the score digits change. (Compare pixels, not counts: in this font
  // "6" and "0" light the same number of pixels.)
  const scoreBefore = await regionPixels(page, 0, 28, 70, 16);
  await page.evaluate(async () => {
    const e = window.__cs!.emulator!;
    const idle = { up: false, down: false, left: false, right: false, fire: false };
    for (let i = 0; i < 25; i++) {
      e.setInput({ ...idle, fire: true });
      await e.stepFrames(2);
      e.setInput(idle);
      await e.stepFrames(10);
    }
  });
  expect(await regionPixels(page, 0, 28, 70, 16)).not.toBe(scoreBefore);
});

test("changing a color rebuilds the preview, and undo is a cache hit", async ({ page }) => {
  await open(page);
  const n = await buildCount(page);
  const green = "g>r+40 && g>b+40";
  expect(await litPixels(page, 0, 40, 320, 80, green)).toBe(0);

  await page.getByRole("button", { name: "Enemy Color 1: $96" }).click();
  await page.getByRole("option", { name: "$C8" }).click();
  const edited = await waitForBuild(page, n + 1);
  expect(edited.kind).toBe("built");
  await expect.poll(() => litPixels(page, 0, 40, 320, 80, green)).toBeGreaterThan(50);

  await page.getByRole("button", { name: "Undo" }).click();
  const undone = await waitForBuild(page, n + 2);
  expect(undone.cached).toBe(true);
  await expect.poll(() => litPixels(page, 0, 40, 320, 80, green)).toBe(0);
});

test("rules edit the generated code", async ({ page }) => {
  await open(page);
  const n = await buildCount(page);
  await page.getByRole("button", { name: "Add rule" }).click();
  await page.getByLabel("Rule 5 trigger").selectOption({ label: "A shot hits an enemy" });
  await page.getByLabel("Rule 5 action 1").selectOption({ label: "Lose a life" });
  await waitForBuild(page, n + 1);
  await page.getByText("View code").click();
  await expect(page.getByTestId("game-bas")).toContainText("rem rule 5: shot.hits.enemy -> lives.lose");

  await page.getByRole("button", { name: "Delete rule 5" }).click();
  await waitForBuild(page, n + 2);
  await expect(page.getByTestId("game-bas")).not.toContainText("rem rule 5");
});

test("the project survives a reload", async ({ page }) => {
  await open(page);
  const title = page.getByLabel("Game title");
  await title.fill("Moth Patrol");
  await page.getByLabel("Lives").fill("7");
  await page.waitForTimeout(800); // autosave debounce
  await open(page);
  await expect(page.getByLabel("Game title")).toHaveValue("Moth Patrol");
  await expect(page.getByLabel("Lives")).toHaveValue("7");
});

test("a newer build cancels an older one, and a hung build times out", async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const cs = window.__cs!;
    const p1 = structuredClone(cs.store.getState().project);
    const p2 = structuredClone(p1);
    p1.params.lives = 4;
    p2.params.lives = 5;
    const [a, b] = await Promise.all([cs.service!.build(p1), cs.service!.build(p2)]);
    const quick = cs.createService!({ timeoutMs: 1 });
    const t = await quick.build(p1);
    quick.dispose();
    const after = await cs.service!.build(p1);
    return {
      a: a.kind,
      b: b.kind,
      bLives: b.kind === "built" ? /STARTLIVES = (\d)/.exec(b.source)?.[1] : null,
      timeout: t.kind === "failed" ? t.stage : t.kind,
      after: after.kind,
    };
  });
  expect(result).toEqual({ a: "cancelled", b: "built", bLives: "5", timeout: "timeout", after: "built" });
});

// CPU throttling slows the page's main thread but not dedicated workers, so
// the throttled runs build on the main thread (`?builder=inline`).
for (const rate of [1, 4, 6]) {
  test(`build time with ${rate}x CPU throttling`, async ({ page, context, browserName }) => {
    if (rate !== 1) {
      test.skip(browserName !== "chromium", "CPU throttling uses CDP, which is Chromium-only");
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    }
    const t0 = Date.now();
    await open(page, rate === 1 ? "/" : "/?builder=inline");
    const coldMs = Date.now() - t0;

    // Each step is a new bombRate, so none of these builds hits the cache.
    const walls: number[] = [];
    for (let i = 0; i < 8; i++) {
      const n = await buildCount(page);
      await page.evaluate((v) => window.__cs!.store.getState().edit((d) => void (d.params.bombRate = v)), 10 + i);
      const b = await waitForBuild(page, n + 1);
      expect(b.kind).toBe("built");
      expect(b.cached).toBe(false);
      walls.push(b.wallMs);
    }
    walls.sort((a, b) => a - b);
    const median = (walls[3]! + walls[4]!) / 2;
    console.log(
      `[${browserName} ${rate}x${rate === 1 ? " worker" : " main thread"}] page load to first ROM ${coldMs} ms · ` +
        `edit to ROM (after debounce): median ${median.toFixed(0)} ms, max ${walls[7]!.toFixed(0)} ms`,
    );
    expect(median).toBeLessThan(2000);
  });
}

test("drawing a sprite changes the running game (M1 gate)", async ({ page }) => {
  await open(page);
  const enemyFrames = () =>
    page.evaluate(() => window.__cs!.store.getState().project.sprites.find((s) => s.role === "enemy")!.frames);
  const enemy = async () => (await enemyFrames())[0]!;
  const pastLength = () => page.evaluate(() => window.__cs!.store.getState().past.length);
  // The formation's area of the preview canvas (scan lines ~24-80 of 192).
  const formation = () => litPixels(page, 0, 45, 320, 70);

  await page.getByRole("button", { name: "Edit Enemy", exact: true }).click();
  const canvas = page.getByLabel("Enemy frame 1 pixels");
  const box = (await canvas.boundingBox())!;
  const cell = (x: number, y: number) => ({ x: box.x + ((x + 0.5) * box.width) / 12, y: box.y + ((y + 0.5) * box.height) / 8 });

  // Clear both animation frames: the enemies disappear from the game.
  let n = await buildCount(page);
  await page.getByRole("button", { name: "Clear" }).click();
  await page.getByRole("tab", { name: "Frame 2" }).click();
  await page.getByRole("button", { name: "Clear" }).click();
  // Both clicks may fall in one debounce window, so expect at least one build.
  await waitForBuild(page, n + 1);
  await expect.poll(formation).toBeLessThan(40); // at most a falling bomb
  n = await buildCount(page);
  await page.getByRole("tab", { name: "Frame 1" }).click();

  // Fill with color 1: every enemy becomes a solid block.
  await page.getByRole("radio", { name: "Fill" }).click();
  await page.getByRole("radio", { name: "Color 1" }).click();
  await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
  expect(await enemy()).toEqual(Array(8).fill("111111111111"));
  // "Copy frame 1" makes frame 2 match, so the animation keeps the solid block.
  await page.getByRole("tab", { name: "Frame 2" }).click();
  await page.getByRole("button", { name: "Copy frame 1" }).click();
  expect((await enemyFrames())[1]).toEqual(Array(8).fill("111111111111"));
  await waitForBuild(page, n + 1);
  await page.getByRole("tab", { name: "Frame 1" }).click();
  await expect.poll(formation).toBeGreaterThan(3000);

  // A pencil stroke across the top row is one undo step.
  await page.getByRole("radio", { name: "Pencil" }).click();
  await page.getByRole("radio", { name: "Color 2" }).click();
  const before = await pastLength();
  const a = cell(0, 0);
  const b = cell(11, 0);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 3 });
  await page.mouse.up();
  expect((await enemy())[0]).toBe("222222222222");
  expect(await pastLength()).toBe(before + 1);

  // Right-click erases.
  const c = cell(5, 4);
  await page.mouse.click(c.x, c.y, { button: "right" });
  expect((await enemy())[4]).toBe("111110111111");

  // Undo twice restores the filled sprite.
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  expect(await enemy()).toEqual(Array(8).fill("111111111111"));

  // Switching the sprite's palette recolors it in the game.
  n = await buildCount(page);
  await page.getByLabel("Sprite palette").selectOption("bomb");
  await waitForBuild(page, n + 1);
  const pinkish = "r>g+40 && r>b";
  await expect.poll(() => litPixels(page, 0, 45, 320, 70, pinkish)).toBeGreaterThan(3000);
});

test("previews are unsigned; downloads are signed", async ({ page }) => {
  await open(page);
  const preview = await page.evaluate(() => {
    const last = window.__cs!.last!;
    return last.kind === "built" ? { signed: last.signed, bin: Array.from(last.bin) } : null;
  });
  expect(preview?.signed).toBe(false);

  const fetchDownload = async (name: string) => {
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name }).click()]);
    expect(download.suggestedFilename()).toMatch(/^cat-vs-vacuums\.(a78|bin)$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(c as Buffer);
    return Buffer.concat(chunks);
  };

  const bin = await fetchDownload("Download .bin");
  expect(bin.length).toBe(32768);
  // Signing only writes the 120-byte signature, so the signed .bin differs from
  // the unsigned preview there and nowhere else.
  let differing = 0;
  for (let i = 0; i < bin.length; i++) if (bin[i] !== preview!.bin[i]) differing++;
  expect(differing).toBeGreaterThan(0);
  expect(differing).toBeLessThanOrEqual(120);

  const a78 = await fetchDownload("Download .a78");
  expect(a78.length).toBe(128 + 32768);
  expect(a78.subarray(1, 10).toString("latin1")).toBe("ATARI7800");
  expect(a78.subarray(128).equals(bin)).toBe(true);
});

/** Address of a game variable, from the last build's dasm symbols. */
const symbol = (page: Page, name: string) =>
  page.evaluate((name) => {
    const last = window.__cs!.last!;
    if (last.kind !== "built") throw new Error("no ROM");
    const m = new RegExp(`^${name}\\s+([0-9a-f]{4})`, "im").exec(last.symbols);
    return parseInt(m![1]!, 16);
  }, name);

test("lockstep runs are repeatable and game variables are readable from RAM", async ({ page }) => {
  await open(page);
  const score0 = await symbol(page, "score0");
  const lives = await symbol(page, "lives");
  const run = () =>
    page.evaluate(
      async ({ score0, lives }) => {
        const cs = window.__cs!;
        const e = cs.emulator!;
        const last = cs.last!;
        if (last.kind !== "built") throw new Error("no ROM");
        e.pause(true);
        await e.load(last.a78, "a78");
        const idle = { up: false, down: false, left: false, right: false, fire: false };
        for (let i = 0; i < 25; i++) {
          e.setInput({ ...idle, fire: true });
          await e.stepFrames(2);
          e.setInput(idle);
          await e.stepFrames(10);
        }
        const score = Array.from(await e.readMemory(score0, 3), (b) => b.toString(16).padStart(2, "0")).join("");
        return { hash: await e.framebufferHash(), score, lives: (await e.readMemory(lives, 1))[0] };
      },
      { score0, lives },
    );
  const a = await run();
  const b = await run();
  expect(a).toEqual(b);
  expect(Number(a.score)).toBeGreaterThan(0);
  expect(a.lives).toBe(3);
});

test("keys typed in text fields don't reach the game", async ({ page }) => {
  await open(page);
  const shotactive = await symbol(page, "shotactive");
  const shotFired = () =>
    page.evaluate(async (addr) => {
      const e = window.__cs!.emulator!;
      await e.stepFrames(3);
      return (await e.readMemory(addr, 1))[0] !== 0;
    }, shotactive);
  // Start the game from the title screen, in lockstep.
  await page.evaluate(async () => {
    const e = window.__cs!.emulator!;
    const idle = { up: false, down: false, left: false, right: false, fire: false };
    e.pause(true);
    e.setInput({ ...idle, fire: true });
    await e.stepFrames(2);
    e.setInput(idle);
    await e.stepFrames(2);
  });
  expect(await shotFired()).toBe(false);

  const title = page.getByLabel("Game title");
  await title.click();
  await title.evaluate((el: HTMLInputElement) => el.setSelectionRange(el.value.length, el.value.length));
  await page.keyboard.down(" ");
  expect(await shotFired()).toBe(false);
  await page.keyboard.up(" ");
  await expect(title).toHaveValue("Cat vs. Vacuums ");

  await page.getByLabel("Game preview").click();
  await page.keyboard.down(" ");
  expect(await shotFired()).toBe(true);
  await page.keyboard.up(" ");
});

test("the game keeps running while the main thread is busy", async ({ page }) => {
  await open(page);
  const advanced = await page.evaluate(async () => {
    const e = window.__cs!.emulator!;
    let last = 0;
    e.onFrame((f) => (last = f));
    await new Promise((r) => setTimeout(r, 100));
    const before = last;
    const until = performance.now() + 600;
    while (performance.now() < until) {
      // Block the main thread; the worker keeps emulating.
    }
    await new Promise((r) => setTimeout(r, 50));
    return last - before;
  });
  // ~0.65 s at 60 fps; frames emulated during the block arrive afterwards.
  expect(advanced).toBeGreaterThan(25);
});

test("makes the print PDF with an edited manual", async ({ page }) => {
  await open(page);
  const manual = page.getByLabel("Manual text");
  await expect(manual).toHaveValue(/You start with 3 lives\./);

  // The draft follows the settings until the creator edits it.
  await page.getByLabel("Lives").fill("5");
  await expect(manual).toHaveValue(/You start with 5 lives\./);
  await manual.fill("# Story\nThe vacuums are back, and only one cat can stop them.");
  await expect(page.getByRole("button", { name: "Reset to draft" })).toBeVisible();

  await page.getByLabel("Paper size").selectOption("a4");
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    page.getByRole("button", { name: "Download print PDF" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("cat-vs-vacuums-print.pdf");
  const chunks: Buffer[] = [];
  for await (const c of await download.createReadStream()) chunks.push(c as Buffer);
  const pdf = Buffer.concat(chunks);
  expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");

  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(pdf);
  expect(doc.getPageCount()).toBeGreaterThanOrEqual(4);
  expect(Math.round(doc.getPage(0).getWidth())).toBe(595); // A4

  await page.getByRole("button", { name: "Reset to draft" }).click();
  await expect(manual).toHaveValue(/You start with 5 lives\./);
});
