// My games: every game made in this browser stays, on the start screen with
// its picture. New games and opened files add to it; old single-slot saves and
// Classic shooter files move in (the Classic shooter as a code project).

import { readFileSync } from "node:fs";
import { strToU8, zipSync } from "fflate";
import { expect, test, type Page } from "@playwright/test";
import { autosaved, savedThumbnails } from "./wait.ts";

const templates = new URL("../../templates/", import.meta.url).pathname;
const classicSample = JSON.parse(readFileSync(`${templates}fixed-shooter/sample.json`, "utf8")) as { title: string };
const maze = JSON.parse(readFileSync(`${templates}kit/games/maze.json`, "utf8")) as { title: string };

const status = (page: Page) => page.getByTestId("build-status");
const myGames = (page: Page) => page.getByRole("region", { name: "My games" });
const card = (page: Page, title: string) => myGames(page).getByRole("listitem").filter({ has: page.getByRole("button", { name: new RegExp(`^${title}`) }) });

async function start(page: Page, preset: RegExp) {
  await page.getByRole("button", { name: preset }).click();
  await expect(status(page)).toContainText("Built in", { timeout: 30_000 });
}

async function newGameDialog(page: Page) {
  await page.getByRole("button", { name: "Game", exact: true }).click();
  await page.getByRole("button", { name: "New game" }).click();
  return page.getByRole("dialog", { name: "What do you want to make?" });
}

