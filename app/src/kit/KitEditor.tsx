// The kit editor: one job at a time on the left (things, the room, rules,
// game settings or the code they become, each with room to work), and the
// running game on the right with every way to show it off. A starter game
// opens with a short guide.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { GraphicThumbs } from "../code/BasicEditor.tsx";
import { CodeTier, type CodeJump } from "../code/CodeTier.tsx";
import { ejectKit } from "../code/eject.ts";
import { useGeneratedDiff } from "../code/useGeneratedDiff.ts";
import { writeCartridgeFile } from "../files/cartridge-file.ts";
import { CARTRIDGE_EXTENSION } from "../files/cartridge-file.ts";
import { KIT_TOOLCHAIN, folderZip, kitSourceFiles, slugify } from "../files/exports.ts";
import { encodeRgbaPng } from "../files/png.ts";
import { JamEntryPanel } from "../jam/JamEntryPanel.tsx";
import { kitFacts } from "../jam/limits.ts";
import { saveKitGame } from "../project/persist.ts";
import { SOUND_LIBRARY } from "../project/templates.ts";
import { arrowKeys, tabProps } from "../ui/a11y.ts";
import { PreviewPanel } from "../ui/PreviewPanel.tsx";
import { ShowItPanel } from "../ui/ShowItPanel.tsx";
import { useTier } from "../ui/prefs.ts";
import { TopBar } from "../ui/TopBar.tsx";
import { download, usePreview } from "../ui/usePreview.ts";
import { CpuMeter } from "./CpuMeter.tsx";
import { isPlayer, type Brush } from "./edit.ts";
import { GUIDE_STEPS, useCurrentGuide, useGuide, type GuideStep } from "./guide.ts";
import { explainError } from "./help.ts";
import { GUIDE_TAB, KitGuide, guideAnnouncement } from "./KitGuide.tsx";
import { KIT_RUNTIME_VERSION } from "./generate.ts";
import { KitPrint } from "./KitPrint.tsx";
import { KitRulesPanel } from "./KitRulesPanel.tsx";
import { KitSettingsPanel } from "./KitSettingsPanel.tsx";
import { KIT_PRESETS, type KitIdea, type KitTab } from "./presets.ts";
import { RoomPainter } from "./RoomPainter.tsx";
import { ruleSentence } from "./sentence.ts";
import { ThingsPanel } from "./ThingsPanel.tsx";
import type { KitGame } from "./schema.ts";
import { useKitStore } from "./store.ts";

const SAVE_DEBOUNCE_MS = 500;

/** The editor's tabs: the ones a guide step or idea can open, plus the code they become. */
type Tab = KitTab | "code";

const TABS: { id: Tab; label: string }[] = [
  { id: "things", label: "Things" },
  { id: "room", label: "Room" },
  { id: "rules", label: "Rules" },
  { id: "game", label: "Game" },
  { id: "code", label: "Code" },
];

/** Each thing's frames by id, to tell whether any pixel of an existing thing changed. */
function drawn(a: KitGame, b: KitGame) {
  return a.types.some((t) => {
    const was = b.types.find((u) => u.id === t.id);
    return was !== undefined && JSON.stringify(was.frames) !== JSON.stringify(t.frames);
  });
}

interface Props {
  onOpen: (file: File) => void;
  onNew: () => void;
  /** Makes a code project from this game (after asking). */
  onEditAsCode?: () => void;
}

