// The Coder tier's debugger drawer and creator tests: step a paused game and
// watch a variable change; record a check by playing, then break the game and
// see the check fail on the next build. Both panels pass axe.

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const status = (page: Page) => page.getByTestId("build-status");
const game = (page: Page) => page.getByRole("application", { name: "Game preview" });

async function ghostPanic(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /^Ghost Panic/ }).click();
  await expect(status(page)).toContainText("Up to date", { timeout: 30_000 });
}

async function codeTab(page: Page) {
  await page.getByRole("tab", { name: "Code" }).click();
  await expect(page.locator(".code-tier .cm-editor")).toBeVisible();
}

async function eject(page: Page) {
  await codeTab(page);
  await page.getByRole("button", { name: "Edit as code…" }).click();
  await page.getByRole("dialog", { name: /as code\?/ }).getByRole("button", { name: "Make a code project" }).click();
  await expect(page.getByText("Code project", { exact: true })).toBeVisible();
  await expect(status(page)).toContainText("Up to date", { timeout: 30_000 });
}

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

/** A watched value's decimal cell. */
const watched = (drawer: Locator, name: string) => drawer.locator(`tr[data-watch="${name}"] .watch-dec`);
const frameOf = async (drawer: Locator) => Number((await drawer.getByTestId("debugger-frame").textContent())!.replace(/\D/g, ""));

/** Presses fire on the game to leave the title screen. */
async function start(page: Page) {
  await game(page).focus();
  await page.keyboard.down(" ");
  await page.waitForTimeout(150);
  await page.keyboard.up(" ");
}

test("eject Ghost Panic, pause, step 10 frames, watch score change", async ({ page }) => {
  await ghostPanic(page);
  await eject(page);
  const drawer = page.getByTestId("debugger");
  await drawer.getByRole("button", { name: "Debugger" }).click();
  await expect(drawer.getByRole("table", { name: "Watch list" })).toBeVisible();
  // The kit's variables are watched from the start: an ejected game keeps their names.
  for (const name of ["score", "lives", "state", "heroX"]) await expect(drawer.locator(`tr[data-watch="${name}"]`)).toBeVisible();
  await expect(drawer.locator('tr[data-watch="score"] td').first()).toHaveText("$01A6");

  await start(page);
  await expect(watched(drawer, "state")).toHaveText("1", { timeout: 10_000 });
  await expect(drawer.getByTestId("frame-time")).toContainText(/Measured: \d+\.\d fps/);

  await drawer.getByRole("button", { name: "Pause" }).click();
  await expect(drawer.getByRole("button", { name: "Resume" })).toBeVisible();
  await expect(page.getByTestId("build-status").locator("..").getByRole("button", { name: "Resume" })).toBeVisible();
  // Settled on the frame it paused at.
  let frame = -1;
  await expect
    .poll(async () => {
      const was = frame;
      frame = await frameOf(drawer);
      return frame === was;
    }, { intervals: [300] })
    .toBe(true);
  // Hold right (from code, so focus can stay on the step button) and step until the cat eats the yarn.
  await page.evaluate(() => window.__cs!.emulator!.setInput({ up: false, down: false, left: false, right: true, fire: false }));
  const step10 = drawer.getByRole("button", { name: "Step 10 frames" });
  for (let i = 0; i < 30 && (await watched(drawer, "score").textContent()) === "0"; i++) {
    await step10.click();
    await expect.poll(() => frameOf(drawer)).toBe(frame + 10);
    frame += 10;
  }
  await expect(watched(drawer, "score")).toHaveText("10");
  await expect(drawer.locator('tr[data-watch="score"]')).toHaveClass(/changed/);
  await expect(drawer.getByTestId("debugger-said")).toContainText(/Frame \d+, after 10 frames\. Changed: .*score 0 to 10/);
  await expect(drawer.locator('tr[data-watch="score"] td.num').first()).toHaveText("$000010");

  // "." on the game steps one frame.
  await page.evaluate(() => window.__cs!.emulator!.setInput({ up: false, down: false, left: false, right: false, fire: false }));
  await game(page).focus();
  await page.keyboard.press(".");
  await expect.poll(() => frameOf(drawer)).toBe(frame + 1);
  await expect(drawer.getByTestId("debugger-said")).toContainText(`Frame ${frame + 1}, after 1 frame.`);

  // Any symbol from the build.
  await drawer.getByLabel("Watch a symbol").fill("levelnum");
  await drawer.getByRole("button", { name: "Add" }).click();
  await expect(watched(drawer, "levelnum")).toHaveText("1");
  await drawer.getByLabel("Watch a symbol").fill("nosuchthing");
  await drawer.getByRole("button", { name: "Add" }).click();
  await expect(drawer.getByRole("alert")).toHaveText("This build has no symbol called “nosuchthing”.");

  // The object table: the cat in slot 0, where heroX says.
  await drawer.getByText(/^Objects: \d+ of 24 slots in use/).click();
  const heroX = await watched(drawer, "heroX").textContent();
  await expect(drawer.getByTestId("object-table").locator("tbody tr").first().locator("td").nth(1)).toHaveText(heroX!);

  // The listing, on demand.
  await drawer.getByRole("button", { name: "Make the listing" }).click();
  await expect(drawer.getByRole("region", { name: "dasm listing" })).toContainText("loopslo", { timeout: 60_000 });

  expect(await axe(page), "debugger drawer").toEqual([]);
});

