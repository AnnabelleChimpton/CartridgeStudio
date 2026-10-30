// Share and download: every way a kit game leaves the editor. The offline player is
// opened and played; the clip, ROMs, PDF and package are checked as files.

import AxeBuilder from "@axe-core/playwright";
import { unzipSync } from "fflate";
import { expect, test, type Page } from "@playwright/test";
import { playFrames } from "./wait.ts";

async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /^Ghost Panic/ }).click();
  await expect(page.getByTestId("build-status")).toContainText("Built in", { timeout: 30_000 });
}

async function downloadOf(page: Page, click: () => Promise<unknown>) {
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), click()]);
  const chunks: Buffer[] = [];
  for await (const c of await download.createReadStream()) chunks.push(c as Buffer);
  return { name: download.suggestedFilename(), bytes: Buffer.concat(chunks) };
}

const showIt = (page: Page) => page.getByRole("region", { name: "Share and download" });

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
  await expect(player.locator("#start")).toHaveText("Click the screen, then press fire.");
  await player.locator("#start").click();
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
  await showIt(page).getByRole("button", { name: "Make a GIF" }).click();
  await expect(page.getByLabel("Game preview")).toBeFocused();
  await page.keyboard.down("ArrowRight");
  await playFrames(page, 90);
  await page.keyboard.up("ArrowRight");
  await expect(showIt(page).getByRole("button", { name: /^Recording\. Click to stop\./ })).toBeVisible();
  const gif = await downloadOf(page, () => showIt(page).getByRole("button", { name: /^Recording/ }).click());
  expect(gif.name).toBe("ghost-panic-clip.gif");
  expect(gif.bytes.subarray(0, 6).toString("latin1")).toBe("GIF89a");
  expect(gif.bytes.readUInt16LE(6)).toBe(640);
});

// Colours are checked once they settle: a button mid-transition is between its two states.
const dialogAxe = async (page: Page) => {
  await page.waitForFunction(() => !document.getAnimations().some((a) => a instanceof CSSTransition));
  return axeDialog(page);
};
const axeDialog = (page: Page) =>
  new AxeBuilder({ page })
    .include("dialog")
    .analyze()
    .then((r) => r.violations.map((v) => v.id));

test("the console dialog hands over a signed ROM, with the untested table and a boot report", async ({ page }) => {
  await start(page);
  await showIt(page).getByRole("button", { name: /^Put it on a cart/ }).click();
  const dialog = page.getByRole("dialog", { name: "Put it on a cart" });
  await expect(dialog.getByText(/needs a flash cartridge/)).toBeVisible();
  // The compatibility table is honest: nothing has been tried on hardware.
  const table = dialog.getByRole("table", { name: "Tested on hardware" });
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table.getByRole("cell")).toHaveText(["Not yet tested on hardware."]);
  // No question before a download.
  await expect(dialog.getByRole("group", { name: "Did it boot?" })).toHaveCount(0);
  expect(await dialogAxe(page)).toEqual([]);

  const rom = await downloadOf(page, () => dialog.getByRole("button", { name: /\.a78/ }).click());
  expect(rom.name).toBe("ghost-panic.a78");
  expect(rom.bytes.subarray(1, 10).toString("latin1")).toBe("ATARI7800");
  await expect(dialog.getByRole("status").first()).toHaveText("Saved “ghost-panic.a78”. Copy it onto the cartridge's memory card.");

  // Did it boot? No: the list of things to try opens, with the boot report.
  const ask = dialog.getByRole("group", { name: "Did it boot?" });
  await expect(ask.getByRole("button")).toHaveText(["Yes", "No", "Not yet"]);
  await ask.getByRole("button", { name: "No", exact: true }).click();
  await expect(ask.getByRole("button", { name: "No", exact: true })).toHaveAttribute("aria-pressed", "true");
  const trouble = dialog.locator("details", { hasText: "If it doesn't start" });
  await expect(trouble).toHaveAttribute("open");
  const report = trouble.getByLabel("Boot report");
  await expect(report).toHaveValue(/^Game: Ghost Panic\nROM file: ghost-panic\.a78, [\d,]+ bytes\nROM SHA-256: [0-9a-f]{64}\n/);
  await expect(report).toHaveValue(/What happened .*: It didn't boot$/);
  // The report is copied and pasted, never sent in the link.
  const link = trouble.getByRole("link", { name: /boot report form on GitHub/ });
  await expect(link).toHaveAttribute("href", "https://github.com/AnnabelleChimpton/CartridgeStudio/issues/new?template=boot-report.yml");
  await expect(trouble.getByRole("button", { name: "Copy boot report" })).toBeVisible();
  expect(await dialogAxe(page)).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(showIt(page).getByRole("button", { name: /^Put it on a cart/ })).toBeFocused();
});

