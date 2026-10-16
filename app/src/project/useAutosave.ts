// Keeps the open game in "My games": every change is saved after a short
// pause, and a picture of the running game is kept for the start screen a
// moment after each build.

import { useEffect } from "react";
import type { CodeProject } from "../code/schema.ts";
import { encodeRgbaPng } from "../files/png.ts";
import type { KitGame } from "../kit/schema.ts";
import type { Preview } from "../ui/usePreview.ts";
import { autosave, saveThumbnail } from "./persist.ts";

/** Long enough for the game to be past its first frames. */
const THUMBNAIL_DELAY_MS = 1500;

export function useAutosave(id: string, game: { kind: "kit"; game: KitGame } | { kind: "code"; game: CodeProject }, preview: Preview) {
  const { kind, game: data } = game;
  useEffect(() => {
    autosave(id, { kind, game: data } as Parameters<typeof autosave>[1]);
  }, [id, kind, data]);

  const built = preview.lastGood;
  useEffect(() => {
    if (!built) return;
    const timer = setTimeout(() => {
      void preview
        .screenshot()
        .then((shot) => shot && saveThumbnail(id, encodeRgbaPng(shot.width, shot.height, shot.rgba)))
        .catch(() => undefined);
    }, THUMBNAIL_DELAY_MS);
    return () => clearTimeout(timer);
    // The screenshot function changes every render; a new build is what matters.
  }, [id, built]);
}
