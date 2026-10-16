// Cartridge Studio: pick what to make, then edit it while it runs. Kit games
// (things, rooms and rules on one runtime) and code projects (game.bas by
// hand, usually ejected from a kit game) each have their own editor, laid out
// the same way: one job at a time in tabs on the left and the running game on
// the right. Both rebuild the ROM 300 ms after every change and reload the
// preview. Every game is kept in My games (project/persist.ts); starting or
// opening one adds to it.

import { useEffect, useState } from "react";
import { CodeEditor } from "./code/CodeEditor.tsx";
import { EjectDialog } from "./code/EjectDialog.tsx";
import { blankCodeProject, ejectKit } from "./code/eject.ts";
import { useCodeStore } from "./code/store.ts";
import { readCartridgeFile } from "./files/cartridge-file.ts";
import { useGuide } from "./kit/guide.ts";
import { JAM_EXTENSION, JAM_PARAM, decodeBriefParam, offeredPresets, readBriefText } from "./jam/brief.ts";
import { JamBanner, JamLinks } from "./jam/JamBanner.tsx";
import { useJamStore } from "./jam/store.ts";
import { KitEditor } from "./kit/KitEditor.tsx";
import { KIT_PRESETS } from "./kit/presets.ts";
import { useKitStore } from "./kit/store.ts";
import {
  addGame,
  classicNotice,
  classicToCode,
  deleteGame,
  autosave,
  flushOnLeave,
  flushSave,
  loadGame,
  loadSession,
  loadTests,
  recoveredMessage,
  renameGame,
  renamed,
  setOpen,
  type EditorMode,
  type GameData,
} from "./project/persist.ts";
import { SOUND_LIBRARY, TEMPLATES } from "./project/templates.ts";
import { ContextItem } from "./ui/ContextStrip.tsx";
import type { LibraryActions } from "./ui/MyGames.tsx";
import type { TestsFile } from "./code/creator-tests.ts";
import { StartChooser, type StartChoice } from "./ui/StartChooser.tsx";
import { toast } from "./ui/Toaster.tsx";

const PRESET_IDS = KIT_PRESETS.map((p) => p.id);

/** The game being edited: its id in My games and which editor it opens in. */
type Current = { id: string; kind: EditorMode };

