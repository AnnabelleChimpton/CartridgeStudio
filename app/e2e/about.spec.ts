// About and licences: reachable from every screen, and every licence it links
// to is actually served.

import { expect, test } from "@playwright/test";

test("the About dialog credits the tools and serves their licences", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByText("Pick a cart to start from")).toBeVisible();
  const dialog = page.getByRole("dialog", { name: "About and licences" });
  // The offline note can appear above the link as the page settles and move it
  // mid-click, so open until the dialog shows.
  await expect(async () => {
    if (!(await dialog.isVisible())) await page.getByRole("button", { name: "About and licences" }).click({ timeout: 2000 });
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass();
  for (const name of ["7800basic", "dasm", "js7800"]) await expect(dialog.getByRole("heading", { name: new RegExp(`^${name}`) })).toBeVisible();
  await expect(dialog).toContainText("RevEng");
  await expect(dialog).toContainText("raz0red");
  await expect(dialog).toContainText("not affiliated with or endorsed by Atari");

  const links = await dialog.getByRole("link").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  const local = links.filter((h) => new URL(h).origin === new URL(page.url()).origin);
  expect(local.length).toBeGreaterThanOrEqual(9);
  for (const href of local) {
    const res = await request.get(href);
    expect(res.status(), href).toBe(200);
    const body = await res.text();
    expect(body.length, href).toBeGreaterThan(200);
    // Not the page itself, which a server might send for a missing file.
    expect(body, href).not.toMatch(/^\s*<!doctype html/i);
  }
  expect(links).toContain("https://github.com/dasm-assembler/dasm");
  expect(links.some((h) => /^https:\/\/github\.com\/raz0red\/js7800\/tree\/[0-9a-f]{40}$/.test(h))).toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "About and licences" })).toBeFocused();
});

test("the Game menu opens About and licences, and focus comes back to the menu", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Cat vs\. Vacuums/ }).click();
  const menu = page.getByRole("button", { name: "Game", exact: true });
  await menu.click();
  await page.getByRole("button", { name: "About and licences" }).first().click();
  const dialog = page.getByRole("dialog", { name: "About and licences" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Mike Saarna (RevEng)");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(menu).toBeFocused();
});
