// How much of each frame the game needs, from the measured cost model. Over
// 100% the console can't keep up, and the game won't build.

import { placements } from "./edit.ts";
import { CPU_BUDGET, cpuCost } from "./generate.ts";
import { MAX_OBJECTS } from "./schema.ts";
import { useKitStore } from "./store.ts";

export function CpuMeter() {
  const game = useKitStore((s) => s.project);
  const placed = placements(game);
  const cost = cpuCost(game, placed);
  const pct = Math.round((cost / CPU_BUDGET) * 100);
  const level = pct > 100 ? "over" : pct > 85 ? "near" : "ok";

  return (
    <div className="cpu-meter" data-testid="cpu-meter">
      <div className="cpu-label">
        <span>Console time</span>
        <strong className={level}>{pct}%</strong>
      </div>
      <div className="cpu-bar" role="meter" aria-label="Console time" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <span className={level} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <p className="muted small">
        {level === "over"
          ? "Too busy for the console to run smoothly: remove some things or rules."
          : level === "near"
            ? "Nearly full. Moving things and touch rules cost the most."
            : "Room to spare."}{" "}
        {placed.length} of {MAX_OBJECTS} things.
      </p>
    </div>
  );
}
