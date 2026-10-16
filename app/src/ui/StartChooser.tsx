// "What do you want to make?" Shown on a first visit and from New game.

import { KIT_PRESETS } from "../kit/presets.ts";
import type { KitGame } from "../kit/schema.ts";
import { SpritePreview } from "./SpritePreview.tsx";

export type StartChoice = { kind: "kit"; preset: string } | { kind: "template"; template: string } | { kind: "code" };

function Cast({ game }: { game: KitGame }) {
  return (
    <span className="cast" aria-hidden="true">
      {game.types.slice(0, 3).map((t) => (
        <SpritePreview
          key={t.id}
          sprite={{ id: t.id, role: t.id, width: t.width, height: t.height, palette: t.palette, frames: t.frames }}
          palette={game.palettes.find((p) => p.id === t.palette)}
          scale={t.width > 8 ? 2 : 3}
        />
      ))}
    </span>
  );
}

export function StartChooser({ onChoose, onCancel }: { onChoose: (c: StartChoice) => void; onCancel?: () => void }) {
  return (
    <div className={onCancel ? "chooser-backdrop" : "page"} role={onCancel ? "dialog" : undefined} aria-modal={onCancel ? true : undefined} aria-labelledby="chooser-h">
      <div className="chooser">
        <h2 id="chooser-h">What do you want to make?</h2>
        <p className="muted">Pick a starting game. You can change everything in it: the art, how things move, the room and the rules.</p>
        <div className="chooser-grid">
          {KIT_PRESETS.map((p) => (
            <button key={p.id} type="button" className="chooser-card" onClick={() => onChoose({ kind: "kit", preset: p.id })}>
              <Cast game={p.game} />
              <strong>{p.name}</strong>
              <span className="muted small">{p.description}</span>
            </button>
          ))}
          <button type="button" className="chooser-card classic" onClick={() => onChoose({ kind: "template", template: "fixed-shooter" })}>
            <strong>Classic shooter</strong>
            <span className="muted small">The original template: 18 vacuums, tuned by hand. Fewer choices, more polish.</span>
          </button>
          <button type="button" className="chooser-card classic" onClick={() => onChoose({ kind: "code" })}>
            <strong>Write code</strong>
            <span className="muted small">A small 7800basic program to start from, with the same live preview. For coders.</span>
          </button>
        </div>
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
