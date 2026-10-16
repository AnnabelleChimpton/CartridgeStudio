// The game kit editor: pick a starter, change things, the room and the rules,
// and the game rebuilds; the CPU meter guards the console's frame budget.

import { expect, test, type Page } from "@playwright/test";

async function start(page: Page, preset: "Cat vs. Vacuums" | "Yarn Hunt" | "Rock Fall" | "Ghost Panic") {
  await page.goto("/");
  await page.getByRole("button", { name: new RegExp(`^${preset.replace(".", "\\.")}`) }).click();
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
  await page.getByRole("tab", { name: "Code" }).click();
  await expect(page.locator(".code-tier .cm-editor")).toBeVisible();
}
/** The generated game.bas (the code view only renders the lines on screen). */
const generated = (page: Page) => page.evaluate(() => (window.__cs!.last?.kind === "built" ? window.__cs!.last.source : ""));
const game = (page: Page) => page.evaluate(() => window.__cs!.kitStore!.getState().project);

/**
 * Drags a rule by its handle onto another rule. Chrome needs real mouse moves
 * to start a drag; WebKit only drops after dragTo's single jump.
 */
async function dragRule(page: Page, browserName: string, from: number, to: number) {
  const handle = page.locator("li.rule").nth(from).getByRole("button", { name: `Move rule ${from + 1}`, exact: true });
  const target = page.locator("li.rule").nth(to);
  // Both rules on screen, away from the edges (the guide can push the list down).
  await page.locator("li.rule").nth(Math.round((from + to) / 2)).evaluate((el) => el.scrollIntoView({ block: "center" }));
  if (browserName !== "chromium") return handle.dragTo(target);
  const a = (await handle.boundingBox())!;
  const b = (await target.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 10, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 5 });
  await page.mouse.up();
}

/** Drags across room cells (col, row) on the 20×11 room canvas. */
async function paint(page: Page, from: [number, number], to: [number, number], button: "left" | "right" = "left") {
  await openTab(page, "Room");
  await page.getByLabel("Room grid").scrollIntoViewIfNeeded();
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
  await start(page, "Yarn Hunt");
  await expect(page.getByLabel("Game title")).toHaveValue("Yarn Hunt");
  await expect(page.locator(".topbar").getByText("Game kit")).toBeVisible();
  await expect(page.getByTestId("cpu-meter")).toContainText("How busy the console is");
  await expect(page.getByRole("meter", { name: "How busy the console is" })).toHaveAttribute("aria-valuetext", /Room to spare|Nearly full/);
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
  await start(page, "Rock Fall");
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
  await start(page, "Rock Fall");
  await page.getByRole("button", { name: "Add a thing" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Comet");
  await page.getByLabel("How it moves").selectOption({ label: "Chases the player" });
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
  await expect.poll(() => generated(page)).toContain("rem Comet");
});

test("rules use the game's own things", async ({ page }) => {
  // The Dodger: it already shows a timer, so a timer rule has room in the budget (the HUD digits cost 7).
  await start(page, "Rock Fall");
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
  await expect.poll(() => generated(page)).toContain("45 seconds pass");
});

test("the CPU meter stops a game that's too busy", async ({ page }) => {
  await start(page, "Yarn Hunt");
  // Ghosts chase through walls, the costliest behaviour: three more push the maze over budget.
  await openTab(page, "Room");
  await page.getByRole("radio", { name: "Paint Dust ghost" }).click();
  await paint(page, [10, 5], [12, 5]);
  await expect(page.getByTestId("cpu-meter")).toContainText("Too busy");
  // The meter names the changes that would make it fit.
  await expect(page.getByTestId("cpu-meter")).toContainText("Dust ghosts out of the room");
  await expect(page.getByTestId("build-errors")).toContainText("too busy for the console", { timeout: 30_000 });
  await expect(page.getByTestId("build-errors")).toContainText("The meter under the game lists what to take out.");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("build-status")).toContainText("Up to date", { timeout: 30_000 });
});

