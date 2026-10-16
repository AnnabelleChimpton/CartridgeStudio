// "What do you want to make?" Shown on a first visit and from New game.

import { KIT_PRESETS } from "../kit/presets.ts";
import type { KitGame } from "../kit/schema.ts";
import { Dialog } from "./Dialog.tsx";
import { SpritePreview } from "./SpritePreview.tsx";

export type StartChoice = { kind: "kit"; preset: string } | { kind: "template"; template: string };

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

const INTRO =
  "Pick a starting game. You can change everything in it: the art, how things move, the room and the rules. Three short steps will show you how.";

function Choices({ onChoose }: { onChoose: (c: StartChoice) => void }) {
  return (
    <div className="chooser-grid">
      {KIT_PRESETS.map((p) => (
        <button key={p.id} type="button" className="chooser-card" onClick={() => onChoose({ kind: "kit", preset: p.id })}>
          <Cast game={p.game} />
          <strong>{p.name}</strong>
          <span className="chooser-kind small">{p.kind}</span>
          <span className="muted small">{p.description}</span>
        </button>
      ))}
      <button type="button" className="chooser-card classic" onClick={() => onChoose({ kind: "template", template: "fixed-shooter" })}>
        <strong>Classic shooter</strong>
        <span className="chooser-kind small">A shooter, in the older editor</span>
        <span className="muted small">Change the art, sounds and speeds of one ready-made game. Fewer things to change.</span>
      </button>
    </div>
  );
}

/** A first visit gets the chooser as the page; New game shows it in a dialog. */
export function StartChooser({ onChoose, onCancel }: { onChoose: (c: StartChoice) => void; onCancel?: () => void }) {
  if (onCancel) {
    return (
      <Dialog title="What do you want to make?" wide onClose={onCancel}>
        <p className="muted">{INTRO}</p>
        <Choices onChoose={onChoose} />
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
    <main className="page">
      <div className="chooser">
        <h2>What do you want to make?</h2>
        <p className="muted">{INTRO}</p>
        <Choices onChoose={onChoose} />
      </div>
    </main>
  );
}
