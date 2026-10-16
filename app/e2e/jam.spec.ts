// Game jams with no server: a brief arrives in a link, creators make entry
// ZIPs, and the organizer builds a static gallery that plays offline.

import AxeBuilder from "@axe-core/playwright";
import { unzipSync } from "fflate";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { encodeBriefParam, newBrief } from "../src/jam/brief.ts";

const brief = newBrief({
  name: "Spooky Cartridge Jam",
  theme: "It's behind you",
  dates: "Fri 31 Oct to Sun 2 Nov",
  constraints: ["One room", "Two colours"],
  presets: ["maze", "ghost-panic"],
  criteria: ["Fun", "Theme"],
  limits: { maxRules: 4 },
  link: "https://example.org/spooky-jam",
});

async function downloadOf(page: Page, click: () => Promise<unknown>) {
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 90_000 }), click()]);
  const chunks: Buffer[] = [];
  for await (const c of await download.createReadStream()) chunks.push(c as Buffer);
  return { name: download.suggestedFilename(), bytes: Buffer.concat(chunks) };
}

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

const banner = (page: Page) => page.getByRole("complementary", { name: "Game jam" });
const entryForm = (page: Page) => page.getByRole("region", { name: "Jam entry" });

async function joinAndStart(page: Page) {
  await page.goto(`/?jam=${encodeBriefParam(brief)}`);
  await expect(banner(page)).toContainText("Spooky Cartridge Jam");
  await expect(banner(page)).toContainText("It's behind you");
  await expect(banner(page).getByRole("listitem")).toHaveText(["One room", "Two colours"]);
  await expect(page).not.toHaveURL(/jam=/);
  // Only the jam's starting games.
  await expect(page.locator(".chooser-card")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /^Yarn Hunt/ })).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await page.getByRole("button", { name: /^Ghost Panic/ }).click();
  await expect(page.getByTestId("build-status")).toContainText("Up to date", { timeout: 30_000 });
}

async function makeEntry(page: Page, words: { title: string; credits: string; description: string; controls: string; compilation?: boolean }) {
  const form = entryForm(page);
  // A licence is required.
  if ((await form.getByLabel("Licence (required)").inputValue()) === "") {
    await expect(form.getByRole("button", { name: "Make my jam entry" })).toBeDisabled();
  }
  await form.getByLabel("Licence (required)").selectOption("CC-BY-4.0");
  await form.getByRole("checkbox", { name: /compilation/ }).setChecked(!!words.compilation);
  await form.getByLabel("Title").fill(words.title);
  await form.getByLabel("Credits").fill(words.credits);
  await form.getByLabel("Short description").fill(words.description);
  await form.getByLabel("Controls").fill(words.controls);
  const file = await downloadOf(page, () => form.getByRole("button", { name: "Make my jam entry" }).click());
  await expect(form).toContainText(`Saved ${file.name}`);
  return file;
}

test("a jam link shows the brief, and the brief survives a reload", async ({ page }) => {
  await joinAndStart(page);
  await expect(entryForm(page)).toContainText("Spooky Cartridge Jam");
  expect(await axe(page)).toEqual([]);
  await page.reload();
  await expect(banner(page)).toContainText("It's behind you");
  page.once("dialog", (d) => void d.accept());
  await banner(page).getByRole("button", { name: "Leave jam" }).click();
  await expect(banner(page)).toHaveCount(0);
  await expect(entryForm(page)).toHaveCount(0);
});

