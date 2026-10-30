import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function start(page: Page, preset: string) {
  await page.getByRole("button", { name: new RegExp(`^${preset}`) }).click();
  await expect(page.getByTestId("build-status")).toContainText("Built in", { timeout: 30_000 });
}
const guide = (page: Page) => page.getByRole("region", { name: "Guide" });
const announced = (page: Page, text: string) => expect(page.getByRole("status").filter({ hasText: text })).toBeAttached();
// The guide is for the Kit and Rules tiers; the 7800basic tier never shows it.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("cs-tier", "kit"));
});

async function showGuide(page: Page) {
  await page.getByRole("button", { name: "Game", exact: true }).click();
  await page.getByRole("button", { name: "Show the guide" }).click();
}

test("the guide walks through drawing, playing full screen and changing a rule, one step at a time", async ({ page }) => {
  await page.goto("/");
  await start(page, "Teacup Rain");
  await expect(guide(page)).toBeVisible();
  await expect(guide(page)).toContainText("1 of 3");
  await expect(guide(page)).toContainText("Draw your Cat. Pick a colour, click squares.");
  // Only the current step shows, and no ideas yet.
  await expect(guide(page)).not.toContainText("Play it full screen.");
  await expect(guide(page).getByRole("button", { name: "Last for a whole minute" })).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  // 1: Draw opens Things with the hero picked and the pixel grid in hand.
  await guide(page).getByRole("button", { name: "Draw", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Things" })).toHaveAttribute("aria-selected", "true");
  const pixels = page.locator('canvas[aria-roledescription="pixel grid"]');
  await expect(pixels).toBeFocused();
  await page.keyboard.press("3");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await announced(page, "Your Cat has your drawing. Next: Play it full screen.");
  await expect(guide(page)).toContainText("2 of 3");

  // Clicking into the game isn't playing it full screen: the step waits.
  await page.getByRole("application", { name: "Game preview" }).click();
  await expect(guide(page)).toContainText("2 of 3");
  await page.keyboard.press("Escape");

  // 2: Full screen, with the keyboard in the game.
  await guide(page).getByRole("button", { name: "Full screen", exact: true }).click();
  await expect(page.getByRole("application", { name: "Game preview" })).toBeFocused();
  await announced(page, "Played full screen. Next: Change a rule.");
  await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());
  await page.keyboard.press("Escape"); // Esc stops playing
  await expect(page.getByRole("application", { name: "Game preview" })).not.toBeFocused();

  // 3: Rules opens the rules; changing one finishes the steps.
  await expect(guide(page)).toContainText("3 of 3");
  await guide(page).getByRole("button", { name: "Rules", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Rules" })).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("Rule 3 action 1 points").selectOption("100");
  await announced(page, "Rule changed. That was the last step.");
  await expect(guide(page)).toContainText("Ideas for Teacup Rain:");
  await expect(guide(page)).not.toContainText("of 3");

  // An idea opens where to make it, and then says how.
  await guide(page).getByRole("button", { name: "Make the teacups fall faster" }).click();
  await expect(page.getByRole("tab", { name: "Things" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: /^Teacup/, pressed: true })).toBeVisible();
  await expect(guide(page).locator(".muted")).toBeVisible();
});

test("hidden guide persists per game", async ({ page }) => {
  await page.goto("/");
  await start(page, "Ghost Panic");
  await expect(guide(page)).toBeVisible();
  await guide(page).getByRole("button", { name: "Hide guide" }).click();
  await expect(guide(page)).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Things" })).toBeFocused();

  await page.reload();
  await expect(page.getByTestId("build-status")).toContainText("Built in", { timeout: 30_000 });
  await expect(guide(page)).toHaveCount(0);

  await showGuide(page);
  await expect(guide(page)).toBeVisible();
  await expect(guide(page)).toBeFocused();
  await expect(guide(page)).toContainText("1 of 3");
});

test("new game shows the guide", async ({ page }) => {
  await page.goto("/");
  await start(page, "Ghost Panic");
  await guide(page).getByRole("button", { name: "Hide guide" }).click();
  await expect(guide(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Game", exact: true }).click();
  await page.getByRole("button", { name: "New game" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^Teacup Rain/ }).click();
  await expect(guide(page)).toBeVisible();
  await expect(guide(page)).toContainText("1 of 3");
});
