import { placements } from "./edit.ts";
import { CPU_BUDGET, cpuCost } from "./generate.ts";
import { busyFixes } from "./help.ts";
import type { KitTab } from "./presets.ts";
import { MAX_OBJECTS } from "./schema.ts";
import { useKitStore } from "./store.ts";

const TAB_NAMES: Record<KitTab, string> = { things: "Things", room: "Room", rules: "Rules", game: "Game" };

/** How busy the game keeps the console each frame. Silent until it gets close to the limit. */
export function CpuMeter({ onGo }: { onGo?: (tab: KitTab) => void }) {
  const game = useKitStore((s) => s.project);
  const placed = placements(game);
  const pct = Math.round((cpuCost(game, placed) / CPU_BUDGET) * 100);
  if (pct < 80) return null;
  const over = pct > 100;
  const fixes = over ? busyFixes(game) : [];
  const enough = fixes.some((f) => f.enough);
  const text = `Busy: ${placed.length} of ${MAX_OBJECTS} things moving. The kit stops new things that would slow the game.`;

  return (
    <div className="cpu-meter" data-testid="cpu-meter">
      <div
        className="cpu-bar"
        role="meter"
        aria-label="Console time"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, pct)}
        aria-valuetext={over ? "Too busy" : `${pct}%`}
      >
        <span className={over ? "over" : "near"} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      {over ? (
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
        <p className="small">{text}</p>
      )}
    </div>
  );
}
