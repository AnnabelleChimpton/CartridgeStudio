// "Made by": typed on the Game tab, one title-screen line with a live count,
// kept with the game, and blank unless the creator fills it in.

import { expect, test, type Page } from "@playwright/test";

async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /^Ghost Panic/ }).click();
  await expect(page.getByTestId("build-status")).toContainText("Built in", { timeout: 30_000 });
  await page.getByRole("tab", { name: "Game" }).click();
}
const madeBy = (page: Page) => page.evaluate(() => (window.__cs!.kitStore!.getState().project as { madeBy?: string }).madeBy);

test("Made by starts empty, counts toward one title-screen line, and is kept with the game", async ({ page }) => {
  await start(page);
  const field = page.getByLabel("Made by");
  await expect(field).toHaveValue("");
  await expect(field).toHaveAttribute("maxlength", "29");
  expect(await madeBy(page)).toBeUndefined();

  await field.fill("Sam & Robin");
  await expect(page.getByText("11 of 29 characters")).toBeVisible();
  await expect(page.getByText("On the TV it shows as “BY SAM ROBIN”", { exact: false })).toBeVisible();
  expect(await madeBy(page)).toBe("Sam & Robin");

  await field.fill("Sam and Robin");
  await expect(page.getByText("13 of 29 characters")).toBeVisible();
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.getByTestId("build-status")).toContainText("Built in", { timeout: 30_000 });
  expect(await madeBy(page)).toBe("Sam and Robin");

  // Clearing it takes it out of the game again.
  await page.getByRole("tab", { name: "Game" }).click();
  await page.getByLabel("Made by").fill("");
  expect(await madeBy(page)).toBeUndefined();
});
