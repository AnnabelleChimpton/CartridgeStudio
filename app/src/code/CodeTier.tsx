// The Code tab of the kit and template editors: the game as 7800basic, read
// only. On the left, the game's things and rules; picking one marks the lines
// it becomes. Lines the last edit changed are marked too. Below: how full the
// cartridge is, the ROM and source downloads, and the build log. "Edit as
// code" ejects to a code project.
//
// Hook regions (editable islands in the generated code) will slot into the
// same view: the editor already takes line ranges, and only those ranges
// would be editable.

import { useId, useMemo, type ReactNode } from "react";
import { LazyBasicEditor } from "./LazyBasicEditor.tsx";
import type { GraphicThumbs, LineRange } from "./BasicEditor.tsx";
import { CartridgeSpace } from "./CartridgeSpace.tsx";
import { parseBuildLog, type BuildProblem } from "./build-log.ts";
import { markedLines, type CodeRef } from "./markers.ts";
import { RomDownloads } from "./RomDownloads.tsx";
import type { Preview } from "../ui/usePreview.ts";
import "./code.css";

export interface CodeJump {
  key: string;
  name: string;
  /** A longer description (a rule's sentence). */
  detail?: string;
  ref: CodeRef;
}

interface Props {
  preview: Preview;
  title: string;
  /** Groups of things to find in the code ("Things", "Rules"). */
  jumps: { heading: string; items: CodeJump[] }[];
  selected: string | null;
  onSelect: (key: string) => void;
  /** Lines the last edit changed. */
  changed?: LineRange[];
  graphics?: GraphicThumbs;
  onExportSource: () => void;
  onEject: () => void;
  /** Extra stats for this kind of game (the kit's console-time meter). */
  meter?: ReactNode;
}

const describe = (ranges: LineRange[]) => ranges.map((r) => (r.from === r.to ? `line ${r.from}` : `lines ${r.from}–${r.to}`)).join(", ");

export function CodeTier({ preview, title, jumps, selected, onSelect, changed, graphics, onExportSource, onEject, meter }: Props) {
  const ids = useId();
  const { result, lastGood, timing } = preview;
  const source = lastGood?.source;
  const item = jumps.flatMap((g) => g.items).find((j) => j.key === selected);
  const ranges = useMemo(() => (source && item ? markedLines(source, item.ref) : []), [source, item]);
  // A failed build of generated code is our bug: show it plainly, marked where the toolchain says.
  const failed = result?.kind === "failed" ? result : null;
  const problems = useMemo<BuildProblem[]>(() => (failed ? parseBuildLog(failed.log) : []), [failed]);
  const shown = failed?.source || source || "";
  const caption = item
    ? ranges.length
      ? `${item.name}: ${describe(ranges)}.`
      : `${item.name} has no code of its own in this build.`
    : "Pick a thing or a rule to find the code it becomes.";
  const changedText = changed?.length ? ` Your last change touched ${describe(changed.slice(0, 4))}${changed.length > 4 ? " and more" : ""}.` : "";

  return (
    <section className="panel code-tier" aria-labelledby={`${ids}-h`}>
      <h2 id={`${ids}-h`}>Code</h2>
      <div className="code-tier-head">
        <p className="lead">
          This is your game as 7800basic, the language the cartridge is built from. Read it here, or make a copy you write by hand.
        </p>
        <button type="button" onClick={onEject}>
          Edit as code…
        </button>
      </div>
      {failed && (
        <div className="code-ours" role="alert">
          <strong>The generated code didn't build.</strong> That's a Cartridge Studio bug, not something you did; your game is saved.
          {problems.length > 0 && " The toolchain's complaints are marked in the code."}
        </div>
      )}
      <div className="code-split">
        <nav className="code-jumps" aria-label="Find in the code">
          {jumps.map(
            (g) =>
              g.items.length > 0 && (
                <div key={g.heading}>
                  <h3 className="section-h">{g.heading}</h3>
                  <ul>
                    {g.items.map((j) => (
                      <li key={j.key}>
                        <button type="button" className={`code-jump ${selected === j.key ? "active" : ""}`} aria-pressed={selected === j.key} onClick={() => onSelect(j.key)}>
                          <span>{j.name}</span>
                          {j.detail && <span className="muted small">{j.detail}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
          )}
        </nav>
        <div className="code-view">
          <p className="muted small" id={`${ids}-caption`} aria-live="polite">
            {caption}
            {changedText}
          </p>
          <LazyBasicEditor
            value={shown}
            readOnly
            label={`${title || "Game"}: game.bas, as generated (read-only)`}
            describedBy={`${ids}-caption`}
            highlight={ranges}
            changed={changed}
            problems={problems}
            graphics={graphics}
            testId="game-bas"
          />
        </div>
      </div>
      <h3 className="section-h">Cartridge</h3>
      <CartridgeSpace stats={lastGood?.stats} source={source} />
      {meter}
      <div className="toolbar">
        <RomDownloads preview={preview} title={title} />
        <button type="button" className="secondary" title="game.bas, its graphics and build scripts, for 7800basic" disabled={!lastGood} onClick={onExportSource}>
          Export source
        </button>
      </div>
      <details className="small code-log">
        <summary>Build log</summary>
        <p className="muted small" data-testid="build-timing">
          {timing}
        </p>
        <pre className="log">{failed ? `${failed.stage}: ${failed.message}\n${failed.log}` : (lastGood?.log ?? "")}</pre>
      </details>
    </section>
  );
}
