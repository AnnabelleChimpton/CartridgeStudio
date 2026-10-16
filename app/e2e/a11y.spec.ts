// Accessibility: no automated WCAG failures, and everything you can do with
// a mouse in the grids and pickers also works from the keyboard.

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function start(page: Page, choice: RegExp) {
  await page.goto("/");
  await page.getByRole("button", { name: choice }).click();
  await expect(page.getByTestId("build-status")).toContainText("Up to date", { timeout: 30_000 });
}

const openTab = (page: Page, name: string) => page.getByRole("tab", { name }).click();
const game = (page: Page) => page.evaluate(() => window.__cs!.kitStore!.getState().project);

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

test("the start screen and both editors pass axe", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("What do you want to make?")).toBeVisible();
  expect(await axe(page)).toEqual([]);

  await start(page, /^Cat vs\. Vacuums/);
  expect(await axe(page)).toEqual([]);
  for (const name of ["Room", "Rules", "Game"]) {
    await openTab(page, name);
    expect(await axe(page), name).toEqual([]);
  }
  // Ghost Panic's rules use every kind of rule word, and its Game tab lists counters.
  await page.getByRole("button", { name: "Game", exact: true }).click();
  await page.getByRole("button", { name: "New game" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^Ghost Panic/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Start the new game" }).click();
  await expect(page.getByTestId("build-status")).toContainText("Up to date", { timeout: 30_000 });
  for (const name of ["Rules", "Game"]) {
    await openTab(page, name);
    expect(await axe(page), `Ghost Panic ${name}`).toEqual([]);
  }
  await page.getByRole("button", { name: /^Background/ }).first().click();
  await openTab(page, "Code");
  await expect(page.locator(".cm-editor")).toBeVisible();
  expect(await axe(page), "Ghost Panic Code").toEqual([]);

  await page.getByRole("button", { name: "Game", exact: true }).click();
  await page.getByRole("button", { name: "New game" }).click();
  await page.getByRole("button", { name: "Classic shooter" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Start the new game" }).click();
  await expect(page.getByTestId("build-status")).toContainText("Up to date", { timeout: 30_000 });
  expect(await axe(page)).toEqual([]);
  for (const name of ["Rules", "Sounds", "Settings", "Print"]) {
    await openTab(page, name);
    expect(await axe(page), name).toEqual([]);
  }
});

test("controls inside a <label> are named by it, not an aria-label (WCAG 2.5.3)", async ({ page }) => {
  // An aria-label would hide the visible label from speech input ("click Speed") and screen readers.
  const overridden = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("label input, label select, label textarea")]
        .filter((e) => e.hasAttribute("aria-label"))
        .map((e) => e.outerHTML.slice(0, 80)),
    );
  await start(page, /^Ghost Panic/);
  await page.locator("details.more").evaluate((d: HTMLDetailsElement) => void (d.open = true));
  await page.getByRole("button", { name: /^Dust ghost/ }).click();
  await page.locator("details.more").evaluate((d: HTMLDetailsElement) => void (d.open = true));
  expect(await overridden(), "Things").toEqual([]);
  await expect(page.getByLabel("How it moves")).toHaveValue("chase");
  for (const name of ["Room", "Rules", "Game"]) {
    await openTab(page, name);
    expect(await overridden(), name).toEqual([]);
  }
  await expect(page.getByLabel("Title screen", { exact: true })).toHaveValue("Ghost Panic");
  await page.getByRole("button", { name: /^Print the box/ }).click();
  expect(await overridden(), "Print").toEqual([]);
  await expect(page.getByRole("dialog").getByLabel(/^Paper/)).toBeVisible();
});

test("the room can be painted from the keyboard, and Shift+arrows is one undo step", async ({ page }) => {
  await start(page, /^Rock Fall/);
  await openTab(page, "Room");
  const room = page.getByLabel("Room grid");
  await room.focus();
  await expect(page.getByText("Keyboard: arrows move, Space paints")).toBeVisible();
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowDown");
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  expect((await game(page)).room.rows[6]!.slice(3, 7)).toBe("#   ");
  await expect(page.getByText("Column 4, row 7: Wall")).toBeAttached();

  await page.keyboard.down("Shift");
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await page.keyboard.up("Shift");
  expect((await game(page)).room.rows[6]!.slice(3, 7)).toBe("####");
  await page.keyboard.press("Delete");
  expect((await game(page)).room.rows[6]!.slice(3, 7)).toBe("### ");
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await game(page)).room.rows[6]!.slice(3, 7)).toBe("#   ");

  // Digits choose a brush; arrows move between brushes too.
  await room.focus();
  await page.keyboard.press("2");
  await expect(page.getByRole("radio", { name: "Paint Eraser" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: "Paint Eraser" }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("radio", { name: "Paint Wall" })).toBeFocused();
  await expect(page.getByRole("radio", { name: "Paint Wall" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radio", { name: "Paint Eraser" })).toHaveAttribute("tabindex", "-1");
});

test("sprites can be drawn from the keyboard", async ({ page }) => {
  await start(page, /^Rock Fall/);
  const pixels = page.locator('canvas[aria-roledescription="pixel grid"]');
  await pixels.focus();
  await page.keyboard.press("3");
  await expect(page.getByRole("radio", { name: "Color 3" })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  const thing = await page.evaluate(() => window.__cs!.kitStore!.getState().project.types[0]!);
  expect(thing.frames[0]![0]![1]).toBe("3");
  await expect(page.getByText("Column 2, row 1: Color 3")).toBeAttached();

  // The color group is one Tab stop; arrows move within it.
  await page.getByRole("radio", { name: "Color 3" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "Transparent" })).toBeFocused();
  await expect(page.getByRole("radio", { name: "Transparent" })).toHaveAttribute("aria-checked", "true");
});

test("the color picker works with arrows, Enter and Escape", async ({ page }) => {
  await start(page, /^Rock Fall/);
  await openTab(page, "Game");
  const before = (await game(page)).background;
  const swatch = page.getByRole("button", { name: /^Background/ }).first();
  await swatch.click();
  const listbox = page.getByRole("listbox");
  await expect(listbox.locator(":focus")).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await expect(listbox).toBeHidden();
  await expect(swatch).toBeFocused();

  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(listbox).toBeHidden();
  await expect(swatch).toBeFocused();
  const after = (await game(page)).background;
  expect(parseInt(after.slice(1), 16)).toBe(Math.min(255, parseInt(before.slice(1), 16) + 16));
});
