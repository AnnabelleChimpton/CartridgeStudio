// The player that travels: the "Send to family" file played by touch on a
// phone, with the keyboard and a gamepad on a computer, and in a preview that
// doesn't run scripts. Then TV mode in the app, driven from a gamepad.

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";

type Preset = "Cat vs. Vacuums" | "Rock Fall" | "Ghost Panic";

async function start(page: Page, preset: Preset) {
  await page.goto("/");
  await page.getByRole("button", { name: new RegExp(`^${preset.replace(".", "\\.")}`) }).click();
  await expect(page.getByTestId("build-status")).toContainText("Built in", { timeout: 30_000 });
}

/** Each starter's player file, made once per worker. */
const made = new Map<Preset, string>();
async function playerFile(page: Page, preset: Preset): Promise<string> {
  const cached = made.get(preset);
  if (cached) return cached;
  await start(page, preset);
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    page.getByRole("region", { name: "Show it" }).getByRole("button", { name: /^Send to family/ }).click(),
  ]);
  const chunks: Buffer[] = [];
  for await (const c of await download.createReadStream()) chunks.push(c as Buffer);
  const html = Buffer.concat(chunks).toString("utf8");
  made.set(preset, html);
  return html;
}

/** Opens the file in its own browser context with no network at all. */
async function openPlayer(browser: Browser, html: string, options: BrowserContextOptions = {}) {
  const context = await browser.newContext(options);
  const player = await context.newPage();
  await player.route("**/*", (route) => route.abort());
  await player.setContent(html);
  return player;
}

const frames = (p: Page) => p.evaluate(() => (window as unknown as { __frames?: number }).__frames ?? 0);
const inputs = (p: Page) => p.evaluate(() => (window as unknown as { __input: boolean[] }).__input.slice(0, 5));
const RIGHT = 0;
const LEFT = 1;
const FIRE = 4;

/** A fake standard gamepad the page reads through navigator.getGamepads. */
const fakeGamepad = () => {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
  const pad = { id: "Test pad", index: 0, connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons, timestamp: 0 };
  (window as unknown as { __testPad: typeof pad }).__testPad = pad;
  Object.defineProperty(navigator, "getGamepads", { value: () => [pad, null, null, null], configurable: true });
};
const setButton = (p: Page, i: number, pressed: boolean) =>
  p.evaluate(([i, pressed]) => {
    (window as unknown as { __testPad: { buttons: { pressed: boolean }[] } }).__testPad.buttons[i as number]!.pressed = pressed as boolean;
  }, [i, pressed] as const);
async function pressButton(p: Page, i: number, ms = 150) {
  await setButton(p, i, true);
  await p.waitForTimeout(ms);
  await setButton(p, i, false);
  await p.waitForTimeout(150);
}

const phone = { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } };

