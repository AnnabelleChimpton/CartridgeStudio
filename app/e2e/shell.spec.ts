// The app shell: the Game menu, the Mode (tier) switch and its old names, toasts, the context
// strip, the ways out of the editor and colour names. Each tier passes axe.

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

async function start(page: Page, preset: RegExp) {
  await page.goto("/");
  await page.getByRole("button", { name: preset }).click();
  await expect(page.getByTestId("build-status")).toContainText("Built in", { timeout: 30_000 });
}

test.describe("a first visit", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("starts in Kit mode, which keeps counters and code out of the way until asked", async ({ page }) => {
    await start(page, /^Ghost Panic/);
    const mode = page.getByRole("radiogroup", { name: "Mode" });
    await expect(mode.getByRole("radio")).toHaveText(["Kit", "Rules", "7800basic"]);
    await expect(mode.getByRole("radio", { name: "Kit" })).toHaveAttribute("aria-checked", "true");
    // Kit keeps the Rules tab: the guide's third step changes a rule.
    await expect(page.getByRole("tab")).toHaveText(["Things", "Room", "Rules", "Game"]);
    await page.getByRole("tab", { name: "Game" }).click();
    await expect(page.getByRole("button", { name: "Add counter" })).toBeHidden();
    expect(await axe(page)).toEqual([]);

    // Rules shows counters; arrows move through the switch.
    await mode.getByRole("radio", { name: "Kit" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(mode.getByRole("radio", { name: "Rules" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("tab")).toHaveText(["Things", "Room", "Rules", "Game"]);
    await expect(page.getByRole("button", { name: "Add counter" })).toBeVisible();

    // 7800basic adds the Code tab, and the choice is remembered.
    await mode.getByRole("radio", { name: "7800basic" }).click();
    await expect(page.getByRole("tab")).toHaveText(["Things", "Room", "Rules", "Game", "Code"]);
    await page.reload();
    await expect(page.getByRole("radio", { name: "7800basic" })).toHaveAttribute("aria-checked", "true");

    // Back to Kit while on Code: the editor falls back to Things.
    await page.getByRole("tab", { name: "Code" }).click();
    await page.getByRole("radio", { name: "Kit" }).click();
    await expect(page.getByRole("tab", { name: "Things" })).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("a browser that remembers the old tier names", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("reads Maker as Rules and stores the new name", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("cs-tier", "maker"));
    await page.reload();
    await page.getByRole("button", { name: /^Ghost Panic/ }).click();
    await expect(page.getByRole("radio", { name: "Rules" })).toHaveAttribute("aria-checked", "true");
    expect(await page.evaluate(() => localStorage.getItem("cs-tier"))).toBe("rules");
  });
});

test("the Game menu opens with a click, closes with Escape and starts a new game", async ({ page }) => {
  await start(page, /^Teacup Rain/);
  // The bar holds the title, not what kind of project it is.
  await expect(page.locator(".topbar").getByText("Game kit")).toHaveCount(0);
  const menuButton = page.getByRole("button", { name: "Game", exact: true });
  await expect(page.getByRole("button", { name: "New game" })).toBeHidden();
  await menuButton.click();
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".menu").getByRole("button")).toHaveText(["New game", "Open a game file…", "Save a game file", "About and licences"]);
  await expect(page.getByRole("button", { name: "New game" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "New game" })).toBeHidden();
  await expect(menuButton).toBeFocused();

  await menuButton.click();
  await page.getByRole("button", { name: "New game" }).click();
  await expect(page.getByRole("dialog").getByText("Pick a cart to start from")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("saving says so in a toast", async ({ page }) => {
  await start(page, /^Teacup Rain/);
  await page.getByRole("button", { name: "Game", exact: true }).click();
  await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Save a game file" }).click()]);
  await expect(page.getByRole("status").filter({ hasText: "teacup-rain.cartridge" })).toContainText("Saved teacup-rain.cartridge to your downloads");
});

test("on a phone the Mode switch is in the Game menu and the bar stays one row", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page, /^Teacup Rain/);
  const bar = page.locator(".topbar");
  await expect(bar.getByRole("radiogroup", { name: "Mode" })).toBeHidden();
  const [first, last] = await Promise.all([bar.locator(".brand").boundingBox(), bar.getByRole("button", { name: "Game", exact: true }).boundingBox()]);
  expect(Math.abs(first!.y + first!.height / 2 - (last!.y + last!.height / 2))).toBeLessThan(8);
  await bar.getByRole("button", { name: "Game", exact: true }).click();
  const mode = page.locator(".menu").getByRole("radiogroup", { name: "Mode" });
  await expect(mode.getByRole("radio")).toHaveText(["Kit", "Rules", "7800basic"]);
  await mode.getByRole("radio", { name: "Rules" }).click();
  await expect(page.locator(".menu")).toBeHidden();
  await expect(page.locator("html")).toHaveAttribute("data-tier", "rules");
  // The TV comes first, before the editor.
  const [tv, tabs] = await Promise.all([page.locator(".tv-stage").boundingBox(), page.getByRole("tablist").first().boundingBox()]);
  expect(tv!.y).toBeLessThan(tabs!.y);
});

test("every tab, the ways out and a dialog pass axe", async ({ page }) => {
  await start(page, /^Ghost Panic/);
  expect(await axe(page)).toEqual([]);
  for (const name of ["Room", "Rules", "Game"]) {
    await page.getByRole("tab", { name }).click();
    expect(await axe(page), name).toEqual([]);
  }
  const showIt = page.getByRole("region", { name: "Share and download" });
  await expect(showIt.getByRole("button")).toHaveText(["Put it on a cart (.a78)", "Print the box (PDF)", "Send to family (.html)", "Make a GIF", "Everything (.zip)"]);
  await showIt.getByRole("button", { name: /Put it on a cart/ }).click();
  expect(await axe(page), "dialog").toEqual([]);
});

test("the colour picker names colours", async ({ page }) => {
  await start(page, /^Teacup Rain/);
  await page.getByRole("tab", { name: "Game" }).click();
  const swatch = page.getByRole("button", { name: /^Background/ }).first();
  await expect(swatch).toHaveAccessibleName(/^Background.*: \$[0-9A-F]{2}, [a-z ]+$/);
  await swatch.click();
  await expect(page.getByRole("option", { name: "$C8, sea green" })).toBeAttached();
  await page.getByRole("option", { name: "$D7, green" }).hover();
  await expect(page.locator(".picker-name")).toContainText("green $D7");
});

test("an error takes the context strip under the top bar", async ({ page }) => {
  await start(page, /^Teacup Rain/);
  await page.getByLabel("Open game file").setInputFiles({ name: "notes.cartridge", mimeType: "text/plain", buffer: Buffer.from("hi") });
  const alert = page.locator(".topbar").getByRole("alert");
  await expect(alert).toContainText("Couldn't open notes.cartridge");
  await alert.getByRole("button", { name: "Dismiss" }).click();
  await expect(alert).toBeEmpty();
});
