// "Show it": every way a kit game leaves the editor. The offline player is
// opened and played; the clip, ROMs, PDF and package are checked as files.

import AxeBuilder from "@axe-core/playwright";
import { unzipSync } from "fflate";
import { expect, test, type Page } from "@playwright/test";
import { playFrames } from "./wait.ts";

async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /^Ghost Panic/ }).click();
  await expect(page.getByTestId("build-status")).toContainText("Up to date", { timeout: 30_000 });
}

async function downloadOf(page: Page, click: () => Promise<unknown>) {
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), click()]);
  const chunks: Buffer[] = [];
  for await (const c of await download.createReadStream()) chunks.push(c as Buffer);
  return { name: download.suggestedFilename(), bytes: Buffer.concat(chunks) };
}

const showIt = (page: Page) => page.getByRole("region", { name: "Show it" });

test("Send to family makes one HTML file that plays the game offline", async ({ page, context }) => {
  await start(page);
  const file = await downloadOf(page, () => showIt(page).getByRole("button", { name: /^Send to family/ }).click());
  expect(file.name).toBe("ghost-panic.html");
  expect(file.bytes.length).toBeLessThan(400_000);
  const html = file.bytes.toString("utf8");
  expect(html).toContain("GNU GENERAL PUBLIC LICENSE");

  // Open it with no network at all: everything it needs is inside.
  const player = await context.newPage();
  await player.route("**/*", (route) => route.abort());
  await player.setContent(html);
  await expect(player.getByRole("heading", { name: "Ghost Panic" })).toBeVisible();
  await player.getByRole("button", { name: "Press to play" }).click();
  await expect.poll(() => player.evaluate(() => (window as unknown as { __frames: number }).__frames ?? 0), { timeout: 10_000 }).toBeGreaterThan(60);
  // The picture isn't blank.
  const lit = await player.evaluate(() => {
    const c = document.querySelector("canvas")!.getContext("2d")!;
    const d = c.getImageData(0, 0, 320, 240).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i]! + d[i + 1]! + d[i + 2]! > 60) n++;
    return n;
  });
  expect(lit).toBeGreaterThan(1000);
});

test("a clip records play and saves an animated GIF", async ({ page }) => {
  await start(page);
  await showIt(page).getByRole("button", { name: /^Make a clip/ }).click();
  await expect(page.getByLabel("Game preview")).toBeFocused();
  await page.keyboard.down("ArrowRight");
  await playFrames(page, 90);
  await page.keyboard.up("ArrowRight");
  const gif = await downloadOf(page, () => showIt(page).getByRole("button", { name: /^Recording/ }).click());
  expect(gif.name).toBe("ghost-panic-clip.gif");
  expect(gif.bytes.subarray(0, 6).toString("latin1")).toBe("GIF89a");
  expect(gif.bytes.readUInt16LE(6)).toBe(640);
});

test("the console guide explains flash carts and hands over a signed ROM", async ({ page }) => {
  await start(page);
  await showIt(page).getByRole("button", { name: /^Put it on a console/ }).click();
  const dialog = page.getByRole("dialog", { name: "Put it on a console" });
  await expect(dialog.getByText("flash cartridge", { exact: true })).toBeVisible();
  expect(await new AxeBuilder({ page }).include("dialog").analyze().then((r) => r.violations.map((v) => v.id))).toEqual([]);
  const rom = await downloadOf(page, () => dialog.getByRole("button", { name: /\.a78/ }).click());
  expect(rom.name).toBe("ghost-panic.a78");
  expect(rom.bytes.subarray(1, 10).toString("latin1")).toBe("ATARI7800");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(showIt(page).getByRole("button", { name: /^Put it on a console/ })).toBeFocused();
});

test("kit games print a box and manual, and pack a submission with source", async ({ page }) => {
  await start(page);
  await showIt(page).getByRole("button", { name: /^Print the box/ }).click();
  const dialog = page.getByRole("dialog", { name: "Print the box" });
  await expect(dialog.getByLabel("Manual text")).toHaveValue(/When Cat touches Catnip: remove the Catnip/);
  const pdf = await downloadOf(page, () => dialog.getByRole("button", { name: "Download print PDF" }).click());
  expect(pdf.name).toBe("ghost-panic-print.pdf");
  expect(pdf.bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");

  const pkg = await downloadOf(page, () => dialog.getByRole("button", { name: "Download everything" }).click());
  const names = Object.keys(unzipSync(new Uint8Array(pkg.bytes))).map((n) => n.replace("ghost-panic-submission/", ""));
  expect(names).toEqual(
    expect.arrayContaining(["CHECKLIST.txt", "rom/ghost-panic.a78", "rom/ghost-panic.bin", "print/ghost-panic-print.pdf", "project/ghost-panic.cartridge", "source/game.bas"]),
  );
});

test("Play on a TV fills the screen with the game, its title and a prompt", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Headless full screen is only reliable in Chromium");
  await start(page);
  // One control for TV mode and full screen, beside the game.
  await page.getByRole("region", { name: "Play", exact: true }).getByRole("button", { name: "Play on a TV" }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.className ?? "")).toContain("tv-stage");
  await expect(page.locator(".tv-stage .tv-title")).toHaveText("Ghost Panic");
  await expect(page.getByLabel("Game preview")).toBeFocused();
});