test.describe("on a phone", () => {
  test.skip(({ browserName }) => browserName === "firefox", "Firefox has no mobile emulation");

  test("plays by tapping: the pad and button follow the game, and fit the screen both ways round", async ({ page, browser }) => {
    const player = await openPlayer(browser, await playerFile(page, "Cat vs. Vacuums"), phone);
    // Cat vs. Vacuums slides left and right and fires, so the line and the pad say so.
    await expect(player.locator("#controls")).toHaveText("Fire fires. The arrows move.");
    const dpad = player.locator("#dpad");
    const fire = player.locator("#fire");
    await expect(dpad).toHaveClass(/lr/);
    await expect(fire).toHaveText("Fire");
    for (const box of [await dpad.boundingBox(), await fire.boundingBox()]) {
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    // Upright: the pad sits under the screen, all on screen.
    const stage = (await player.locator("#stage").boundingBox())!;
    expect((await dpad.boundingBox())!.y).toBeGreaterThan(stage.y + stage.height);
    expect((await fire.boundingBox())!.y + 104).toBeLessThanOrEqual(844);

    await fire.tap();
    await expect(player.locator("body")).toHaveClass(/playing/);
    await expect.poll(() => frames(player), { timeout: 10_000 }).toBeGreaterThan(60);
    // Taps never scroll or zoom the page.
    expect(await player.evaluate(() => [window.scrollY, window.visualViewport?.scale ?? 1])).toEqual([0, 1]);
    expect(await player.evaluate(() => getComputedStyle(document.getElementById("pad")!).touchAction)).toBe("none");

    // Sideways: the pad and button go either side of the screen.
    await player.setViewportSize({ width: 844, height: 390 });
    const side = (await player.locator("#stage").boundingBox())!;
    const pad = (await dpad.boundingBox())!;
    const button = (await fire.boundingBox())!;
    expect(pad.x + pad.width).toBeLessThanOrEqual(side.x);
    expect(button.x).toBeGreaterThanOrEqual(side.x + side.width);
    expect(side.y + side.height).toBeLessThanOrEqual(390);
    expect(await new AxeBuilder({ page: player }).analyze().then((r) => r.violations.map((v) => v.id))).toEqual([]);
  });

  test("moves and fires at once with two fingers", async ({ page, browser, browserName }) => {
    test.skip(browserName !== "chromium", "Multi-touch is sent through Chromium's DevTools protocol");
    const player = await openPlayer(browser, await playerFile(page, "Cat vs. Vacuums"), phone);
    await player.locator("#start").tap();
    await expect.poll(() => frames(player), { timeout: 10_000 }).toBeGreaterThan(30);
    const pad = (await player.locator("#dpad").boundingBox())!;
    const fire = (await player.locator("#fire").boundingBox())!;
    const right = { x: pad.x + pad.width * 0.85, y: pad.y + pad.height / 2, id: 1 };
    const left = { x: pad.x + pad.width * 0.15, y: pad.y + pad.height / 2, id: 1 };
    const button = { x: fire.x + fire.width / 2, y: fire.y + fire.height / 2, id: 2 };
    const cdp = await player.context().newCDPSession(player);
    const touch = (type: string, touchPoints: { x: number; y: number; id: number }[]) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints });

    await touch("touchStart", [right]);
    await touch("touchStart", [right, button]);
    await expect.poll(() => inputs(player)).toEqual([true, false, false, false, true]);
    // Sliding the thumb across the pad changes direction without lifting it.
    await touch("touchMove", [left, button]);
    await expect.poll(() => inputs(player).then((i) => [i[RIGHT], i[LEFT], i[FIRE]])).toEqual([false, true, true]);
    await touch("touchEnd", []);
    await expect.poll(() => inputs(player)).toEqual([false, false, false, false, false]);
    await expect(player.locator("#dpad .on")).toHaveCount(0);
  });

  test("a game with no shooting says Start, not Fire", async ({ page, browser }) => {
    const player = await openPlayer(browser, await playerFile(page, "Ghost Panic"), phone);
    await expect(player.locator("#fire")).toHaveText("Start");
    await expect(player.locator("#dpad")).toHaveClass(/free/);
    await expect(player.locator("#controls")).toHaveText("Tap Start to begin. The pad moves.");
  });
});

test("on a computer: a box front, then keys only reach the game away from buttons; P pauses", async ({ page, browser }) => {
  const player = await openPlayer(browser, await playerFile(page, "Ghost Panic"));
  // The box front, drawn from the game's sprites, is up first and can be skipped.
  await expect(player.locator("#box")).not.toHaveClass(/gone/);
  await expect(player.getByRole("button", { name: "Skip" })).toBeVisible();
  await player.getByRole("button", { name: "Skip" }).click();
  await expect(player.locator("#box")).toHaveClass(/gone/);
  // No touch pad on a computer, and the line is the keyboard's.
  await expect(player.locator("#pad")).toBeHidden();
  await expect(player.locator("#controls")).toHaveText("Arrow keys move. Space or Z starts the game. P pauses. Gamepads work too.");
  await expect(player.getByRole("link", { name: "Made with Cartridge Studio" })).toHaveAttribute("href", /^http:\/\/localhost:\d+\/$/);

  await player.getByRole("button", { name: /to play$/ }).click();
  await expect(player.getByRole("application", { name: "Ghost Panic" })).toBeFocused();
  await expect.poll(() => frames(player), { timeout: 10_000 }).toBeGreaterThan(30);

  // P works the console's Pause switch: the game freezes until it's pressed again.
  await player.keyboard.press("p");
  await expect(player.getByRole("status")).toHaveText("Paused");
  await expect(player.getByRole("button", { name: "Resume" })).toBeVisible();
  await player.waitForTimeout(300);
  const still = await player.evaluate(() => document.querySelector("canvas")!.toDataURL());
  await player.waitForTimeout(600);
  expect(await player.evaluate(() => document.querySelector("canvas")!.toDataURL())).toBe(still);
  await player.keyboard.press("p");
  await expect(player.getByRole("status")).toBeHidden();

  // On the "About this page" toggle, Space opens it instead of firing.
  const about = player.getByText("About this page");
  await about.focus();
  await player.keyboard.down(" ");
  await player.waitForTimeout(100);
  expect((await inputs(player))[FIRE]).toBe(false);
  await player.keyboard.up(" ");
  await expect(player.locator("details")).toHaveAttribute("open", "");
  expect(await new AxeBuilder({ page: player }).analyze().then((r) => r.violations.map((v) => v.id))).toEqual([]);
});