export function App() {
  const [current, setCurrent] = useState<Current | null | "loading">("loading");
  const [choosing, setChoosing] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  /** Something that changed about a game on the way in, in plain words (a Classic shooter game that's now code). */
  const [notice, setNotice] = useState<string | null>(null);
  /** Asking before ejecting the kit game into a code project. */
  const [ejecting, setEjecting] = useState(false);
  /** The kit game a code project was just ejected from, for the way back. */
  const [ejectedFrom, setEjectedFrom] = useState<{ id: string; title: string } | null>(null);
  const jam = useJamStore((s) => s.brief);
  const only = jam ? offeredPresets(jam, PRESET_IDS) : undefined;

  // A jam link (?jam=…) joins that jam, then tidies the address bar.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get(JAM_PARAM);
    if (raw === null) return;
    const r = decodeBriefParam(raw);
    if (r.ok) useJamStore.getState().join(r.brief);
    else setOpenError(r.errors.join(" "));
    params.delete(JAM_PARAM);
    const rest = params.toString();
    history.replaceState(null, "", `${location.pathname}${rest ? `?${rest}` : ""}${location.hash}`);
  }, []);

  /** Puts a game in its editor. */
  const show = (id: string, data: GameData) => {
    if (data.kind === "kit") useKitStore.getState().load(data.game);
    else useCodeStore.getState().load(data.game);
    setOpen(id, data);
    setCurrent({ id, kind: data.kind });
  };

  useEffect(() => {
    let cancelled = false;
    void loadSession(TEMPLATES).then((s) => {
      if (cancelled) return;
      setOpenError(recoveredMessage(s.recovered));
      setNotice(s.notices.join(" ") || null);
      if (!s.open) return setCurrent(null);
      if (s.open.data.kind === "kit") useGuide.getState().select(s.open.id, s.migrated);
      show(s.open.id, s.open.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Leaving the page (closing the tab, or a phone putting it away) writes any save still waiting.
  useEffect(() => {
    const flush = () => flushOnLeave();
    const hidden = () => document.visibilityState === "hidden" && flush();
    addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);

  /** Adds a game to My games and opens it. */
  const addAndOpen = async (data: GameData, thumbnail?: Uint8Array, preset?: string, tests?: TestsFile) => {
    await flushSave();
    const id = await addGame(data, thumbnail, tests);
    if (data.kind === "kit") {
      // A new game from a starter opens with its getting-started guide.
      if (preset) useGuide.getState().start(preset, true, id);
      else useGuide.getState().start(null, false, id);
    }
    setChoosing(false);
    setEjectedFrom(null);
    show(id, data);
    return id;
  };

  const choose = (c: StartChoice) => {
    if (c.kind === "kit") void addAndOpen({ kind: "kit", game: structuredClone(KIT_PRESETS.find((p) => p.id === c.preset)!.game) }, undefined, c.preset);
    else void addAndOpen({ kind: "code", game: blankCodeProject() });
  };

  /** Opens a game from My games. */
  const openGame = async (id: string) => {
    if (current !== "loading" && current?.id === id) return setChoosing(false);
    const { data, recovered } = await loadGame(id);
    if (!data) {
      setOpenError(recoveredMessage(recovered) ?? "That game couldn't be found in this browser any more.");
      return;
    }
    setOpenError(null);
    setChoosing(false);
    setEjectedFrom(null);
    if (data.kind === "kit") useGuide.getState().select(id);
    show(id, data);
  };

  const library: LibraryActions = {
    current: current === "loading" ? undefined : current?.id,
    onOpen: (id) => void openGame(id),
    async onRename(id, title) {
      if (current !== "loading" && current?.id === id) {
        // The open game: rename it in its editor, which saves it.
        if (current.kind === "kit") {
          const next = renamed({ kind: "kit", game: useKitStore.getState().project }, title).game;
          useKitStore.getState().edit((d) => Object.assign(d, { title: next.title, text: next.text }));
          autosave(id, { kind: "kit", game: useKitStore.getState().project });
        } else {
          useCodeStore.getState().edit((d) => void (d.title = title));
          autosave(id, { kind: "code", game: useCodeStore.getState().project });
        }
        await flushSave();
      } else await renameGame(id, title);
    },
    async onDelete(id) {
      await deleteGame(id);
      if (current !== "loading" && current?.id === id) {
        setOpen(null);
        setChoosing(false);
        setCurrent(null);
      }
    },
  };

  const openBrief = async (file: File) => {
    const r = readBriefText(await file.text());
    if (!r.ok) {
      setOpenError(`Couldn't open ${file.name}: ${r.errors.join(" ")}`);
      return;
    }
    setOpenError(null);
    useJamStore.getState().join(r.brief);
  };

  /** Opens a game file as a new game in My games. */
  const open = async (file: File) => {
    if (file.name.endsWith(JAM_EXTENSION)) return openBrief(file);
    const opened = readCartridgeFile(new Uint8Array(await file.arrayBuffer()), TEMPLATES);
    const r = opened.result;
    if (!r.ok) {
      setOpenError(`Couldn't open ${file.name}: ${r.errors.join(" ")} Pick a file you made with Save game file.`);
      return;
    }
    let data: GameData;
    if ("kit" in r) data = { kind: "kit", game: r.kit };
    else if ("code" in r) data = { kind: "code", game: r.code };
    else {
      // A Classic shooter game: its editor is retired, so it opens as code.
      try {
        data = { kind: "code", game: classicToCode(r.project, TEMPLATES) };
      } catch (e) {
        setOpenError(`Couldn't open ${file.name}: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
      setNotice(classicNotice(data.game.title));
    }
    setOpenError(null);
    await addAndOpen(data, opened.thumbnail, undefined, opened.tests);
    toast(`Opened “${data.game.title || "Untitled"}”. It's in My games now.`);
  };

  const onNew = () => {
    // So My games shows the latest of the open game.
    void flushSave().then(() => setChoosing(true));
  };

  /** Ejects the kit game into a new code project; the kit game is kept. */
  const eject = async () => {
    setEjecting(false);
    if (current === "loading" || !current) return;
    const kit = useKitStore.getState().project;
    const from = { id: current.id, title: kit.title };
    // The kit game's creator tests carry over: the code is the same program, with the same symbols.
    await addAndOpen({ kind: "code", game: ejectKit(kit, SOUND_LIBRARY) }, undefined, undefined, (await loadTests(current.id)) ?? undefined);
    setEjectedFrom(from);
  };

  /** The way back from a code project to the kit game it was just ejected from. */
  const back = ejectedFrom ? { label: `the kit game “${ejectedFrom.title || "Untitled"}”`, go: () => void openGame(ejectedFrom.id) } : undefined;

  /** One of the jam's own starting games (a .cartridge in the brief). */
  const openStarter = (name: string, base64: string) => {
    let r;
    try {
      r = readCartridgeFile(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)), TEMPLATES);
    } catch {
      r = null;
    }
    if (!r?.result.ok || !("kit" in r.result)) {
      setOpenError(`The jam's starting game "${name}" couldn't be opened. Ask the organizer for a new link.`);
      return;
    }
    setOpenError(null);
    void addAndOpen({ kind: "kit", game: r.result.kit }, r.thumbnail, undefined, r.tests);
  };

  if (current === "loading") return <div className="page loading">Loading…</div>;
  // Errors and notes go in the context strip under the top bar (design/DIRECTION.md).
  const banner = (
    <>
      {openError && <ContextItem kind="error" message={openError} onDismiss={() => setOpenError(null)} />}
      {notice && <ContextItem kind="note" message={notice} onDismiss={() => setNotice(null)} />}
    </>
  );

  if (current === null) {
    return (
      <>
        {banner}
        <JamBanner onStarter={openStarter} />
        <StartChooser onChoose={choose} only={only} library={library} />
        <JamLinks onBrief={(f) => void openBrief(f)} />
      </>
    );
  }

  return (
    <>
      {banner}
      <JamBanner onNewGame={onNew} onStarter={openStarter} />
      {current.kind === "kit" ? (
        <KitEditor key={current.id} gameId={current.id} onOpen={(f) => void open(f)} onNew={onNew} onEditAsCode={() => setEjecting(true)} />
      ) : (
        <CodeEditor key={current.id} gameId={current.id} onOpen={(f) => void open(f)} onNew={onNew} back={back} />
      )}
      {ejecting && (
        <EjectDialog title={useKitStore.getState().project.title} kind="kit game" onConfirm={() => void eject()} onClose={() => setEjecting(false)} />
      )}
      {choosing && <StartChooser onChoose={choose} onCancel={() => setChoosing(false)} only={only} library={library} />}
    </>
  );
}
