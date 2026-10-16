// How full the cartridge is, from the compiler's own report: ROM left in each
// area, each graphics block, and the zone, stack and reserved-RAM figures.

import type { BuildStats } from "./build-log.ts";

const fmt = (n: number) => n.toLocaleString("en-US");

/** The ROM size game.bas asks for (`set romsize 48k`); 32 KB is 7800basic's default. */
export function romBytes(source: string | undefined): number {
  const m = /^\s+set\s+romsize\s+(\d+)k/im.exec(source ?? "");
  return (m ? Number(m[1]) : 32) * 1024;
}

export function CartridgeSpace({ stats, source }: { stats?: BuildStats; source?: string }) {
  if (!stats?.areas.length) return <p className="muted small" data-testid="rom-space">Build the game to see how full the cartridge is.</p>;
  const total = romBytes(source);
  const main = stats.areas[0]!;
  const free = Math.max(0, main.bytes);
  const pct = Math.round(((total - free) / total) * 100);
  const level = main.bytes < 0 ? "over" : pct > 90 ? "near" : "ok";
  return (
    <div className="cartridge-space" data-testid="rom-space">
      <div className="cpu-label">
        <span>Cartridge space</span>
        <strong className={level}>
          {fmt(main.bytes)} bytes free of {total / 1024} KB
        </strong>
      </div>
      <div className="cpu-bar" role="meter" aria-label="Cartridge space used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, pct)} aria-valuetext={`${pct}% used`}>
        <span className={level} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <dl className="stats">
        {stats.areas.slice(1).map((a) => (
          <div key={a.name}>
            <dt>ROM left in {a.name}</dt>
            <dd>{fmt(a.bytes)} bytes</dd>
          </div>
        ))}
        {stats.graphics.map((g) => (
          <div key={g.block}>
            <dt>Graphics block {g.block}</dt>
            <dd>{fmt(g.bytes)} bytes left</dd>
          </div>
        ))}
        {stats.zoneObjects !== undefined && (
          <div>
            <dt>Sprites per zone</dt>
            <dd>up to {stats.zoneObjects}</dd>
          </div>
        )}
        {stats.stackDepth !== undefined && (
          <div>
            <dt>Gosub depth</dt>
            <dd>{stats.stackDepth} levels</dd>
          </div>
        )}
        {stats.reservedLeft !== undefined && (
          <div>
            <dt>7800basic's reserved RAM</dt>
            <dd>{fmt(stats.reservedLeft)} bytes left</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
