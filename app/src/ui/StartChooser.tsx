// "What do you want to make?" Shown on a first visit and from New game.

import { useEffect, useState } from "react";
import { KIT_PRESETS } from "../kit/presets.ts";
import type { KitGame } from "../kit/schema.ts";
import { getTemplate } from "../project/templates.ts";
import type { Palette, Sprite } from "../project/schema.ts";
import { Dialog } from "./Dialog.tsx";
import { ntscCss } from "./ntsc.ts";
import { TIERS, useTier } from "./prefs.ts";
import { SpritePreview } from "./SpritePreview.tsx";
import { Brand } from "./TopBar.tsx";

export type StartChoice = { kind: "kit"; preset: string } | { kind: "template"; template: string } | { kind: "code" };

const FRAME_MS = 320;
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A sprite that steps through its frames, as it does in the game, while `playing`. Still with reduced motion. */
function CastSprite({ sprite, palette, scale, playing }: { sprite: Sprite; palette?: Palette; scale: number; playing: boolean }) {
  const [frame, setFrame] = useState(0);
  const frames = sprite.frames.length;
  useEffect(() => {
    if (!playing || frames < 2 || reducedMotion()) return setFrame(0);
    const t = setInterval(() => setFrame((f) => (f + 1) % frames), FRAME_MS);
    return () => clearInterval(t);
  }, [frames, playing]);
  return <SpritePreview sprite={{ ...sprite, frames: [sprite.frames[frame]!] }} palette={palette} scale={scale} />;
}

function Screen({ background, cast, playing }: { background: string; cast: { sprite: Sprite; palette?: Palette }[]; playing: boolean }) {
  return (
    <span className="card-screen" style={{ background: ntscCss(background) }} aria-hidden="true">
      <span className="cast">
        {cast.map(({ sprite, palette }, i) => (
          <span key={sprite.id} className="cast-member" style={{ animationDelay: `${i * 60}ms` }}>
            <CastSprite sprite={sprite} palette={palette} scale={sprite.width > 8 ? 2 : 3} playing={playing} />
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

const INTRO =
  "Pick a starting game. You can change everything in it: the art, how things move, the room and the rules. Three short steps will show you how.";

/** The starting games. `only` limits them to these ids (kit presets and "fixed-shooter"), e.g. for a jam. */
function Choices({ onChoose, only }: { onChoose: (c: StartChoice) => void; only?: readonly string[] }) {
  const offered = (id: string) => !only || only.includes(id);
  const classic = getTemplate("fixed-shooter").sample;
  // The card under the pointer or keyboard plays its cast's animation.
  const [live, setLive] = useState<string | null>(null);
  const liveProps = (id: string) => ({
    onMouseEnter: () => setLive(id),
    onMouseLeave: () => setLive((l) => (l === id ? null : l)),
    onFocus: () => setLive(id),
    onBlur: () => setLive((l) => (l === id ? null : l)),
  });
  return (
    <div className="chooser-grid">
      {KIT_PRESETS.filter((p) => offered(p.id)).map((p) => (
        <button key={p.id} type="button" className="chooser-card" {...liveProps(p.id)} onClick={() => onChoose({ kind: "kit", preset: p.id })}>
          <Screen background={p.game.background} cast={kitCast(p.game)} playing={live === p.id} />
          <span className="card-body">
            <strong>{p.name}</strong>
            <span className="chooser-kind small">{p.kind}</span>
            <span className="muted small">{p.description}</span>
          </span>
        </button>
      ))}
      {offered("fixed-shooter") && (
        <button
          type="button"
          className="chooser-card classic"
          {...liveProps("classic")}
          onClick={() => onChoose({ kind: "template", template: "fixed-shooter" })}
        >
          <Screen background={classic.background.color} cast={classicCast()} playing={live === "classic"} />
          <span className="card-body">
            <strong>Classic shooter</strong>
            <span className="chooser-kind small">A shooter, in the older editor</span>
            <span className="muted small">Change the art, sounds and speeds of one ready-made game. Fewer things to change.</span>
          </span>
        </button>
      )}
      {!only && (
        <button type="button" className="chooser-card classic" onClick={() => onChoose({ kind: "code" })}>
          <span className="card-body">
            <strong>Write code</strong>
            <span className="chooser-kind small">For coders</span>
            <span className="muted small">A small 7800basic program to start from, with the same live preview.</span>
          </span>
        </button>
      )}
    </div>
  );
}

/** A first visit gets the chooser as the page; New game shows it in a dialog. */
export function StartChooser({ onChoose, onCancel, only }: { onChoose: (c: StartChoice) => void; onCancel?: () => void; only?: readonly string[] }) {
  if (onCancel) {
    return (
      <Dialog title="What do you want to make?" wide onClose={onCancel}>
        <p className="muted">{INTRO}</p>
        <Choices onChoose={onChoose} only={only} />
        <div className="toolbar">
          <span className="spacer" />
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </Dialog>
    );
  }
  return (
    <main className="page start">
      <header className="start-head">
        <Brand />
      </header>
      <div className="chooser">
        <h2>What do you want to make?</h2>
        <p className="muted chooser-lead">{INTRO}</p>
        <Choices onChoose={onChoose} only={only} />
        <TierNote />
      </div>
    </main>
  );
}
