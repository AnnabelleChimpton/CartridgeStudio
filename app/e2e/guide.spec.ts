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

test("the guide walks through drawing, playing on the TV and changing a rule", async ({ page }) => {
  await page.goto("/");
  await start(page, "Rock Fall");
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
  await announced(page, "Your hero has your drawing. Next: Play it on the TV.");
  await expect(guide(page).getByRole("listitem").nth(1)).toHaveAttribute("aria-current", "step");
  await expect(page.locator(".play-column")).toHaveClass(/guide-play/);

  // 2: Play goes to TV mode, with the keyboard in the game.
  await page.getByRole("button", { name: "Play: Play it on the TV" }).click();
  await expect(page.getByRole("application", { name: "Game preview" })).toBeFocused();
  await announced(page, "You played your own game! Next: Change a rule (if you like).");
  await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());
  await page.keyboard.press("Escape"); // Esc stops playing
  await expect(page.getByRole("application", { name: "Game preview" })).not.toBeFocused();

  // 3: Rules opens the rules; changing one finishes the guide.
  await page.getByRole("button", { name: "Rules: Change a rule (if you like)" }).click();
  await expect(page.getByRole("tab", { name: "Rules" })).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("Rule 3 action 1 points").selectOption("100");
  await announced(page, "You changed how your game plays. All three steps done.");
  await expect(page.getByRole("heading", { name: "You made a game!" })).toBeVisible();

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

  await guide(page).getByRole("button", { name: "Hide guide" }).click();
  await page.getByRole("button", { name: "New game" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^Yarn Hunt/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Start the new game" }).click();
  await expect(guide(page)).toBeVisible();
  await expect(guide(page).getByRole("button", { name: "Race the clock" })).toBeVisible();
});
