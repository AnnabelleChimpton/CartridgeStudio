// A game's creator tests in the editor: loaded from My games when the game
// opens, saved on every change, and run again in a worker whenever a new build
// is in the preview or the tests change. Lives in the editor, not the panel,
// so results keep coming while another tab is open.

import { useEffect, useRef, useState } from "react";
import { loadTests, saveTests } from "../project/persist.ts";
import type { Preview } from "../ui/usePreview.ts";
import { emptyTests, type TestResult, type TestsFile } from "./creator-tests.ts";
import { TestsRunner } from "./tests-runner.ts";

export type TestRun =
  | { status: "none" }
  | { status: "running" }
  | { status: "done"; results: TestResult[]; build: number }
  | { status: "error"; message: string };

export function useCreatorTests(gameId: string, preview: Preview) {
  const [file, setFileState] = useState<TestsFile>(emptyTests);
  const [loaded, setLoaded] = useState(false);
  const [run, setRun] = useState<TestRun>({ status: "none" });
  const runner = useRef<TestsRunner | null>(null);
  const builds = useRef(0);

  useEffect(() => {
    let live = true;
    void loadTests(gameId).then((f) => {
      if (!live) return;
      setFileState(f ?? emptyTests());
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [gameId]);

  useEffect(() => {
    const r = new TestsRunner();
    runner.current = r;
    return () => r.dispose();
  }, []);

  const built = preview.lastGood;
  useEffect(() => {
    if (!built || !loaded || !file.tests.length) {
      setRun({ status: "none" });
      return;
    }
    const build = ++builds.current;
    setRun({ status: "running" });
    void runner.current!.run(built.a78, built.symbols, file).then((o) => {
      if (o.kind === "done") setRun({ status: "done", results: o.results, build });
      else if (o.kind === "error") setRun({ status: "error", message: o.message });
    });
  }, [built, file, loaded]);

  const setFile = (next: TestsFile) => {
    setFileState(next);
    void saveTests(gameId, next);
  };

  return { file, setFile, run, loaded };
}

export type CreatorTests = ReturnType<typeof useCreatorTests>;
