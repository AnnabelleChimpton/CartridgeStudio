// Code projects: eject a kit game, edit game.bas in CodeMirror, see the
// preview rebuild and errors land on their lines, and keep it in a
// .cartridge file. Also "See the code" in the kit editor.

import AxeBuilder from "@axe-core/playwright";
import { unzipSync } from "fflate";
import { expect, test, type Page } from "@playwright/test";

const status = (page: Page) => page.getByTestId("build-status");
const buildCount = (page: Page) => page.evaluate(() => window.__cs!.builds.length);
const source = (page: Page) => page.evaluate(() => window.__cs!.codeStore!.getState().project.source);
const editor = (page: Page) => page.getByRole("textbox", { name: "game.bas", exact: true });

async function ghostPanic(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /^Ghost Panic/ }).click();
  await expect(status(page)).toContainText("Up to date", { timeout: 30_000 });
}

async function seeTheCode(page: Page) {
  await page.getByRole("tab", { name: "Code" }).click();
  await expect(page.locator(".code-tier .cm-editor")).toBeVisible();
}

async function eject(page: Page) {
  await seeTheCode(page);
  await page.getByRole("button", { name: "Edit as code…" }).click();
  const dialog = page.getByRole("dialog", { name: /as code\?/ });
  await expect(dialog).toContainText("one way");
  await dialog.getByRole("button", { name: "Make a code project" }).click();
  await expect(page.getByText("Code project", { exact: true })).toBeVisible();
  await expect(status(page)).toContainText("Up to date", { timeout: 30_000 });
}

/** Selects the first match of `text` with the editor's own search, then closes the search panel. */
async function find(page: Page, text: string) {
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+f");
  const field = page.getByRole("textbox", { name: "Find" });
  await expect(field).toBeFocused();
  // Typed, not filled: the search panel reads its query on key events.
  await page.keyboard.type(text);
  await field.press("Enter");
  await field.press("Escape");
  await expect(editor(page)).toBeFocused();
}

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