test("a kit game survives a reload and round-trips through a game file", async ({ page }) => {
  await start(page, "Cat vs. Vacuums");
  await page.getByLabel("Game title").fill("Moon Patrol-ish");
  await page.waitForTimeout(800); // autosave
  await page.reload();
  await expect(page.getByLabel("Game title")).toHaveValue("Moon Patrol-ish", { timeout: 30_000 });

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Save game file" }).click()]);
  const chunks: Buffer[] = [];
  for await (const c of await download.createReadStream()) chunks.push(c as Buffer);
  const file = Buffer.concat(chunks);

  // Switch to another game, then open the file again.
  await page.getByRole("button", { name: "Game", exact: true }).click();
  await page.getByRole("button", { name: "New game" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^Rock Fall/ }).click();
  await expect(page.getByLabel("Game title")).toHaveValue("Rock Fall");
  await page.getByLabel("Open game file").setInputFiles({ name: download.suggestedFilename(), mimeType: "application/zip", buffer: file });
  await expect(page.getByLabel("Game title")).toHaveValue("Moon Patrol-ish");
  await expect(page.locator(".topbar").getByText("Game kit")).toBeVisible();
});

test("Ghost Panic opens, builds, and every rule can be edited", async ({ page }) => {
  await start(page, "Ghost Panic");
  await expect(page.getByLabel("Game title")).toHaveValue("Ghost Panic");
  await openTab(page, "Rules");
  const g = await game(page);
  await expect(page.locator("li.rule")).toHaveCount(g.rules.length);
  await expect(page.locator(".rule-sentence.readonly")).toHaveCount(0);
  // The combo bonus: only if, a counter test and its value.
  await expect(page.getByLabel("Rule 3 condition 1 counter")).toHaveValue("combo");
  await expect(page.getByLabel("Rule 3 condition 1 test")).toHaveValue("gte");
  await expect(page.getByLabel("Rule 3 action 1 points")).toHaveValue("300");
  // Catnip: set the combo, and turn every ghost for 6 seconds.
  await expect(page.getByLabel("Rule 2 action 3", { exact: true })).toHaveValue("turnAll");
  await expect(page.getByLabel("Rule 2 action 3 seconds")).toHaveValue("6");
  await expect(page.getByLabel("Rule 6 trigger")).toHaveValue("onHazard");
  await expect(page.getByLabel("Rule 8 trigger")).toHaveValue("every");
  await expect(page.getByLabel("Rule 10 counter")).toHaveValue("level");

  // Changing one word changes just that word.
  await page.getByLabel("Rule 2 action 3 seconds").fill("8");
  expect((await game(page)).rules[1]!.then[2]).toEqual({ turnAll: { type: "ghost", into: "scared", seconds: 8 } });
  await openTab(page, "Room");
  await expect(page.getByRole("radio", { name: "Paint Spikes" })).toBeVisible();
});