test("the organizer guide makes a working jam link and passes axe", async ({ page }) => {
  await page.goto("/organize.html");
  await expect(page.getByRole("heading", { level: 1, name: "How to run a jam" })).toBeVisible();
  for (const h of ["1. Make the brief", "2. Share the link", "3. Collect entries", "4. Build the gallery", "5. Judge", "Suggested themes"]) {
    await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();
  }
  await page.getByLabel("Jam name").fill("Guide Jam");
  await page.getByRole("textbox", { name: "Theme" }).fill("Small world");
  await page.getByRole("checkbox", { name: "Yarn Hunt" }).check();
  await page.getByRole("spinbutton", { name: "Rules", exact: true }).fill("6");
  const link = await page.getByLabel("The jam link").inputValue();
  expect(await axe(page)).toEqual([]);
  const file = await downloadOf(page, () => page.getByRole("button", { name: /Download the brief/ }).click());
  expect(file.name).toBe("guide-jam.jam.json");
  expect(JSON.parse(file.bytes.toString("utf8"))).toMatchObject({
    format: "cartridge-studio-jam",
    name: "Guide Jam",
    presets: ["maze"],
    criteria: ["Fun", "Theme", "Look and sound"],
    limits: { maxRules: 6 },
    app: expect.any(String),
  });

  await page.goto(link);
  await expect(banner(page)).toContainText("Small world");
  await expect(page.locator(".chooser-card")).toHaveCount(1);
});

