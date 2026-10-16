// "Import a picture": a photo or drawing becomes a sprite frame in one undo
// step, from a file, a drop or the keyboard alone.

import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const PICTURE = new URL("./fixtures/drawing.png", import.meta.url).pathname;

async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /^Dodger/ }).click();
  await expect(page.getByTestId("build-status")).toContainText("Up to date", { timeout: 30_000 });
}

const hero = (page: Page) =>
  page.evaluate(() => {
    const g = window.__cs!.kitStore!.getState().project;
    const t = g.types[0]!;
    return { frame: t.frames[0]!, colors: g.palettes.find((p) => p.id === t.palette)!.colors };
  });

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

test("a picture becomes the thing's sprite, and one Undo puts it back", async ({ page }) => {
  await start(page);
  const before = await hero(page);
  await page.getByRole("button", { name: "Import a picture" }).click();
  const dialog = page.getByRole("dialog", { name: "Import a picture" });
  await expect(dialog).toBeVisible();
  expect(await axe(page)).toEqual([]);

  await dialog.getByTestId("import-picture-file").setInputFiles(PICTURE);
  await expect(dialog.getByRole("img", { name: /as it will look/ })).toBeVisible();
  await expect(dialog.getByRole("application", { name: "Part of the picture to use" })).toBeFocused();
  expect(await axe(page)).toEqual([]);

  await dialog.getByRole("button", { name: "Use this picture" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Import a picture" })).toBeFocused();
  const after = await hero(page);
  expect(after.frame).not.toEqual(before.frame);
  // The background went see-through and the drawing filled the middle.
  expect(after.frame[0]![0]).toBe("0");
  expect(after.frame[Math.floor(after.frame.length / 2)]).toMatch(/[123]/);
  expect(after.colors).toEqual(before.colors);

  await page.getByRole("button", { name: "Undo" }).click();
  expect((await hero(page)).frame).toEqual(before.frame);
});

test("works from the keyboard, with new colors, as one undo step", async ({ page }) => {
  await start(page);
  const before = await hero(page);
  await page.getByRole("button", { name: "Import a picture" }).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Import a picture" });

  // Drop the picture onto the dialog.
  const bytes = [...readFileSync(PICTURE)];
  await dialog.locator(".ip").evaluate((el, data) => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(data)], "drawing.png", { type: "image/png" }));
    el.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, bytes);
  const crop = dialog.getByRole("application", { name: "Part of the picture to use" });
  await expect(crop).toBeFocused();
  await page.keyboard.press("+");
  await page.keyboard.press("ArrowLeft");

  await dialog.getByRole("radio", { name: "Use the colors it has now" }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(dialog.getByRole("radio", { name: "Pick new colors from the picture" })).toHaveAttribute("aria-checked", "true");
  await dialog.getByRole("button", { name: "Use this picture" }).focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();

  const after = await hero(page);
  expect(after.frame).not.toEqual(before.frame);
  expect(after.colors).not.toEqual(before.colors);
  await page.getByRole("button", { name: "Undo" }).click();
  expect(await hero(page)).toEqual(before);
});

test("Escape closes without changing anything", async ({ page }) => {
  await start(page);
  const before = await hero(page);
  await page.getByRole("button", { name: "Import a picture" }).click();
  await page.getByTestId("import-picture-file").setInputFiles(PICTURE);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(await hero(page)).toEqual(before);
});
