// The game kit editor: pick a starter, change things, the room and the rules,
// and the game rebuilds; the CPU meter guards the console's frame budget.

import { expect, test, type Page } from "@playwright/test";

async function start(page: Page, preset: "Shooter" | "Maze" | "Dodger" | "Ghost Panic") {
  await page.goto("/");
  await page.getByRole("button", { name: new RegExp(`^${preset}`) }).click();
  await expect(page.getByTestId("build-status")).toContainText("Up to date", { timeout: 30_000 });
}

const buildCount = (page: Page) => page.evaluate(() => window.__cs!.builds.length);
async function nextBuild(page: Page, after: number) {
  await expect.poll(() => buildCount(page), { timeout: 30_000 }).toBeGreaterThan(after);
  await expect(page.getByTestId("build-status")).not.toHaveText("Building…");
  return page.evaluate(() => window.__cs!.builds[0]!);
}
const openTab = (page: Page, name: "Things" | "Room" | "Rules" | "Game") => page.getByRole("tab", { name }).click();
async function viewCode(page: Page) {
  await page.locator("details.dev").evaluate((d: HTMLDetailsElement) => void (d.open = true));
  await page.getByText("View code").click();
}
const game = (page: Page) => page.evaluate(() => window.__cs!.kitStore!.getState().project);

/** Drags across room cells (col, row) on the 20×11 room canvas. */
async function paint(page: Page, from: [number, number], to: [number, number], button: "left" | "right" = "left") {
  await openTab(page, "Room");
  const box = (await page.getByLabel("Room grid").boundingBox())!;
  const at = ([c, r]: [number, number]) => ({ x: box.x + ((c + 0.5) * box.width) / 20, y: box.y + ((r + 0.5) * box.height) / 11 });
  const a = at(from);
  const b = at(to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down({ button });
  await page.mouse.move(b.x, b.y, { steps: 2 });
  await page.mouse.up({ button });
}

test("starts from a kit preset and plays it", async ({ page }) => {
  await start(page, "Maze");
  await expect(page.getByLabel("Game title")).toHaveValue("Yarn Hunt");
  await expect(page.locator(".topbar").getByText("Game kit")).toBeVisible();
  await expect(page.getByTestId("cpu-meter")).toContainText("%");
  // Animation alternates frames every 16 frames: sample across 48.
  const pictures = await page.evaluate(async () => {
    const e = window.__cs!.emulator!;
    const seen = new Set<string>();
    for (let i = 0; i < 8; i++) {
      seen.add(await e.framebufferHash());
      await e.stepFrames(6);
    }
    return seen.size;
  });
  expect(pictures).toBeGreaterThan(1);
});

test("painting the room rebuilds the game, and a drag is one undo step", async ({ page }) => {
  await start(page, "Dodger");
  const n = await buildCount(page);
  await paint(page, [3, 6], [12, 6]);
  const g = await game(page);
  expect(g.room.rows[6]!.slice(3, 13)).toBe("##########");
  expect((await nextBuild(page, n)).kind).toBe("built");

  await paint(page, [5, 6], [7, 6], "right");
  expect((await game(page)).room.rows[6]!.slice(3, 13)).toBe("##   #####");
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await game(page)).room.rows[6]!.slice(3, 13)).toBe("##########");
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await game(page)).room.rows[6]!.trim()).toBe("");
});

test("adds a thing, places it and makes it chase the player", async ({ page }) => {
  await start(page, "Dodger");
  await page.getByRole("button", { name: "Add a thing" }).click();
  await page.getByLabel("Thing name").fill("Comet");
  await page.getByLabel("Behaviour").selectOption({ label: "Chases the player" });
  await openTab(page, "Room");
  await page.getByRole("radio", { name: "Paint Comet" }).click();
  const n = await buildCount(page);
  await paint(page, [15, 4], [15, 4]);
  const g = await game(page);
  const comet = g.types.find((t) => t.label === "Comet")!;
  expect(comet.behaviour).toBe("chase");
  expect(g.room.rows[4]![15]).toBe(Object.entries(g.room.legend).find(([, v]) => v === comet.id)![0]);
  expect((await nextBuild(page, n)).kind).toBe("built");
  await viewCode(page);
  await expect(page.getByTestId("game-bas")).toContainText("rem Comet");
});

test("rules use the game's own things", async ({ page }) => {
  // The Dodger: it already shows a timer, so a timer rule has room in the budget (the HUD digits cost 7).
  await start(page, "Dodger");
  const rules = (await game(page)).rules.length;
  await openTab(page, "Rules");
  await page.getByRole("button", { name: "Add rule" }).click();
  const n = rules + 1;
  await page.getByLabel(`Rule ${n} trigger`).selectOption({ label: "seconds have passed" });
  await page.getByLabel(`Rule ${n} seconds`).fill("45");
  await page.getByLabel(`Rule ${n} action 1`, { exact: true }).selectOption({ label: "lose the game" });
  const g = await game(page);
  expect(g.rules.at(-1)).toEqual({ when: { timer: 45 }, then: [{ lose: true }] });
  await nextBuild(page, await buildCount(page) - 1);
  await viewCode(page);
  await expect(page.getByTestId("game-bas")).toContainText("45 seconds pass");
});

test("the CPU meter stops a game that's too busy", async ({ page }) => {
  await start(page, "Maze");
  // Ghosts chase through walls, the costliest behaviour: three more push the maze over budget.
  await openTab(page, "Room");
  await page.getByRole("radio", { name: "Paint Dust ghost" }).click();
  await paint(page, [10, 5], [12, 5]);
  await expect(page.getByTestId("cpu-meter")).toContainText("Too busy");
  await expect(page.getByTestId("build-errors")).toContainText("too busy for the console", { timeout: 30_000 });
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("build-status")).toContainText("Up to date", { timeout: 30_000 });
});

test("a kit game survives a reload and round-trips through a game file", async ({ page }) => {
  await start(page, "Shooter");
  await page.getByLabel("Game title").fill("Moon Patrol-ish");
  await page.waitForTimeout(800); // autosave
  await page.reload();
  await expect(page.getByLabel("Game title")).toHaveValue("Moon Patrol-ish", { timeout: 30_000 });

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Save game file" }).click()]);
  const chunks: Buffer[] = [];
  for await (const c of await download.createReadStream()) chunks.push(c as Buffer);
  const file = Buffer.concat(chunks);

  // Switch to another game, then open the file again.
  page.on("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "New game" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^Dodger/ }).click();
  await expect(page.getByLabel("Game title")).toHaveValue("Rock Fall");
  await page.getByLabel("Open game file").setInputFiles({ name: download.suggestedFilename(), mimeType: "application/zip", buffer: file });
  await expect(page.getByLabel("Game title")).toHaveValue("Moon Patrol-ish");
  await expect(page.locator(".topbar").getByText("Game kit")).toBeVisible();
});

test("Ghost Panic opens, builds, and shows its newer rules as sentences", async ({ page }) => {
  await start(page, "Ghost Panic");
  await expect(page.getByLabel("Game title")).toHaveValue("Ghost Panic");
  await openTab(page, "Rules");
  await expect(page.getByText("When Cat touches Scared ghost, only if Combo is at least 1: add 300 points and play Chime.")).toBeVisible();
  // Plain rules stay editable.
  await expect(page.getByLabel("Rule 1 trigger")).toHaveValue("touch");
  await openTab(page, "Room");
  await expect(page.getByRole("radio", { name: "Paint Spikes" })).toBeVisible();
});
