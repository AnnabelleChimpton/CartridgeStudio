// How busy the game keeps the console each frame, from the measured cost
// model. Past full, the console can't keep up and the game won't build, so
// the meter says which single changes would make it fit.

import { placements } from "./edit.ts";
import { CPU_BUDGET, cpuCost } from "./generate.ts";
import { busyFixes } from "./help.ts";
import type { KitTab } from "./presets.ts";
import { MAX_OBJECTS } from "./schema.ts";
import { useKitStore } from "./store.ts";

const WORDS = { ok: "Room to spare", near: "Nearly full", over: "Too busy" };
const TAB_NAMES: Record<KitTab, string> = { things: "Things", room: "Room", rules: "Rules", game: "Game" };

export function CpuMeter({ onGo }: { onGo?: (tab: KitTab) => void }) {
  const game = useKitStore((s) => s.project);
  const placed = placements(game);
  const cost = cpuCost(game, placed);
  const pct = Math.round((cost / CPU_BUDGET) * 100);
  const level = pct > 100 ? "over" : pct > 85 ? "near" : "ok";
  const fixes = level === "over" ? busyFixes(game) : [];
  const enough = fixes.some((f) => f.enough);

  return (
    <div className="cpu-meter" data-testid="cpu-meter">
      <div className="cpu-label">
        <span id="cpu-meter-label">How busy the console is</span>
        <span className={`cpu-word ${level}`}>{WORDS[level]}</span>
      </div>
      <div
        className="cpu-bar"
        role="meter"
        aria-labelledby="cpu-meter-label"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, pct)}
        aria-valuetext={WORDS[level]}
      >
        <span className={level} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      {level === "over" ? (
        <div className="busy-fixes">
          <p className="small">
            Too much is happening at once for the console to keep up, so your latest changes can't be played until something goes.{" "}
            {fixes.length ? (enough ? "Any one of these would fix it:" : "These help the most:") : "Take out some things or rules."}
          </p>
          {fixes.length > 0 && (
            <ul className="small">
              {fixes.map((f) => (
                <li key={f.text}>
                  {f.text}
                  {!f.enough && " (helps, but not enough on its own)"}
                  {onGo && (
                    <>
                      {" "}
                      <button type="button" className="link small" onClick={() => onGo(f.tab)}>
                        Open {TAB_NAMES[f.tab]}
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="muted small">
          {level === "near" ? "Nearly full. Things that move, and “touches” rules, keep it busiest. " : ""}
          {placed.length} of {MAX_OBJECTS} things in the room.
        </p>
      )}
    </div>
  );
}