test("a game that booted gets a printable First boot card", async ({ page, context }) => {
  await start(page);
  await showIt(page).getByRole("button", { name: /^Put it on a cart/ }).click();
  const dialog = page.getByRole("dialog", { name: "Put it on a cart" });
  await downloadOf(page, () => dialog.getByRole("button", { name: /\.bin/ }).click());
  await dialog.getByRole("group", { name: "Did it boot?" }).getByRole("button", { name: "Yes" }).click();
  await expect(dialog.locator(".first-boot").getByLabel("Boot report")).toHaveValue(/What happened .*: It booted$/);
  const [card] = await Promise.all([context.waitForEvent("page"), dialog.getByRole("button", { name: "Print the First boot card" }).click()]);
  await card.waitForLoadState();
  await expect(card.getByTestId("first-boot-card")).toContainText("First boot");
  await expect(card.getByTestId("first-boot-card")).toContainText("Ghost Panic");
  await expect(card.getByTestId("first-boot-card")).toContainText("ghost-panic.bin");
  expect(await dialogAxe(page)).toEqual([]);
});

test("kit games print a box and manual; Show it packs everything with source", async ({ page }) => {
  await start(page);
  await showIt(page).getByRole("button", { name: /^Print the box/ }).click();
  const dialog = page.getByRole("dialog", { name: "Print the box" });
  await expect(dialog.getByLabel("Manual text")).toHaveValue(/When Cat touches Catnip, remove the Catnip/);
  const pdf = await downloadOf(page, () => dialog.getByRole("button", { name: "Download print PDF" }).click());
  expect(pdf.name).toBe("ghost-panic-print.pdf");
  expect(pdf.bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");

  // The ZIP isn't in the print dialog: it has its own button beside it.
  await expect(dialog.getByRole("button", { name: "Download everything" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  const pkg = await downloadOf(page, () => showIt(page).getByRole("button", { name: "Everything (.zip)" }).click());
  expect(pkg.name).toBe("ghost-panic-submission.zip");
  await expect(showIt(page).getByRole("status")).toHaveText("Saved ghost-panic-submission.zip: ROMs, player page, print kit, game file and source.");
  const names = Object.keys(unzipSync(new Uint8Array(pkg.bytes))).map((n) => n.replace("ghost-panic-submission/", ""));
  expect(names).toEqual(
    expect.arrayContaining(["CHECKLIST.txt", "rom/ghost-panic.a78", "rom/ghost-panic.bin", "print/ghost-panic-print.pdf", "project/ghost-panic.cartridge", "source/game.bas"]),
  );
});

test("Full screen (for a TV) fills the screen with the game, its title and a prompt", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Headless full screen is only reliable in Chromium");
  await start(page);
  // One control for a TV, in the console row, with its hint on hover.
  const play = page.getByRole("region", { name: "Play", exact: true });
  await expect(page.getByRole("button", { name: "How do I connect a TV?" })).toHaveCount(0);
  const tv = play.getByRole("button", { name: "Full screen (for a TV)" });
  await expect(tv).toHaveAccessibleDescription("Plug the laptop into the TV with HDMI first. A USB gamepad works.");
  await tv.click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.className ?? "")).toContain("tv-stage");
  await expect(page.locator(".tv-stage .tv-title")).toHaveText("Ghost Panic");
  await expect(page.getByLabel("Game preview")).toBeFocused();
});

test("one status line gives the build's own numbers", async ({ page }) => {
  await start(page);
  await expect(page.getByTestId("build-status")).toHaveText(/^Built in (\d+ ms|\d+\.\d s) · \d+(\.\d)? of 32 KB$/);
  await expect(page.getByRole("meter")).toHaveCount(0);
});

test("the console row presses the console's buttons and moves its switches", async ({ page }) => {
  await start(page);
  const consoleRow = page.getByRole("group", { name: "Console" });
  await expect(consoleRow.getByRole("button")).toHaveText(["Pause", "Select", "Reset", "Full screen (for a TV)"]);
  await expect(consoleRow.getByRole("switch")).toHaveCount(2);
  const pressed = await page.evaluate(() => {
    const emu = window.__cs!.emulator!;
    const w = window as unknown as { __pressed: string[] };
    w.__pressed = [];
    const press = emu.pressConsole.bind(emu);
    emu.pressConsole = (b) => {
      w.__pressed.push(b);
      press(b);
    };
    return w.__pressed;
  });
  expect(pressed).toEqual([]);
  for (const name of [/^pause$/i, /^select$/i, /^reset$/i]) await consoleRow.getByRole("button", { name }).click();
  expect(await page.evaluate(() => (window as unknown as { __pressed: string[] }).__pressed)).toEqual(["pause", "select", "reset"]);

  const left = consoleRow.getByRole("switch", { name: "Left difficulty A" });
  const was = await left.getAttribute("aria-checked");
  await left.click();
  await expect(left).toHaveAttribute("aria-checked", was === "true" ? "false" : "true");
  // A rebuild keeps it where it was put.
  await page.getByLabel("Game title").fill("Ghost Panic 2");
  await expect(page.getByTestId("build-status")).toContainText("Built in", { timeout: 30_000 });
  await expect(left).toHaveAttribute("aria-checked", was === "true" ? "false" : "true");
});

test("the picture is a whole number of pixels per console pixel when there's room", async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1000 });
  await start(page);
  const width = await page.getByLabel("Game preview").evaluate((c) => c.getBoundingClientRect().width);
  expect(width % 320).toBe(0);
});