test("builds a key-and-door rule with a counter and only if", async ({ page }) => {
  await start(page, "Rock Fall");
  for (const name of ["Key", "Door"]) {
    await page.getByRole("button", { name: "Add a thing" }).click();
    await page.getByLabel("Name", { exact: true }).fill(name);
  }
  await openTab(page, "Room");
  await page.getByRole("radio", { name: "Paint Key" }).click();
  await paint(page, [3, 8], [3, 8]);
  await page.getByRole("radio", { name: "Paint Door" }).click();
  await paint(page, [16, 8], [16, 8]);

  await openTab(page, "Game");
  await page.getByRole("button", { name: "Add counter" }).click();
  await page.getByLabel("Counter 1 name").fill("Keys");
  await page.getByLabel("Show on screen").check();

  await openTab(page, "Rules");
  const before = (await game(page)).rules.length;
  const key = before + 1;
  const door = before + 2;
  await page.getByRole("button", { name: "Add rule" }).click();
  await page.getByLabel(`Rule ${key} second thing`).selectOption({ label: "Key" });
  await page.getByLabel(`Rule ${key} action 1`, { exact: true }).selectOption({ label: "remove" });
  await page.getByLabel(`Rule ${key} action 1 which`).selectOption({ label: "the Key" });
  await page.locator("li.rule").nth(key - 1).getByRole("button", { name: "+ another action" }).click();
  await page.getByLabel(`Rule ${key} action 2`, { exact: true }).selectOption({ label: "add" });
  await expect(page.getByLabel(`Rule ${key} action 2 counter`)).toHaveValue("counter-1");

  await page.getByRole("button", { name: "Add rule" }).click();
  await page.getByLabel(`Rule ${door} second thing`).selectOption({ label: "Door" });
  const doorRule = page.locator("li.rule").nth(door - 1);
  await doorRule.getByRole("button", { name: "+ only if" }).click();
  await page.getByLabel(`Rule ${door} condition 1 counter`).selectOption({ label: "Keys" });
  await page.getByLabel(`Rule ${door} condition 1 test`).selectOption({ label: "is at least" });
  await page.getByLabel(`Rule ${door} condition 1 value`).fill("1");
  await page.getByLabel(`Rule ${door} action 1`, { exact: true }).selectOption({ label: "remove" });
  await doorRule.getByRole("button", { name: "+ another action" }).click();
  await page.getByLabel(`Rule ${door} action 2`, { exact: true }).selectOption({ label: "take away" });
  await doorRule.getByRole("button", { name: "+ another action" }).click();
  await page.getByLabel(`Rule ${door} action 3`, { exact: true }).selectOption({ label: "add points" });
  const n = await buildCount(page);
  await page.getByLabel(`Rule ${door} action 3 points`).selectOption("100");

  const g = await game(page);
  const ids = Object.fromEntries(g.types.map((t) => [t.label, t.id]));
  expect(g.counters).toEqual([{ id: "counter-1", label: "Keys", start: 0, show: true }]);
  expect(g.rules[key - 1]).toEqual({ when: { touch: ["ship", ids.Key] }, then: [{ remove: "second" }, { add: ["counter-1", 1] }] });
  expect(g.rules[door - 1]).toEqual({
    when: { touch: ["ship", ids.Door] },
    if: [{ counter: "counter-1", op: "gte", value: 1 }],
    then: [{ remove: "second" }, { take: ["counter-1", 1] }, { score: 100 }],
  });
  expect((await nextBuild(page, n)).kind).toBe("built");

  // Removing the counter takes its conditions and actions with it.
  await openTab(page, "Game");
  await page.getByRole("button", { name: "Remove Keys" }).click();
  const after = await game(page);
  expect(after.rules[door - 1]).toEqual({ when: { touch: ["ship", ids.Door] }, then: [{ remove: "second" }, { score: 100 }] });
});

test("turns, timed turns and the newer triggers can be chosen", async ({ page }) => {
  await start(page, "Ghost Panic");
  await openTab(page, "Rules");
  // Rule 5: Cat touches Dust ghost. Make it every 20 seconds, turning every Dust ghost into a Scared ghost for 3 seconds.
  await page.getByLabel("Rule 5 trigger").selectOption({ label: "every" });
  await page.getByLabel("Rule 5 seconds").fill("20");
  await page.getByLabel("Rule 5 action 1", { exact: true }).selectOption({ label: "turn every" });
  await page.getByLabel("Rule 5 action 1 into").selectOption({ label: "Scared ghost" });
  await page.getByRole("button", { name: "Rule 5 action 1: only for some seconds" }).click();
  await page.getByLabel("Rule 5 action 1 seconds").fill("3");
  expect((await game(page)).rules[4]).toEqual({
    when: { every: 20 },
    then: [{ turnAll: { type: "ghost", into: "scared", seconds: 3 } }, { sound: "down" }],
  });
  // A thing on a goal, turning into something else for good.
  await page.getByLabel("Rule 5 trigger").selectOption({ label: "is on a goal" });
  await page.getByLabel("Rule 5 thing").selectOption({ label: "Dust ghost" });
  await page.getByLabel("Rule 5 action 1", { exact: true }).selectOption({ label: "turn" });
  await expect(page.getByLabel("Rule 5 action 1 which")).toHaveValue("first");
  await page.getByLabel("Rule 5 action 1 into").selectOption({ label: "Fast ghost" });
  // A counter reaching a number.
  await page.getByLabel("Rule 7 trigger").selectOption({ label: "reaches" });
  await page.getByLabel("Rule 7 counter").selectOption({ label: "Combo" });
  await page.getByLabel("Rule 7 target").fill("5");
  await page.getByLabel("Rule 7 action 1", { exact: true }).selectOption({ label: "go to the next level" });
  const g = await game(page);
  expect(g.rules[4]!.when).toEqual({ onTile: ["ghost", "goal"] });
  expect(g.rules[4]!.then[0]).toEqual({ turn: { who: "first", into: "fast-ghost" } });
  expect(g.rules[6]).toEqual({ when: { reaches: ["combo", 5] }, then: [{ nextLevel: true }, { sound: "down" }] });
});

