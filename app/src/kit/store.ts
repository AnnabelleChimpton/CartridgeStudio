import { createHistoryStore } from "../project/store.ts";
import type { KitGame } from "./schema.ts";

/** The kit game being edited, with undo history. */
export const useKitStore = createHistoryStore<KitGame>();
