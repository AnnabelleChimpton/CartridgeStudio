// The app shell: the Game menu, the Mode (tier) switch, toasts, the context
// strip, Show it's groups and colour names. Each tier passes axe.

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

async function start(page: Page, preset: RegExp) {
  await page.goto("/");
  await page.getByRole("button", { name: preset }).click();
  await expect(page.getByTestId("build-status")).toContainText("Up to date", { timeout: 30_000 });
}

test.describe("a first visit", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("starts in Starter mode, which keeps counters and code out of the way until asked", async ({ page }) => {
    await start(page, /^Ghost Panic/);
    const mode = page.getByRole("radiogroup", { name: "Mode" });
    await expect(mode.getByRole("radio", { name: "Starter" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("tab")).toHaveText(["Things", "Room", "Rules", "Game"]);
    await page.getByRole("tab", { name: "Game" }).click();
    await expect(page.getByRole("button", { name: "Add counter" })).toBeHidden();
    expect(await axe(page)).toEqual([]);

    // Maker shows counters; arrows move through the switch.
    await mode.getByRole("radio", { name: "Starter" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(mode.getByRole("radio", { name: "Maker" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("tab")).toHaveText(["Things", "Room", "Rules", "Game"]);
    await expect(page.getByRole("button", { name: "Add counter" })).toBeVisible();

    // Coder adds the Code tab; the choice is remembered.
    await mode.getByRole("radio", { name: "Coder" }).click();
    await expect(page.getByRole("tab")).toHaveText(["Things", "Room", "Rules", "Game", "Code"]);
    await page.reload();
    await expect(page.getByRole("radio", { name: "Coder" })).toHaveAttribute("aria-checked", "true");

    // Back to Starter while on Code: the editor falls back to Things.
    await page.getByRole("tab", { name: "Code" }).click();
    await page.getByRole("radio", { name: "Starter" }).click();
    await expect(page.getByRole("tab", { name: "Things" })).toHaveAttribute("aria-selected", "true");
  });
});

test("the Game menu opens with a click, closes with Escape and starts a new game", async ({ page }) => {
  await start(page, /^Rock Fall/);
  const menuButton = page.getByRole("button", { name: "Game", exact: true });
  await expect(page.getByRole("button", { name: "New game" })).toBeHidden();
  await menuButton.click();
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "New game" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "New game" })).toBeHidden();
  await expect(menuButton).toBeFocused();

  await menuButton.click();
  await page.getByRole("button", { name: "New game" }).click();
  await expect(page.getByRole("dialog").getByText("What do you want to make?")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("saving says so in a toast", async ({ page }) => {
  await start(page, /^Rock Fall/);
  await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Save game file" }).click()]);
  await expect(page.getByRole("status").filter({ hasText: "rock-fall.cartridge" })).toContainText("Saved rock-fall.cartridge to your downloads");
});

test("every tab, Show it and a dialog pass axe; Show it leads with making it real", async ({ page }) => {
  await start(page, /^Ghost Panic/);
  expect(await axe(page)).toEqual([]);
  for (const name of ["Room", "Rules", "Game"]) {
    await page.getByRole("tab", { name }).click();
    expect(await axe(page), name).toEqual([]);
  }
  const showIt = page.getByRole("region", { name: "Show it" });
  await expect(showIt.getByRole("heading", { level: 3 })).toHaveText(["Make it real", "Share it"]);
  await expect(showIt.getByRole("group", { name: "Make it real" }).getByRole("button")).toHaveText([/^Put it on a console/, /^Print the box/]);
  await expect(showIt.getByRole("group", { name: "Share it" }).getByRole("button")).toHaveText([/^Send to family/, /^Make a clip/]);
  await showIt.getByRole("button", { name: /Put it on a console/ }).click();
  expect(await axe(page), "dialog").toEqual([]);
});

test("the colour picker names colours", async ({ page }) => {
  await start(page, /^Rock Fall/);
  await page.getByRole("tab", { name: "Game" }).click();
  const swatch = page.getByRole("button", { name: /^Background/ }).first();
  await expect(swatch).toHaveAccessibleName(/^Background.*: \$[0-9A-F]{2}, [a-z ]+$/);
  await swatch.click();
  await expect(page.getByRole("option", { name: "$C8, sea green" })).toBeAttached();
  await page.getByRole("option", { name: "$D7, green" }).hover();
  await expect(page.locator(".picker-name")).toContainText("green $D7");
});

test("an error takes the context strip under the top bar", async ({ page }) => {
  await start(page, /^Rock Fall/);
  await page.getByLabel("Open game file").setInputFiles({ name: "notes.cartridge", mimeType: "text/plain", buffer: Buffer.from("hi") });
  const alert = page.locator(".topbar").getByRole("alert");
  await expect(alert).toContainText("Couldn't open notes.cartridge");
  await alert.getByRole("button", { name: "Dismiss" }).click();
  await expect(alert).toBeEmpty();
});
