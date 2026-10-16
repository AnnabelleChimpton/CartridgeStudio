// Waits on the app's state instead of fixed sleeps, so tests neither flake on
// a slow machine nor waste time on a fast one.

import { expect, type Page } from "@playwright/test";

/** Titles of the games saved in IndexedDB (My games), as the autosave wrote them. */
export const savedTitles = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const req = indexedDB.open("cartridge-studio");
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("projects")) return db.close(), resolve([]);
          const all = db.transaction("projects").objectStore("projects").getAll();
          all.onsuccess = () => {
            db.close();
            resolve((all.result as { id?: string; title?: string; updated?: number }[]).filter((v) => v?.updated && v.id).map((v) => v.title ?? ""));
          };
          all.onerror = () => reject(all.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );

/** Waits until the autosave has written a game with this title. */
export async function autosaved(page: Page, title: string) {
  await expect.poll(() => savedTitles(page), { timeout: 10_000 }).toContain(title);
}

/** Waits until the game preview has run `n` more frames (about n/60 s of play). */
export const playFrames = (page: Page, n: number) =>
  page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        let seen = 0;
        const off = window.__cs!.emulator!.onFrame(() => {
          if (++seen < n) return;
          off();
          resolve();
        });
      }),
    n,
  );

/** How many games in My games have a picture yet. */
export const savedThumbnails = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const req = indexedDB.open("cartridge-studio");
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("projects")) return db.close(), resolve(0);
          const keys = db.transaction("projects").objectStore("projects").getAllKeys();
          keys.onsuccess = () => {
            db.close();
            resolve(keys.result.filter((k) => String(k).startsWith("thumb:")).length);
          };
          keys.onerror = () => reject(keys.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