test("two entries become a gallery that plays with the network off", async ({ page, context, browserName }, info) => {
  test.setTimeout(300_000);
  await joinAndStart(page);

  // A clip recorded in Show it goes into the entry.
  const showIt = page.getByRole("region", { name: "Show it" });
  await showIt.getByRole("button", { name: /^Make a clip/ }).click();
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(1200);
  await page.keyboard.up("ArrowLeft");
  await downloadOf(page, () => showIt.getByRole("button", { name: /^Recording/ }).click());
  await expect(entryForm(page)).toContainText("Clip: ready");

  // Ghost Panic has more rules than the jam allows: noted, not refused.
  await expect(entryForm(page)).toContainText("over the limit of 4");
  const first = await makeEntry(page, { title: "Haunt One", credits: "Sam", description: "Run from the ghosts.", controls: "Arrows move", compilation: true });
  expect(first.name).toBe("haunt-one-jam-entry.zip");
  const files = unzipSync(first.bytes);
  expect(Object.keys(files).sort()).toEqual(
    [
      "README.txt",
      "manifest.json",
      "media/clip.gif",
      "media/thumbnail.png",
      "play.html",
      "project/haunt-one.cartridge",
      "rom/haunt-one.a78",
      "rom/haunt-one.bin",
    ].map((f) => `haunt-one-jam-entry/${f}`),
  );
  expect(JSON.parse(Buffer.from(files["haunt-one-jam-entry/manifest.json"]!).toString())).toMatchObject({
    format: "cartridge-studio-package",
    title: "Haunt One",
    credits: "Sam",
    licence: "CC-BY-4.0",
    build: { runtime: expect.stringMatching(/^kit runtime/), romSha256: expect.stringMatching(/^[0-9a-f]{64}$/) },
    jam: { name: "Spooky Cartridge Jam", compilation: true, flags: [expect.stringMatching(/^Rules: \d+, over the limit of 4\.$/)] },
  });
  expect(Buffer.from(files["haunt-one-jam-entry/rom/haunt-one.a78"]!.subarray(1, 10)).toString("latin1")).toBe("ATARI7800");
  expect(Buffer.from(files["haunt-one-jam-entry/play.html"]!).toString()).toContain("GNU GENERAL PUBLIC LICENSE");

  await entryForm(page).getByRole("button", { name: "Remove clip" }).click();
  const second = await makeEntry(page, { title: "Haunt Two", credits: "Robin", description: "The sequel.", controls: "Arrows move" });
  expect(Object.keys(unzipSync(second.bytes))).not.toContain("haunt-two-jam-entry/media/clip.gif");

  // The organizer's side, on its own page; the brief joined above is picked up.
  await page.goto("/organize.html#gallery");
  await expect(page.getByText("Checking entries against the brief for Spooky Cartridge Jam")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Build the jam gallery" })).toBeVisible();
  await page.getByLabel("Choose entry ZIPs").setInputFiles([
    { name: first.name, mimeType: "application/zip", buffer: first.bytes },
    { name: second.name, mimeType: "application/zip", buffer: second.bytes },
    { name: "notes.zip", mimeType: "application/zip", buffer: Buffer.from("nope") },
  ]);
  await expect(page.getByRole("alert")).toContainText("notes.zip: This isn't a ZIP file.");
  await expect(page.getByRole("rowheader")).toHaveText(["Haunt One", "Haunt Two"]);
  await expect(page.getByRole("row", { name: /Haunt One/ })).toContainText("over the limit of 4");
  await expect(page.getByLabel("Jam name")).toHaveValue("Spooky Cartridge Jam");
  expect(await axe(page)).toEqual([]);

  // Judging: a sheet out, a filled-in sheet back, results in the gallery.
  const sheet = await downloadOf(page, () => page.getByRole("button", { name: /judges' sheet/ }).click());
  expect(sheet.name).toBe("spooky-cartridge-jam-judges.csv");
  const csv = sheet.bytes.toString("utf8");
  expect(csv.split("\r\n")[0]).toBe("id,title,credits,play,licence,compilation,flags,app,rom_sha256,Fun,Theme,notes");
  expect(csv).toContain("haunt-one,Haunt One,Sam,entries/haunt-one/play.html,CC BY 4.0,yes,");
  const scored = "id,Fun,Theme\r\nhaunt-one,3,4\r\nhaunt-two,5,4\r\n";
  await page.getByLabel("Add filled-in sheets").setInputFiles({ name: "judge-1.csv", mimeType: "text/csv", buffer: Buffer.from(scored) });
  await expect(page.getByText("In the lead:")).toContainText("Haunt Two");

  const gallery = await downloadOf(page, () => page.getByRole("button", { name: "Build the gallery" }).click());
  expect(gallery.name).toBe("spooky-cartridge-jam-gallery.zip");

  // Unzip it to a folder and open it from disk, with no network at all.
  const dir = info.outputPath("gallery");
  for (const [name, data] of Object.entries(unzipSync(gallery.bytes))) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), data);
  }
  const requests: string[] = [];
  await context.route(/^https?:/, (route) => {
    requests.push(route.request().url());
    return route.abort();
  });
  // WebKit won't open file:// pages in offline mode; the blocked routes above still cut it off.
  if (browserName !== "webkit") await context.setOffline(true);
  const site = await context.newPage();
  await site.goto(pathToFileURL(join(dir, "index.html")).href);
  await expect(site.getByRole("heading", { level: 1, name: "Spooky Cartridge Jam" })).toBeVisible();
  await expect(site.getByRole("heading", { level: 2 })).toHaveText(["Haunt One", "Haunt Two"]);
  const shot = site.getByRole("img", { name: "Screenshot of Haunt One" });
  await expect(shot).toBeVisible();
  expect(await shot.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(await axe(site)).toEqual([]);

  // Clips play only when asked.
  await site.getByRole("button", { name: "Watch clip" }).click();
  await expect(site.getByRole("img", { name: "Clip of Haunt One being played" })).toHaveAttribute("src", /clip\.gif$/);
  await site.getByRole("button", { name: "Stop clip" }).click();
  await expect(shot).toBeVisible();

  await site.getByRole("link", { name: "Play Haunt One" }).click();
  await expect(site.getByRole("heading", { name: "Haunt One" })).toBeVisible();
  await site.getByRole("button", { name: "Press to play" }).click();
  await expect.poll(() => site.evaluate(() => (window as unknown as { __frames?: number }).__frames ?? 0), { timeout: 15_000 }).toBeGreaterThan(60);
  await site.getByRole("link", { name: /All entries/ }).click();
  await expect(site.getByRole("heading", { level: 1, name: "Spooky Cartridge Jam" })).toBeVisible();
  await site.getByRole("link", { name: "Results" }).click();
  await expect(site.getByRole("row").nth(1)).toContainText("Haunt Two");
  expect(await axe(site)).toEqual([]);
  expect(requests).toEqual([]);
});
