import { useEffect, useRef, useState, type ReactNode } from "react";
import { KIT_PRESETS } from "../kit/presets.ts";
import type { KitGame } from "../kit/schema.ts";
import type { Palette, Sprite } from "../project/schema.ts";
import { AboutDialog } from "./About.tsx";
import { ContextStrip } from "./ContextStrip.tsx";
import { Dialog } from "./Dialog.tsx";
import { MyGames, type LibraryActions } from "./MyGames.tsx";
import { ntscCss } from "./ntsc.ts";
import { SpritePreview } from "./SpritePreview.tsx";
import { KitText } from "./BrandMark.tsx";
import { Brand } from "./TopBar.tsx";
import "./start.css";

export type StartChoice = { kind: "kit"; preset: string } | { kind: "code" };

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

function kitCast(game: KitGame) {
  return game.types.slice(0, 3).map((t) => ({
    sprite: { id: t.id, role: t.id, width: t.width, height: t.height, palette: t.palette, frames: t.frames },
    palette: game.palettes.find((p) => p.id === t.palette),
  }));
}

/** A cartridge seen from the front: grip ridges, then the label with its title band and a window. */
export function Cart({ title, background, small, children }: { title?: string; background: string; small?: boolean; children: ReactNode }) {
  return (
    <span className={`cart${small ? " cart-small" : ""}`}>
      <span className="cart-label" style={{ background }}>
        <span className="cart-band">{title && <KitText text={title} maxChars={20} />}</span>
        <span className="cart-window">{children}</span>
      </span>
    </span>
  );
}

/** The starting games on a shelf. `only` limits them to these kit presets, e.g. for a jam. */
function Shelf({ onChoose, only }: { onChoose: (c: StartChoice) => void; only?: readonly string[] }) {
  // The cart under the pointer or keyboard plays its cast's animation.
  const [live, setLive] = useState<string | null>(null);
  const liveProps = (id: string) => ({
    onMouseEnter: () => setLive(id),
    onMouseLeave: () => setLive((l) => (l === id ? null : l)),
    onFocus: () => setLive(id),
    onBlur: () => setLive((l) => (l === id ? null : l)),
  });
  return (
    <ul className="shelf">
      {KIT_PRESETS.filter((p) => !only || only.includes(p.id)).map((p) => (
        <li key={p.id}>
          <button type="button" className="cart-pick" {...liveProps(p.id)} onClick={() => onChoose({ kind: "kit", preset: p.id })}>
            <Cart title={p.name} background={ntscCss(p.game.background)}>
              <span className="cart-cast" aria-hidden="true">
                {kitCast(p.game).map(({ sprite, palette }) => (
                  <CastSprite key={sprite.id} sprite={sprite} palette={palette} scale={sprite.width > 8 ? 2 : 3} playing={live === p.id} />
                ))}
              </span>
            </Cart>
            <span className="cart-note">{p.description}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Blank({ onChoose, only }: { onChoose: (c: StartChoice) => void; only?: readonly string[] }) {
  if (only) return null;
  return (
    <p className="start-blank">
      <button type="button" className="link" onClick={() => onChoose({ kind: "code" })}>
        Or start from a blank 7800basic program
      </button>
    </p>
  );
}

function StartFooter() {
  const [about, setAbout] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  return (
    <footer className="start-foot">
      <button ref={opener} type="button" className="link" onClick={() => setAbout(true)}>
        About and licences
      </button>{" "}
      · Running a jam? <a href="organize.html">How to run one</a>
      {about && <AboutDialog onClose={() => setAbout(false)} returnTo={opener.current} />}
    </footer>
  );
}

/** A first visit gets the shelf as the page. New game shows it in a dialog, under My games. */
export function StartChooser({
  onChoose,
  onCancel,
  only,
  library,
}: {
  onChoose: (c: StartChoice) => void;
  onCancel?: () => void;
  only?: readonly string[];
  library?: LibraryActions;
}) {
  if (onCancel) {
    return (
      <Dialog title="Open a game" wide onClose={onCancel}>
        <div className="start-dialog">
          {library && <MyGames {...library} />}
          <h2 className="start-h">Starters</h2>
          <Shelf onChoose={onChoose} only={only} />
          <Blank onChoose={onChoose} only={only} />
          <div className="toolbar">
            <span className="spacer" />
            <button type="button" className="secondary" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      </Dialog>
    );
  }
  return (
    <main className="page start">
      <header className="start-head">
        <Brand />
      </header>
      <div className="start-strip">
        <ContextStrip />
      </div>
      <div className="start-pick">
        <h2 className="start-title">Pick a cart to start from</h2>
        <p className="start-lead">They all play. Open one and change it.</p>
        <Shelf onChoose={onChoose} only={only} />
        <Blank onChoose={onChoose} only={only} />
        {library && <MyGames {...library} />}
        <StartFooter />
      </div>
    </main>
  );
}
