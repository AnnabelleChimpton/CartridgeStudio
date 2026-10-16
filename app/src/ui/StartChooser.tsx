// "What do you want to make?" Shown on a first visit and from New game.

import { useEffect, useRef, useState } from "react";
import { KIT_PRESETS } from "../kit/presets.ts";
import type { KitGame } from "../kit/schema.ts";
import { getTemplate } from "../project/templates.ts";
import type { Palette, Sprite } from "../project/schema.ts";
import { Icon } from "./Icon.tsx";
import { ntscCss } from "./ntsc.ts";
import { TIERS, useTier } from "./prefs.ts";
import { SpritePreview } from "./SpritePreview.tsx";
import { Brand, ThemeButton } from "./TopBar.tsx";

export type StartChoice = { kind: "kit"; preset: string } | { kind: "template"; template: string };

const FRAME_MS = 320;
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A sprite stepping through its frames, as it does in the game. Still with reduced motion. */
function CastSprite({ sprite, palette, scale }: { sprite: Sprite; palette?: Palette; scale: number }) {
  const [frame, setFrame] = useState(0);
  const frames = sprite.frames.length;
  useEffect(() => {
    if (frames < 2 || reducedMotion()) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % frames), FRAME_MS);
    return () => clearInterval(t);
  }, [frames]);
  return <SpritePreview sprite={{ ...sprite, frames: [sprite.frames[frame]!] }} palette={palette} scale={scale} />;
}

function Screen({ background, cast }: { background: string; cast: { sprite: Sprite; palette?: Palette }[] }) {
  return (
    <span className="card-screen" style={{ background: ntscCss(background) }} aria-hidden="true">
      <span className="cast">
        {cast.map(({ sprite, palette }, i) => (
          <span key={sprite.id} className="cast-member" style={{ animationDelay: `${i * 60}ms` }}>
            <CastSprite sprite={sprite} palette={palette} scale={sprite.width > 8 ? 2 : 3} />
          </span>
        ))}
      </span>
    </span>
  );
}

function kitCast(game: KitGame) {
  return game.types.slice(0, 3).map((t) => ({
    sprite: { id: t.id, role: t.id, width: t.width, height: t.height, palette: t.palette, frames: t.frames },
    palette: game.palettes.find((p) => p.id === t.palette),
  }));
}

function classicCast() {
  const sample = getTemplate("fixed-shooter").sample;
  return sample.sprites
    .filter((s) => s.id === "player" || s.id === "enemy")
    .reverse()
    .map((s) => ({ sprite: s, palette: sample.palettes.find((p) => p.id === s.palette) }));
}

function TierNote() {
  const tier = TIERS.find((t) => t.id === useTier())!;
  return (
    <p className="muted small chooser-foot">
      You're in <strong>{tier.label}</strong> mode: {tier.detail.charAt(0).toLowerCase() + tier.detail.slice(1)} Change it any time
      from Mode in the top bar.
    </p>
  );
}

export function StartChooser({ onChoose, onCancel }: { onChoose: (c: StartChoice) => void; onCancel?: () => void }) {
  const classic = getTemplate("fixed-shooter").sample;
  const grid = useRef<HTMLDivElement>(null);
  // As a dialog: focus moves in, and Escape cancels.
  useEffect(() => {
    if (onCancel) grid.current?.querySelector<HTMLElement>("button")?.focus();
  }, [onCancel !== undefined]);
  return (
    <div
      className={onCancel ? "chooser-backdrop" : "page start"}
      role={onCancel ? "dialog" : undefined}
      aria-modal={onCancel ? true : undefined}
      aria-labelledby="chooser-h"
      onKeyDown={onCancel && ((e) => e.key === "Escape" && onCancel())}
    >
      {!onCancel && (
        <header className="start-head">
          <Brand />
          <span className="spacer" />
          <ThemeButton />
        </header>
      )}
      <div className="chooser">
        {onCancel && (
          <button type="button" className="icon chooser-close" aria-label="Close" onClick={onCancel}>
            <Icon name="close" />
          </button>
        )}
        <h2 id="chooser-h">What do you want to make?</h2>
        <p className="muted chooser-lead">Pick a starting game. You can change everything in it: the art, how things move, the room and the rules.</p>
        <div className="chooser-grid" ref={grid}>
          {KIT_PRESETS.map((p) => (
            <button key={p.id} type="button" className="chooser-card" onClick={() => onChoose({ kind: "kit", preset: p.id })}>
              <Screen background={p.game.background} cast={kitCast(p.game)} />
              <span className="card-body">
                <strong>{p.name}</strong>
                <span className="muted small">{p.description}</span>
              </span>
            </button>
          ))}
          <button type="button" className="chooser-card classic" onClick={() => onChoose({ kind: "template", template: "fixed-shooter" })}>
            <Screen background={classic.background.color} cast={classicCast()} />
            <span className="card-body">
              <strong>Classic shooter</strong>
              <span className="muted small">The original template: 18 vacuums, tuned by hand. Fewer choices, more polish.</span>
            </span>
          </button>
        </div>
        {!onCancel && <TierNote />}
        {onCancel && (
          <div className="toolbar">
            <span className="spacer" />
            <button type="button" className="secondary" onClick={onCancel}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