test("rules can be reordered by keyboard and by dragging", async ({ page, browserName }) => {
  await start(page, "Ghost Panic");
  await openTab(page, "Rules");
  const order = async () => (await game(page)).rules.map((r) => JSON.stringify(r));
  const start0 = await order();

  await page.getByRole("button", { name: "Move rule 4" }).focus();
  await page.keyboard.press("ArrowUp");
  expect(await order()).toEqual([start0[0], start0[1], start0[3], start0[2], ...start0.slice(4)]);
  // Focus follows the rule, so pressing again keeps moving it.
  await expect(page.getByRole("button", { name: "Move rule 3" })).toBeFocused();
  await expect(page.getByRole("status").filter({ hasText: "Rule 4 is now rule 3." })).toBeAttached();
  await page.keyboard.press("ArrowDown");
  expect(await order()).toEqual(start0);

  await dragRule(page, browserName, 0, 2);
  await expect.poll(order).toEqual([start0[1], start0[2], start0[0], ...start0.slice(3)]);
  await page.getByRole("button", { name: "Undo" }).click();
  expect(await order()).toEqual(start0);
});

test("deleting a rule announces it and keeps focus in the list", async ({ page }) => {
  await start(page, "Rock Fall");
  await openTab(page, "Rules");
  const count = (await game(page)).rules.length;
  await page.getByRole("button", { name: "Delete rule 2" }).click();
  expect((await game(page)).rules.length).toBe(count - 1);
  await expect(page.getByRole("button", { name: "Move rule 2", exact: true })).toBeFocused();
  await expect(page.getByRole("status").filter({ hasText: "Rule 2 deleted. Undo brings it back." })).toBeAttached();
  // The last one: focus goes to Add rule.
  for (let n = count - 1; n > 0; n--) await page.getByRole("button", { name: `Delete rule ${n}` }).click();
  await expect(page.getByRole("button", { name: "Add rule" })).toBeFocused();
  await expect(page.getByTestId("rules-empty")).toBeVisible();
});

test("a thing can be put in the room or made the player, and the title screen follows the name", async ({ page }) => {
  await start(page, "Yarn Hunt");
  await page.getByRole("button", { name: "Add a thing" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Lily");
  await page.getByRole("button", { name: "Put it in the room" }).click();
  await expect(page.getByRole("tab", { name: "Room" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("radio", { name: "Paint Lily" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("Room grid")).toBeFocused();

  await openTab(page, "Things");
  await page.locator(".sprite-select", { hasText: "Lily" }).click();
  await page.getByRole("button", { name: "Make this my player" }).click();
  const g = await game(page);
  expect(g.types.find((t) => t.id === "cat")!.label).toBe("Lily");
  await expect(page.locator(".sprite-select[aria-pressed=true]", { hasText: "Lily" })).toBeVisible();
  await expect(page.getByTestId("build-status")).toContainText("Up to date", { timeout: 30_000 });

  await page.getByLabel("Game title").fill("Lily's Yarn");
  expect((await game(page)).text.title).toBe("Lily's Yarn");
  await openTab(page, "Game");
  await page.getByLabel("Title screen", { exact: true }).fill("Press fire, Lily");
  await page.getByLabel("Game title").fill("Lily's Game");
  expect((await game(page)).text.title).toBe("Press fire, Lily");
});
