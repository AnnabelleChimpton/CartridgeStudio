// Getting started: a starter game opens with a three-step guide that ticks
// itself off, works from the keyboard, remembers being hidden and comes back
// from the Guide button.

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function start(page: Page, preset: string) {
  await page.getByRole("button", { name: new RegExp(`^${preset}`) }).click();
  await expect(page.getByTestId("build-status")).toContainText("Up to date", { timeout: 30_000 });
}
const guide = (page: Page) => page.getByRole("region", { name: /Make it yours|You made it yours/ });
const announced = (page: Page, text: string) => expect(page.getByRole("status").filter({ hasText: text })).toBeAttached();

test("the guide walks through drawing, painting and playing", async ({ page }) => {
  await page.goto("/");
  await start(page, "Dodger");
  await expect(guide(page)).toBeVisible();
  await expect(guide(page).getByRole("listitem").first()).toHaveAttribute("aria-current", "step");
  await expect(guide(page).getByRole("button", { name: "Survive for a whole minute" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Things" })).toHaveClass(/guide-target/);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  // 1: Draw opens Things with the hero picked and the pixel grid in hand.
  await page.getByRole("button", { name: "Draw: Draw your hero" }).click();
  await expect(page.getByRole("tab", { name: "Things" })).toHaveAttribute("aria-selected", "true");
  const pixels = page.locator('canvas[aria-roledescription="pixel grid"]');
  await expect(pixels).toBeFocused();
  await page.keyboard.press("3");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await announced(page, "Done: Draw your hero. Next: Paint the room.");
  await expect(guide(page).getByRole("listitem").nth(1)).toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("tab", { name: "Room" })).toHaveClass(/guide-target/);

  // 2: Paint opens the room grid.
  await page.getByRole("button", { name: "Paint: Paint the room" }).click();
  await expect(page.getByRole("tab", { name: "Room" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Room grid")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await announced(page, "Done: Paint the room. Next: Press Play.");

  // 3: Play hands the keyboard to the game.
  await page.getByRole("button", { name: "Play: Press Play" }).click();
  await expect(page.getByRole("application", { name: "Game preview" })).toBeFocused();
  await announced(page, "All three steps done.");
  await expect(page.getByRole("heading", { name: "You made it yours!" })).toBeVisible();

  // An idea opens where to make it.
  await page.getByRole("button", { name: "Make the rocks fall faster" }).click();
  await expect(page.getByRole("tab", { name: "Things" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: /^Rock/, pressed: true })).toBeVisible();
});

test("a hidden guide stays hidden for that game, comes back from Guide, and a new game gets a fresh one", async ({ page, browserName }) => {
  await page.goto("/");
  await start(page, "Ghost Panic");
  await expect(guide(page).getByRole("button", { name: "Make the catnip last longer" })).toBeVisible();
  await expect(guide(page).getByRole("button", { name: "Add spikes to the maze" })).toBeVisible();

  const toggle = page.getByRole("button", { name: "Guide", exact: true });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await guide(page).getByRole("button", { name: "Hide guide" }).click();
  await expect(guide(page)).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await page.reload();
  await expect(page.getByTestId("build-status")).toContainText("Up to date", { timeout: 30_000 });
  await expect(guide(page)).toHaveCount(0);

  await toggle.click();
  await expect(guide(page)).toBeVisible();
  await expect(guide(page)).toBeFocused();
  // Tab moves on from the guide into its buttons (WebKit's Tab skips buttons unless the user turns that on).
  if (browserName !== "webkit") {
    await page.keyboard.press("Tab");
    await expect(guide(page).getByRole("button", { name: "Hide guide" })).toBeFocused();
  }

  page.on("dialog", (d) => void d.accept());
  await guide(page).getByRole("button", { name: "Hide guide" }).click();
  await page.getByRole("button", { name: "New game" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^Maze/ }).click();
  await expect(guide(page)).toBeVisible();
  await expect(guide(page).getByRole("button", { name: "Race the clock" })).toBeVisible();
});