/** Runs `fn` on the app's IndexedDB store, then closes it. */
const withStore = (page: Page, entries: Record<string, unknown>, remove: string[]) =>
  page.evaluate(
    ({ entries, remove }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("cartridge-studio");
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("projects", "readwrite");
          const store = tx.objectStore("projects");
          for (const k of remove) store.delete(k);
          for (const [k, v] of Object.entries(entries)) store.put(v, k);
          tx.oncomplete = () => (db.close(), resolve());
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
    { entries, remove },
  );

test("new games add to My games, and each one opens, renames, duplicates and deletes", async ({ page }) => {
  await page.goto("/");
  // A first visit has no games yet.
  await expect(page.getByText("What do you want to make?")).toBeVisible();
  await expect(myGames(page)).toHaveCount(0);
  await start(page, /^Yarn Hunt/);
  await page.getByLabel("Game title").fill("Mine");
  await autosaved(page, "Mine");
  // The picture is taken a moment after the rebuild.
  await expect.poll(() => savedThumbnails(page), { timeout: 10_000 }).toBe(1);

  // Starting another game keeps this one: no "will be replaced".
  let chooser = await newGameDialog(page);
  await expect(card(page, "Mine")).toContainText("open now");
  await chooser.getByRole("button", { name: /^Rock Fall/ }).click();
  await expect(page.getByLabel("Game title")).toHaveValue("Rock Fall");
  await expect(status(page)).not.toHaveText("Building…");

  chooser = await newGameDialog(page);
  await expect(myGames(page).getByRole("listitem")).toHaveCount(2);
  await expect(card(page, "Mine").locator("img")).toHaveCount(1);
  await card(page, "Mine").getByRole("button", { name: /^Mine/ }).click();
  await expect(page.getByLabel("Game title")).toHaveValue("Mine");
  await expect(chooser).toBeHidden();

  // Rename a game that isn't open.
  chooser = await newGameDialog(page);
  await chooser.getByRole("button", { name: "Rename Rock Fall" }).click();
  const rename = page.getByRole("dialog", { name: "Rename “Rock Fall”" });
  await rename.getByLabel("New name").fill("Pebbles");
  await rename.getByRole("button", { name: "Rename" }).click();
  await expect(card(page, "Pebbles")).toBeVisible();
  // Renaming the open game renames it in the editor too.
  await chooser.getByRole("button", { name: "Rename Mine" }).click();
  await page.getByRole("dialog", { name: "Rename “Mine”" }).getByLabel("New name").fill("Yours");
  await page.getByRole("dialog", { name: "Rename “Mine”" }).getByRole("button", { name: "Rename" }).click();
  await expect(card(page, "Yours")).toContainText("open now");

  await chooser.getByRole("button", { name: "Duplicate Pebbles" }).click();
  await expect(card(page, "Pebbles \\(copy\\)")).toBeVisible();
  await expect(myGames(page).getByRole("listitem")).toHaveCount(3);

  // Deleting asks first; Cancel keeps it.
  await chooser.getByRole("button", { name: "Delete Pebbles (copy)" }).click();
  const ask = page.getByRole("dialog", { name: "Delete “Pebbles (copy)”?" });
  await ask.getByRole("button", { name: "Cancel" }).click();
  await expect(myGames(page).getByRole("listitem")).toHaveCount(3);
  await chooser.getByRole("button", { name: "Delete Pebbles (copy)" }).click();
  await ask.getByRole("button", { name: "Delete game" }).click();
  await expect(myGames(page).getByRole("listitem")).toHaveCount(2);
  await expect(myGames(page).getByRole("heading", { name: "My games" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Game title")).toHaveValue("Yours");

  // A reload opens the game that was open, and the others are still there.
  await page.reload();
  await expect(page.getByLabel("Game title")).toHaveValue("Yours", { timeout: 30_000 });
  await newGameDialog(page);
  await expect(myGames(page).getByRole("listitem").getByRole("button", { name: /^(Yours|Pebbles)/ })).toHaveCount(2);
});

test("deleting the open game goes back to the start screen", async ({ page }) => {
  await page.goto("/");
  await start(page, /^Rock Fall/);
  const chooser = await newGameDialog(page);
  await chooser.getByRole("button", { name: "Delete Rock Fall" }).click();
  await page.getByRole("dialog", { name: "Delete “Rock Fall”?" }).getByRole("button", { name: "Delete game" }).click();
  await expect(page.getByRole("heading", { name: "What do you want to make?" })).toBeVisible();
  await expect(myGames(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "What do you want to make?" })).toBeVisible();
});

test("an edit is saved when the page goes away, even inside the autosave pause", async ({ page }) => {
  await page.goto("/");
  await start(page, /^Yarn Hunt/);
  await page.getByLabel("Game title").fill("Quick Exit");
  // No wait: leaving the page writes the save still waiting.
  await page.reload();
  await expect(page.getByLabel("Game title")).toHaveValue("Quick Exit", { timeout: 30_000 });
});

test("a Classic shooter game file opens as a code project, and says so", async ({ page }) => {
  await page.goto("/");
  await start(page, /^Yarn Hunt/);
  const file = zipSync({
    "cartridge.json": strToU8(JSON.stringify({ format: "cartridge-studio", version: 1, appVersion: "0.1.0" })),
    "project.json": strToU8(JSON.stringify(classicSample)),
  });
  await page.getByLabel("Open game file").setInputFiles({ name: "classic.cartridge", mimeType: "application/zip", buffer: Buffer.from(file) });
  await expect(page.getByText("Code project", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Game title")).toHaveValue(classicSample.title);
  await expect(page.getByRole("status").filter({ hasText: "Classic shooter editor, which has been retired" })).toContainText(
    "It now opens as a code project",
  );
  await expect(status(page)).toContainText("Built in", { timeout: 30_000 });
  // The kit game is still in My games.
  await newGameDialog(page);
  await expect(card(page, "Yarn Hunt")).toBeVisible();
});

test("saves from before My games move into it on first load", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("What do you want to make?")).toBeVisible();
  // As an older version left them: one kit game, one Classic shooter game, no library yet.
  await withStore(page, { "current-kit": maze, current: classicSample, mode: "kit" }, ["library", "open"]);
  await page.reload();
  await expect(page.getByLabel("Game title")).toHaveValue(maze.title, { timeout: 30_000 });
  await expect(page.getByText("Game kit", { exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Classic shooter editor" })).toBeAttached();
  await newGameDialog(page);
  await expect(myGames(page).getByRole("listitem")).toHaveCount(2);
  await expect(card(page, classicSample.title.replace(".", "\\."))).toContainText("Code project");
  await card(page, classicSample.title.replace(".", "\\.")).getByRole("button", { name: new RegExp(`^${classicSample.title.replace(".", "\\.")}`) }).click();
  await expect(page.getByText("Code project", { exact: true })).toBeVisible();
  await expect(status(page)).toContainText("Built in", { timeout: 30_000 });
});
