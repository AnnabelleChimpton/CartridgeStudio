// The app shell: the Game menu, the Mode (tier) switch, the theme switch and
// toasts. Each tier and theme passes axe.

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

  test("starts in Starter mode, which hides rules and developer tools until asked", async ({ page }) => {
    await start(page, /^Ghost Panic/);
    const mode = page.getByRole("radiogroup", { name: "Mode" });
    await expect(mode.getByRole("radio", { name: "Starter" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("tab")).toHaveText(["Things", "Room", "Game"]);
    await expect(page.getByText("For developers")).toBeHidden();
    await page.getByRole("tab", { name: "Game" }).click();
    await expect(page.getByRole("button", { name: "Add counter" })).toBeHidden();
    expect(await axe(page)).toEqual([]);

    // Maker shows the rules; arrows move through the switch.
    await mode.getByRole("radio", { name: "Starter" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(mode.getByRole("radio", { name: "Maker" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("tab")).toHaveText(["Things", "Room", "Rules", "Game"]);
    await expect(page.getByRole("button", { name: "Add counter" })).toBeVisible();

    // Coder opens the developer drawer; the choice is remembered.
    await mode.getByRole("radio", { name: "Coder" }).click();
    await expect(page.getByText("View code")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("radio", { name: "Coder" })).toHaveAttribute("aria-checked", "true");

    // Back to Starter while on Rules: the editor falls back to Things.
    await page.getByRole("tab", { name: "Rules" }).click();
    await page.getByRole("radio", { name: "Starter" }).click();
    await expect(page.getByRole("tab", { name: "Things" })).toHaveAttribute("aria-selected", "true");
  });
});

test("the Game menu opens with a click, closes with Escape and starts a new game", async ({ page }) => {
  await start(page, /^Dodger/);
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
  await start(page, /^Dodger/);
  await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Save game file" }).click()]);
  await expect(page.getByRole("status").filter({ hasText: "rock-fall.cartridge" })).toContainText("Saved rock-fall.cartridge to your downloads");
});

test("light and dark themes both pass axe, and the choice is remembered", async ({ page }) => {
  await start(page, /^Ghost Panic/);
  const theme = page.getByRole("button", { name: /^Theme:/ });
  await expect(theme).toHaveAccessibleName("Theme: System");
  await theme.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await axe(page), "light").toEqual([]);
  await theme.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await axe(page), "dark").toEqual([]);
  for (const name of ["Rules", "Game"]) {
    await page.getByRole("tab", { name }).click();
    expect(await axe(page), `dark ${name}`).toEqual([]);
  }
  await page.getByRole("button", { name: /Put it on a console/ }).click();
  expect(await axe(page), "dark dialog").toEqual([]);
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