test("a gamepad starts, pauses and restarts the player", async ({ page, browser }) => {
  const html = await playerFile(page, "Ghost Panic");
  const context = await browser.newContext();
  await context.addInitScript(fakeGamepad);
  const player = await context.newPage();
  await player.route("**/*", (route) => route.abort());
  await player.setContent(html);
  await pressButton(player, 9); // Start begins
  await expect(player.locator("body")).toHaveClass(/playing/);
  await expect.poll(() => frames(player), { timeout: 10_000 }).toBeGreaterThan(30);
  await pressButton(player, 9); // and then pauses
  await expect(player.getByRole("status")).toHaveText("Paused");
  await pressButton(player, 8); // Select plays again, unpaused
  await expect(player.getByRole("status")).toBeHidden();
  await expect(player.getByRole("button", { name: "Pause" })).toBeVisible();
});

test("where scripts don't run, the page says why and what to do instead", async ({ page, browser, browserName }) => {
  test.skip(browserName === "firefox", "Playwright's Firefox stalls opening a page with JavaScript turned off");
  const html = await playerFile(page, "Ghost Panic");
  const player = await openPlayer(browser, html, { javaScriptEnabled: false });
  await expect(player.getByText(/If you can read this, the game isn't running/)).toBeVisible();
  await expect(player.getByText(/iPhone or iPad/)).toBeVisible();
  await expect(player.getByRole("button", { name: /to play$/ })).toBeHidden();
  await expect(player.getByRole("heading", { name: "Ghost Panic" })).toBeVisible();
  // With scripts, it's gone.
  const live = await openPlayer(browser, html);
  await expect(live.getByText(/If you can read this/)).toBeHidden();
});

test("TV mode: a gamepad pauses, plays again and leaves, and the pointer hides only while playing", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Headless Firefox and WebKit don't go full screen");
  await page.addInitScript(fakeGamepad);
  await start(page, "Ghost Panic");
  const stage = page.locator(".tv-stage");
  const resets = await page.evaluate(() => {
    const emu = window.__cs!.emulator!;
    const w = window as unknown as { __resets: number };
    w.__resets = 0;
    const reset = emu.reset.bind(emu);
    emu.reset = () => {
      w.__resets++;
      reset();
    };
    return w.__resets;
  });
  expect(resets).toBe(0);

  await page.getByRole("button", { name: "Full screen (for a TV)" }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.className ?? null)).toContain("tv-stage");
  await expect(stage.locator(".tv-hint")).toContainText("Start pauses. Select plays again. Hold Select");
  await expect.poll(() => stage.evaluate((el) => getComputedStyle(el).cursor)).toBe("none");

  await pressButton(page, 9);
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  await expect(stage.locator(".tv-hint")).toContainText("Paused. Press Start to carry on.");
  await expect.poll(() => stage.evaluate((el) => getComputedStyle(el).cursor)).toBe("auto");

  // Select, pressed and let go: back to the title, playing.
  await pressButton(page, 8);
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __resets: number }).__resets)).toBe(1);
  await expect.poll(() => stage.evaluate((el) => getComputedStyle(el).cursor)).toBe("none");

  // Select, held: out of TV mode without playing again.
  await pressButton(page, 8, 1300);
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
  expect(await page.evaluate(() => (window as unknown as { __resets: number }).__resets)).toBe(1);
});
