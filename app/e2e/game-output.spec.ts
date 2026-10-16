// What games put on screen: contrast notes with one-click fixes, the spike
// color, the easier assist, and a room painter that draws tiles the way the
// ROM does.

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { contrastRatio, SHAPE_RATIO, TEXT_RATIO } from "../src/kit/contrast.ts";
import { TILE_GLYPHS } from "../src/kit/font.ts";
import { ntscRgb } from "../src/ui/ntsc.ts";

async function start(page: Page, preset: "Cat vs. Vacuums" | "Yarn Hunt" | "Ghost Panic") {
  await page.goto("/");
  await page.getByRole("button", { name: new RegExp(`^${preset.replace(".", "\\.")}`) }).click();
  await expect(page.getByTestId("build-status")).toContainText("Up to date", { timeout: 30_000 });
}
const openTab = (page: Page, name: "Things" | "Room" | "Game") => page.getByRole("tab", { name }).click();
const game = (page: Page) => page.evaluate(() => window.__cs!.kitStore!.getState().project);

async function pick(page: Page, swatch: RegExp, color: string) {
  await page.getByRole("button", { name: swatch }).click();
  await page.getByRole("option", { name: new RegExp(`^\\${color},`) }).click();
}

test("a hard-to-read text color gets a note, and its suggestion fixes it", async ({ page }) => {
  await start(page, "Cat vs. Vacuums");
  await openTab(page, "Game");
  const notes = page.getByTestId("game-contrast");
  await expect(notes).toBeEmpty();

  const bg = (await game(page)).background;
  await pick(page, /^Text color/, "$02");
  const note = page.getByTestId("contrast-text");
  await expect(note).toContainText(`The score and title text: $02 very dark gray on ${bg} black`);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  // Advice only: the game still builds.
  await expect(page.getByTestId("build-status")).toContainText("Up to date", { timeout: 30_000 });

  await note.getByRole("button", { name: /^Use \$0. [a-z ]+ for the score and title text: \d+\.\d to 1$/ }).click();
  await expect(notes).toBeEmpty();
  const g = await game(page);
  const text = g.palettes.find((p) => p.id === g.textPalette)!.colors[0];
  expect(contrastRatio(text, bg)).toBeGreaterThanOrEqual(TEXT_RATIO);
  // Same hue, only lighter.
  expect(text.slice(0, 2)).toBe("$0");
});

test("the spike color is on the Game tab, and dim spikes get a note", async ({ page }) => {
  await start(page, "Ghost Panic");
  await openTab(page, "Game");
  await pick(page, /^Spike color/, "$00");
  let g = await game(page);
  expect(g.palettes.find((p) => p.id === g.wallPalette)!.colors[2]).toBe("$00");
  const note = page.getByTestId("contrast-spikes");
  await expect(note).toContainText("The spikes: $00 black on $00 black");
  await note.getByRole("button", { name: /^Use \$/ }).click();
  await expect(note).toHaveCount(0);
  g = await game(page);
  expect(contrastRatio(g.palettes.find((p) => p.id === g.wallPalette)!.colors[2], g.background)).toBeGreaterThanOrEqual(SHAPE_RATIO);
});

test("a thing that disappears into the background gets a note on the Things tab", async ({ page }) => {
  await start(page, "Yarn Hunt");
  const t = (await game(page)).types[0]!;
  await page.evaluate((id) => {
    const s = window.__cs!.kitStore!.getState();
    s.edit((d) => {
      const pal = d.palettes.find((p) => p.id === d.types.find((x) => x.id === id)!.palette)!;
      pal.colors = [d.background, d.background, d.background];
    });
  }, t.id);
  await openTab(page, "Game");
  await expect(page.getByTestId("things-contrast-summary")).toContainText(t.label);
  await openTab(page, "Things");
  await page.getByRole("button", { name: new RegExp(`^${t.label}`) }).first().click();
  const note = page.getByTestId(`contrast-thing:${t.id}`);
  await expect(note).toContainText(`${t.label}: `);
  await note.getByRole("button", { name: /^Use \$/ }).click();
  await expect(note).toHaveCount(0);
});

test("the easier assist is kept with the game", async ({ page }) => {
  await start(page, "Yarn Hunt");
  await openTab(page, "Game");
  const box = page.getByRole("checkbox", { name: /Easier for younger players/ });
  await expect(box).not.toBeChecked();
  await box.check();
  expect(((await game(page)) as { assist?: { easier: boolean } }).assist).toEqual({ easier: true });
  // Saved and read back: reopen the game from My games after a reload.
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.getByTestId("build-status")).toContainText("Up to date", { timeout: 30_000 });
  expect(((await game(page)) as { assist?: { easier: boolean } }).assist).toEqual({ easier: true });
});

test("the room painter draws walls, spikes and goals pixel for pixel as the ROM does", async ({ page }) => {
  await start(page, "Ghost Panic");
  // Take the things out, so only tiles are drawn.
  await page.evaluate(() =>
    window.__cs!.kitStore!.getState().edit((d) => {
      const tiles = new Set(["wall", "hazard", "goal"]);
      d.room.rows = d.room.rows.map((r) => [...r].map((ch) => (tiles.has(d.room.legend[ch] ?? "") ? ch : " ")).join(""));
    }),
  );
  await openTab(page, "Room");
  const g = await game(page);
  const wall = g.palettes.find((p) => p.id === g.wallPalette)!.colors.map((c) => ntscRgb(parseInt(c.slice(1), 16)));
  const bg = ntscRgb(parseInt(g.background.slice(1), 16));

  const glyphChar = { wall: "#", hazard: "~", goal: "*" } as const;
  const cells: { col: number; row: number; ch: "#" | "~" | "*" }[] = [];
  for (const tile of ["wall", "hazard", "goal"] as const) {
    const row = g.room.rows.findIndex((r) => [...r].some((ch) => g.room.legend[ch] === tile));
    if (row < 0) continue;
    const col = [...g.room.rows[row]!].findIndex((ch) => g.room.legend[ch] === tile);
    cells.push({ col, row, ch: glyphChar[tile] });
  }
  expect(cells.map((c) => c.ch)).toEqual(expect.arrayContaining(["#", "~"]));

  // Each cell is 32 canvas pixels: 8 game pixels across (4 wide each), 16 lines down (2 tall each).
  const pixels = await page.getByLabel("Room grid").evaluate((c: HTMLCanvasElement, cells) => {
    const ctx = c.getContext("2d")!;
    return cells.map(({ col, row }) => {
      const out: number[][] = [];
      for (let gy = 0; gy < 16; gy++)
        for (let gx = 0; gx < 8; gx++) out.push([...ctx.getImageData(col * 32 + gx * 4 + 2, row * 32 + gy * 2 + 1, 1, 1).data.slice(0, 3)]);
      return out;
    });
  }, cells);

  cells.forEach((cell, i) => {
    const glyph = TILE_GLYPHS[cell.ch]!;
    for (let gy = 0; gy < 16; gy++) {
      for (let gx = 0; gx < 8; gx++) {
        // The ROM repeats each 4×8 glyph twice across and twice down a cell.
        const v = glyph[gy % 8]!.charCodeAt(gx % 4) - 48;
        const want = v === 0 ? bg : wall[v - 1]!;
        const got = pixels[i]![gy * 8 + gx]!;
        for (let k = 0; k < 3; k++) expect(Math.abs(got[k]! - want[k]!), `${cell.ch} pixel ${gx},${gy}`).toBeLessThanOrEqual(2);
      }
    }
  });
});
