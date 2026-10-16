import { createHistoryStore } from "../project/store.ts";
import type { CodeProject } from "./schema.ts";

/** The code project being edited, with undo history (CodeMirror keeps its own for typing). */
export const useCodeStore = createHistoryStore<CodeProject>();