export function KitEditor({ onOpen, onNew, onEditAsCode }: Props) {
  const game = useKitStore((s) => s.project);
  const canUndo = useKitStore((s) => s.past.length > 0);
  const canRedo = useKitStore((s) => s.future.length > 0);
  const { edit, undo, redo } = useKitStore.getState();
  const preview = usePreview(game);
  const [selected, setSelected] = useState<string | null>(() => (game.types.find(isPlayer) ?? game.types[0])?.id ?? null);
  const [chosenTab, setTab] = useState<Tab>("things");
  // The Code tab is for the Coder tier (design/DIRECTION.md, Three tiers); Starter and Maker see the rest.
  const tier = useTier();
  const tabs = TABS.filter((t) => tier === "coder" || t.id !== "code");
  const tab = tabs.some((t) => t.id === chosenTab) ? chosenTab : "things";
  const [brush, setBrush] = useState<Brush>("wall");
  const ids = useId();
  /** What the Code tab marks: the chosen thing, or the rule last clicked or focused (`thing:<id>`, `rule:<n>`). */
  const [codeKey, setCodeKey] = useState<string | null>(null);
  const selectThing = (id: string | null) => {
    setSelected(id);
    setCodeKey(id && `thing:${id}`);
  };
  /** Rules are cards in a list; whichever one is clicked or focused is the selected rule. */
  const noticeRule = (e: React.SyntheticEvent) => {
    const li = (e.target as Element).closest?.("ol.rules > li");
    if (!li?.parentElement) return;
    setCodeKey(`rule:${[...li.parentElement.children].indexOf(li) + 1}`);
  };
  const jumps = useMemo(
    () => [
      { heading: "Things", items: game.types.map((t): CodeJump => ({ key: `thing:${t.id}`, name: t.label, ref: { thing: t.label, palette: t.palette } })) },
      { heading: "Rules", items: game.rules.map((r, i): CodeJump => ({ key: `rule:${i + 1}`, name: `Rule ${i + 1}`, detail: ruleSentence(r, game), ref: { rule: i + 1 } })) },
    ],
    [game],
  );
  const changed = useGeneratedDiff(preview.lastGood?.source);
  // The graphics as the gutter shows them; only worked out while the Code tab is open.
  const thumbs = useMemo<GraphicThumbs | undefined>(() => {
    if (tab !== "code") return undefined;
    try {
      const code = ejectKit(game, SOUND_LIBRARY);
      return Object.fromEntries(
        code.graphics.map((g) => [g.name.toLowerCase(), { rows: g.rows, colors: code.palettes.find((p) => p.id === g.palette)?.colors ?? [] }]),
      );
    } catch {
      return undefined; // a game that doesn't generate has no graphics to show
    }
  }, [tab, game]);

  // The getting-started guide.
  const guideId = useGuide((s) => s.current);
  const guide = useCurrentGuide();
  const preset = KIT_PRESETS.find((p) => p.id === guide?.preset) ?? KIT_PRESETS.find((p) => p.game.title === game.title);
  // What the game looked like when its guide started, to see what's changed since.
  const base = useRef({ id: guideId, game });
  if (base.current.id !== guideId) base.current = { id: guideId, game };
  const baseline = KIT_PRESETS.find((p) => p.id === guide?.preset)?.game ?? base.current.game;
  const hero = game.types.find(isPlayer) ?? game.types[0];
  const [announce, setAnnounce] = useState("");
  const guideRef = useRef<HTMLElement>(null);
  const guideButton = useRef<HTMLButtonElement>(null);
  const focusGuide = useRef(false);
  const guideOpen = !!guide?.open;
  const current = guide && GUIDE_STEPS.find((s) => !guide.done.includes(s));

  const tick = (step: GuideStep) => {
    const g = useGuide.getState();
    const now = g.current ? g.games[g.current] : undefined;
    if (!now || now.done.includes(step)) return;
    g.complete(step);
    if (now.open) setAnnounce(guideAnnouncement(step, [...now.done, step]));
  };
  const tickRef = useRef(tick);
  tickRef.current = tick;

  useEffect(() => {
    if (!guide) return;
    if (!guide.done.includes("draw") && drawn(game, baseline)) tick("draw");
    if (!guide.done.includes("rule") && JSON.stringify(game.rules) !== JSON.stringify(baseline.rules)) tick("rule");
  });

  // Playing the game (focusing it, here or on the TV) ticks "Play it on the TV".
  useEffect(() => {
    const stage = preview.stage.current;
    const onFocus = () => tickRef.current("tv");
    stage?.addEventListener("focusin", onFocus);
    return () => stage?.removeEventListener("focusin", onFocus);
  }, [preview.stage]);

  useEffect(() => {
    if (guideOpen && focusGuide.current) guideRef.current?.focus();
    focusGuide.current = false;
  }, [guideOpen]);

  /** Opens a tab and puts the keyboard in the matching tab button, or the thing to work on. */
  const openTab = (t: KitTab, focus?: string) => {
    setTab(t);
    requestAnimationFrame(() => (document.querySelector<HTMLElement>(focus ?? "") ?? document.getElementById(`${ids}-${t}`))?.focus());
  };
  const onStep = (step: GuideStep) => {
    if (step === "draw") {
      if (hero) setSelected(hero.id);
      openTab("things", 'canvas[aria-roledescription="pixel grid"]');
    } else if (step === "rule") openTab("rules");
    else preview.enterTv();
  };
  const onIdea = (idea: KitIdea) => {
    if (idea.thing && game.types.some((t) => t.id === idea.thing)) setSelected(idea.thing);
    openTab(idea.tab);
  };

  useEffect(() => {
    window.__cs!.kitStore = useKitStore;
  }, []);

  // Autosave.
  useEffect(() => {
    const timer = setTimeout(() => void saveKitGame(game), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [game]);

  const cartridgeFile = async () => {
    const shot = await preview.screenshot().catch(() => undefined);
    return writeCartridgeFile(game, shot && encodeRgbaPng(shot.width, shot.height, shot.rgba));
  };
  const exportSource = async () => {
    const files = kitSourceFiles(game, SOUND_LIBRARY, {
      symbols: preview.lastGood?.symbols,
      cartridge: { name: `${slugify(game.title)}${CARTRIDGE_EXTENSION}`, bytes: await cartridgeFile() },
    });
    download(folderZip(game.title, "source", files), `${slugify(game.title)}-source.zip`);
  };
  const save = async () => download(await cartridgeFile(), `${slugify(game.title)}${CARTRIDGE_EXTENSION}`);

  return (
    <div className="page">
      <TopBar
        title={game.title}
        onTitle={(t) =>
          edit((d) => {
            // The title screen follows the game's title until it's given words of its own (Game tab).
            if (d.text.title === d.title) d.text.title = t;
            d.title = t;
          }, "title")
        }
        kind="Game kit"
        canUndo={canUndo}
        canRedo={canRedo}
        undo={undo}
        redo={redo}
        onOpen={onOpen}
        onSave={() => void save()}
        onNew={onNew}
        extra={
          <button
            ref={guideButton}
            type="button"
            className="secondary"
            aria-expanded={guideOpen}
            onClick={() => {
              focusGuide.current = !guideOpen;
              useGuide.getState().setOpen(!guideOpen);
            }}
          >
            <span aria-hidden="true">?</span> Guide
          </button>
        }
      />
      <p role="status" className="visually-hidden">
        {announce}
      </p>
      <main className="workspace-layout">
        <div className="workspace">
          {guide?.open && hero && (
            <KitGuide
              ref={guideRef}
              hero={hero.label}
              done={guide.done}
              ideas={preset?.ideas ?? []}
              onStep={onStep}
              onIdea={onIdea}
              onClose={() => {
                useGuide.getState().setOpen(false);
                guideButton.current?.focus();
              }}
            />
          )}
          <div className="workspace-tabs" role="tablist" aria-label="Edit" onKeyDown={arrowKeys("tab")}>
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                {...tabProps(tab === t.id)}
                id={`${ids}-${t.id}`}
                data-tab={t.id}
                aria-controls={`${ids}-panel`}
                className={[tab === t.id && "active", guideOpen && current && GUIDE_TAB[current] === t.id && "guide-target"].filter(Boolean).join(" ") || undefined}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="workspace-panel" role="tabpanel" id={`${ids}-panel`} aria-labelledby={`${ids}-${tab}`}>
            {tab === "things" && (
              <ThingsPanel
                selected={selected}
                onSelect={selectThing}
                onPlace={(id) => {
                  setBrush(id);
                  openTab("room", '[aria-label="Room grid"]');
                }}
              />
            )}
            {tab === "room" && <RoomPainter brush={brush} setBrush={setBrush} />}
            {tab === "rules" && (
              <div onFocusCapture={noticeRule} onClickCapture={noticeRule}>
                <KitRulesPanel />
              </div>
            )}
            {tab === "game" && <KitSettingsPanel />}
            {tab === "code" && (
              <CodeTier
                preview={preview}
                title={game.title}
                jumps={jumps}
                selected={codeKey ?? (selected && `thing:${selected}`)}
                onSelect={setCodeKey}
                changed={changed}
                graphics={thumbs}
                onExportSource={() => void exportSource()}
                onEject={() => onEditAsCode?.()}
              />
            )}
          </div>
        </div>
        <div className={`play-column${guideOpen && current === "tv" ? " guide-play" : ""}`}>
          <PreviewPanel
            preview={preview}
            title={game.title}
            meter={<CpuMeter onGo={(t) => openTab(t)} />}
            explainError={explainError}
          />
          <ShowItPanel
            preview={preview}
            title={game.title}
            print={<KitPrint screenshot={preview.screenshot} buildSigned={preview.buildSigned} cartridgeFile={cartridgeFile} onDownload={download} />}
          />
          <JamEntryPanel
            preview={preview}
            gameTitle={game.title}
            cartridgeFile={cartridgeFile}
            facts={kitFacts(game)}
            runtime={`kit runtime ${KIT_RUNTIME_VERSION}`}
            toolchain={KIT_TOOLCHAIN}
          />
        </div>
      </main>
    </div>
  );
}