test("eject Ghost Panic, change the starting lives, break it, fix it, save and reopen it", async ({ page }) => {
  await ghostPanic(page);
  const kitSource = await page.evaluate(() => window.__cs!.last!.kind === "built" && window.__cs!.last!.source);
  await eject(page);
  // The same program, now yours.
  expect((await source(page)).split("\n").length).toBe((kitSource as string).split("\n").length);
  await expect(page.getByTestId("rom-space")).toContainText(/bytes free of 32 KB/);

  // Change a line: the preview rebuilds with it.
  let n = await buildCount(page);
  await find(page, "lives = 3");
  await page.keyboard.type("lives = 7");
  await expect.poll(() => buildCount(page), { timeout: 30_000 }).toBeGreaterThan(n);
  await expect(status(page)).toContainText("Up to date", { timeout: 30_000 });
  expect(await page.evaluate(() => window.__cs!.last!.kind === "built" && window.__cs!.last!.source)).toContain(" lives = 7");

  // A syntax error is marked on its line, in the gutter and the list.
  const line = (await source(page)).split("\n").findIndex((l) => l.includes("lives = 7")) + 2;
  n = await buildCount(page);
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("frobnicate 3");
  await expect(status(page)).toContainText("Doesn't build yet", { timeout: 30_000 });
  expect((await source(page)).split("\n")[line - 1]).toBe(" frobnicate 3");
  const problem = page.getByTestId("code-problems").getByRole("button", { name: `Error line ${line}: unknown keyword 'frobnicate'` });
  await expect(problem).toBeVisible();
  const marker = page.locator(".cm-gutter-lint .cm-lint-marker-error");
  await expect(marker).toHaveCount(1);
  const number = page.locator(".cm-lineNumbers .cm-gutterElement", { hasText: new RegExp(`^${line}$`) });
  const [m, l] = [(await marker.boundingBox())!, (await number.boundingBox())!];
  expect(Math.abs(m.y + m.height / 2 - (l.y + l.height / 2))).toBeLessThan(4);

  // The list takes you there.
  await page.keyboard.press("ControlOrMeta+Home");
  await problem.click();
  await expect(editor(page)).toBeFocused();
  await expect(page.locator(".cm-activeLine")).toHaveText(" frobnicate 3");

  // Fix it; then save the game file.
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(" rem fixed");
  await expect(status(page)).toContainText("Up to date", { timeout: 30_000 });
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Save game file" }).click()]);
  expect(download.suggestedFilename()).toBe("ghost-panic.cartridge");
  const chunks: Buffer[] = [];
  for await (const c of await download.createReadStream()) chunks.push(c as Buffer);
  const saved = await source(page);

  // The kit game was kept; go back to it, then open the code project's file.
  await page.getByRole("button", { name: /Back to the kit game/ }).click();
  await expect(page.getByText("Game kit", { exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Rules" })).toBeVisible();
  await page.getByLabel("Open game file").setInputFiles({ name: "ghost-panic.cartridge", mimeType: "application/zip", buffer: Buffer.concat(chunks) });
  await expect(page.getByText("Code project", { exact: true })).toBeVisible();
  expect(await source(page)).toBe(saved);
  await expect(status(page)).toContainText("Up to date", { timeout: 30_000 });

  // And it's still there after a reload.
  await page.reload();
  await expect(page.getByText("Code project", { exact: true })).toBeVisible();
  expect(await source(page)).toBe(saved);
});

test("a blank code project builds, and adding a graphic adds its incgraphic line", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Write code/ }).click();
  await expect(status(page)).toContainText("Up to date", { timeout: 30_000 });
  await page.getByRole("tab", { name: "Graphics" }).click();
  await page.getByRole("textbox", { name: "Name" }).fill("rock");
  const n = await buildCount(page);
  await page.getByRole("button", { name: "Add graphic" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Added rock" })).toBeVisible();
  expect(await source(page)).toContain(" incgraphic rock.png 160A 0 1 2 3");
  await expect.poll(() => buildCount(page), { timeout: 30_000 }).toBeGreaterThan(n);
  await expect(status(page)).toContainText("Up to date", { timeout: 30_000 });

  // Removing it asks first, in the app's own dialog, and takes its line out.
  await page.getByRole("button", { name: "Remove rock" }).click();
  const remove = page.getByRole("dialog", { name: "Remove rock?" });
  await expect(remove).toContainText("Its incgraphic line comes out of game.bas too");
  await remove.getByRole("button", { name: "Cancel" }).click();
  expect(await source(page)).toContain(" incgraphic rock.png");
  await page.getByRole("button", { name: "Remove rock" }).click();
  await remove.getByRole("button", { name: "Remove rock" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Removed rock." })).toBeVisible();
  expect(await source(page)).not.toContain(" incgraphic rock.png");

  // The reference inserts examples at the cursor.
  await page.getByRole("tab", { name: "Reference" }).click();
  await page.getByRole("searchbox", { name: "Search" }).fill("random");
  await page.getByRole("button", { name: "Insert rand into game.bas" }).click();
  await expect(editor(page)).toBeFocused();
  expect(await source(page)).toContain(" x = rand & 15");
});

test("the Code tab marks the lines a rule or a thing becomes, and what an edit changed", async ({ page }) => {
  await ghostPanic(page);
  await seeTheCode(page);
  const tier = page.locator(".code-tier");
  // The first thing (the cat) is selected to start with; its graphic shows in the gutter, its colors as swatches.
  await expect(tier.locator(".cm-marked").first()).toContainText("rem Cat");
  await expect(tier.locator(".cm-thumbs canvas").first()).toBeVisible();
  await expect(tier.locator(".cm-swatch").first()).toBeVisible();
  // Pick a rule in the split view.
  await tier.getByRole("button", { name: /^Rule 3/ }).click();
  await expect(tier.getByText(/^Rule 3: lines/)).toBeVisible();
  await expect(tier.locator(".cm-marked").first()).toContainText("rem rule 3:");
  // Selecting a rule in the Rules tab carries over.
  await page.getByRole("tab", { name: "Rules" }).click();
  await page.locator("ol.rules > li").nth(1).click({ position: { x: 5, y: 5 } });
  await seeTheCode(page);
  await expect(tier.locator(".cm-marked").first()).toContainText("rem rule 2:");
  // An edit marks the lines it changed.
  const n = await buildCount(page);
  await page.getByRole("tab", { name: "Game" }).click();
  await page.getByLabel("Lives").fill("5");
  await expect.poll(() => buildCount(page), { timeout: 30_000 }).toBeGreaterThan(n);
  await seeTheCode(page);
  await expect(tier.getByText(/Your last change touched line/)).toBeVisible();
  await expect(tier.getByTestId("rom-space")).toContainText("bytes free");
});

test("the code editor, See the code and the eject dialog pass axe", async ({ page }) => {
  await ghostPanic(page);
  await seeTheCode(page);
  expect(await axe(page), "See the code").toEqual([]);
  await page.getByRole("button", { name: "Edit as code…" }).click();
  expect(await axe(page), "eject dialog").toEqual([]);
  await page.getByRole("dialog").getByRole("button", { name: "Make a code project" }).click();
  await expect(status(page)).toContainText("Up to date", { timeout: 30_000 });
  await expect(page.locator(".code-panel .cm-editor")).toBeVisible();
  expect(await axe(page), "Code").toEqual([]);
  // With an error listed and the search panel open.
  await find(page, "drawscreen");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("frobnicate");
  await expect(status(page)).toContainText("Doesn't build yet", { timeout: 30_000 });
  await page.keyboard.press("ControlOrMeta+f");
  expect(await axe(page), "Code with an error and search").toEqual([]);
  for (const name of ["Graphics", "Tests", "Reference"]) {
    await page.getByRole("tab", { name }).click();
    expect(await axe(page), name).toEqual([]);
  }
});

test("the keyboard can leave the code editor", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Write code/ }).click();
  await expect(status(page)).toContainText("Up to date", { timeout: 30_000 });
  await editor(page).click();
  // Tab indents…
  await page.keyboard.press("Home");
  const before = await source(page);
  await page.keyboard.press("Tab");
  await expect.poll(() => source(page)).not.toBe(before);
  await expect(editor(page)).toBeFocused();
  // …and Esc then Tab moves on.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  await expect(editor(page)).not.toBeFocused();
});

async function downloadOf(page: Page, click: () => Promise<unknown>) {
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), click()]);
  const chunks: Buffer[] = [];
  for await (const c of await download.createReadStream()) chunks.push(c as Buffer);
  return { name: download.suggestedFilename(), bytes: new Uint8Array(Buffer.concat(chunks)) };
}