test("record a check, break the game, see the check fail", async ({ page }) => {
  await ghostPanic(page);
  await codeTab(page);
  const tests = page.getByTestId("creator-tests");
  await tests.getByRole("button", { name: "Record a check" }).click();
  // Recording restarts the game and hands it the keyboard.
  await expect(game(page)).toBeFocused();
  await expect(tests.getByRole("group", { name: "Recording" })).toContainText("Recording from power-on");
  await page.waitForTimeout(300);
  await start(page);
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(1500);
  await page.keyboard.up("ArrowRight");
  await tests.getByRole("button", { name: "Add a check" }).click();

  const form = tests.getByRole("form", { name: "New check" });
  await expect(form.getByLabel("Name")).toBeFocused();
  await form.getByLabel("Name").fill("Eats the first yarn");
  await form.getByLabel("Variable").selectOption("score");
  await expect(form.getByText("score is 10 now.")).toBeVisible();
  await form.getByLabel("Comparison").selectOption({ label: "is at least" });
  await expect(form.getByLabel("Value")).toHaveValue("10");
  await form.getByRole("button", { name: "Save the check" }).click();
  await expect(tests.getByTestId("tests-said")).toContainText("Saved “Eats the first yarn”: score is at least 10");

  const item = tests.getByTestId("test-list").getByRole("listitem");
  await expect(item).toHaveCount(1);
  await expect(item).toContainText("Eats the first yarn: score is at least 10");
  await expect(item.locator(".test-state")).toHaveText("Pass", { timeout: 30_000 });
  await expect(tests.getByTestId("tests-summary")).toHaveText("All 1 test passes.");
  expect(await axe(page), "tests passing").toEqual([]);

  // Break the game: the yarn ball next to the cat is gone.
  await page.evaluate(() =>
    window.__cs!.kitStore!.getState().edit((d) => {
      d.room.rows[1] = d.room.rows[1]!.replace("P  y", "P   ");
    }),
  );
  await expect(item.locator(".test-state")).toHaveText("Fail", { timeout: 60_000 });
  await expect(item).toContainText(/Failed at frame \d+\. score is 0, expected at least 10\./);
  await expect(tests.getByTestId("tests-summary")).toHaveText("1 of 1 test failed.");
  expect(await axe(page), "tests failing").toEqual([]);

  // Undo the break: it passes again.
  await page.evaluate(() => window.__cs!.kitStore!.getState().undo());
  await expect(item.locator(".test-state")).toHaveText("Pass", { timeout: 60_000 });

  // The test is kept with the game: it's there after a reload.
  await page.reload();
  await expect(status(page)).toContainText("Up to date", { timeout: 30_000 });
  await codeTab(page);
  await expect(page.getByTestId("test-list").getByRole("listitem")).toContainText("Eats the first yarn");
});