test("an ejected game still boxes up: print PDF, submission package and source folder", async ({ page }) => {
  await ghostPanic(page);
  await eject(page);
  await page.getByRole("region", { name: "Show it" }).getByRole("button", { name: /^Print the box/ }).click();
  const dialog = page.getByRole("dialog", { name: "Print the box" });
  // The kit game's manual came along.
  await expect(dialog.getByLabel("Manual text")).toHaveValue(/When Cat touches Catnip: remove the Catnip/);
  const pdf = await downloadOf(page, () => dialog.getByRole("button", { name: "Download print PDF" }).click());
  expect(pdf.name).toBe("ghost-panic-print.pdf");
  expect(new TextDecoder().decode(pdf.bytes.subarray(0, 5))).toBe("%PDF-");
  const pkg = await downloadOf(page, () => dialog.getByRole("button", { name: "Download everything" }).click());
  const names = Object.keys(unzipSync(pkg.bytes)).map((n) => n.replace("ghost-panic-submission/", ""));
  expect(names).toEqual(
    expect.arrayContaining([
      "CHECKLIST.txt", "rom/ghost-panic.a78", "rom/ghost-panic.bin", "print/ghost-panic-print.pdf", "project/ghost-panic.cartridge",
      "source/game.bas", "source/build.sh", "source/RUNTIME.txt",
    ]),
  );
  await dialog.getByRole("button", { name: "Close" }).click();

  const src = await downloadOf(page, () => page.getByRole("button", { name: "Export source", exact: true }).click());
  expect(src.name).toBe("ghost-panic-source.zip");
  const files = unzipSync(src.bytes);
  for (const f of ["game.bas", "build.sh", "build.bat", "PITFALLS.txt", "RUNTIME.txt", "README.txt", "ghost-panic.cartridge", "spr_cat.png"]) {
    expect(files[`ghost-panic-source/${f}`], f).toBeDefined();
  }
  // RUNTIME.txt has addresses from the last build.
  expect(new TextDecoder().decode(files["ghost-panic-source/RUNTIME.txt"])).toMatch(/\$2200 {2}otype/);
});
