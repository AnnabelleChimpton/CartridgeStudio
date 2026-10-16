// "Show it": every way a game leaves the editor, in plain words. Play it big
// on a TV, send a one-file player to family, record a clip to post, put it on
// a real console, or print a box and manual.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { slugify } from "../files/exports.ts";
import { useRecentClip } from "../files/recent-clip.ts";
import { Dialog } from "./Dialog.tsx";
import { download, type Preview } from "./usePreview.ts";

/** Clips: 20 frames a second (every 3rd frame), up to 10 seconds. */
const CLIP_EVERY = 3;
const CLIP_SECONDS = 10;
const CLIP_MAX = (60 / CLIP_EVERY) * CLIP_SECONDS;

interface Props {
  preview: Preview;
  title: string;
  /** The print dialog's contents, or a callback that shows printing elsewhere (e.g. a tab). */
  print: ReactNode | (() => void);
}

type Open = null | "tv" | "console" | "print";

export function ShowItPanel({ preview, title, print }: Props) {
  const [open, setOpen] = useState<Open>(null);
  /** The button that opened the dialog, for focus to return to. */
  const opener = useRef<HTMLElement | null>(null);
  const openFrom = (what: Open) => (e: React.MouseEvent<HTMLElement>) => {
    opener.current = e.currentTarget;
    setOpen(what);
  };
  const [busy, setBusy] = useState<null | "player" | "clip">(null);
  const [error, setError] = useState<string | null>(null);
  const ready = !!preview.lastGood;
  const slug = slugify(title);

  const sendToFamily = async () => {
    const built = preview.lastGood;
    if (!built) return;
    setBusy("player");
    setError(null);
    try {
      const { buildPlayerHtml } = await import("../player/player.ts");
      download(new TextEncoder().encode(await buildPlayerHtml(title, built.a78)), `${slug}.html`);
    } catch (e) {
      setError(`We couldn't make the game file: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="panel show-it" aria-labelledby="show-it-h">
      <h2 id="show-it-h">Show it</h2>
      <div className="show-grid">
        <ShowButton title="Play on a TV" detail="Big screen, ready for a gamepad" disabled={!ready} onClick={preview.enterTv} />
        <ShowButton
          title={busy === "player" ? "Making the file…" : "Send to family"}
          detail="One file that plays in any web browser"
          disabled={!ready || busy !== null}
          onClick={() => void sendToFamily()}
        />
        <ClipRecorder preview={preview} slug={slug} disabled={!ready || busy === "player"} onBusy={(b) => setBusy(b ? "clip" : null)} onError={setError} />
        <ShowButton title="Put it on a console" detail="For a 7800+, 2600+ or 7800" disabled={!ready} onClick={openFrom("console")} />
        <ShowButton
          title="Print the box"
          detail="Box, cartridge labels and manual"
          disabled={!ready}
          onClick={(e) => (typeof print === "function" ? print() : openFrom("print")(e))}
        />
      </div>
      <p className="muted small">
        <button type="button" className="link" onClick={openFrom("tv")}>
          How do I connect a TV?
        </button>
      </p>
      {error && <p className="error">{error}</p>}

      {open === "tv" && (
        <Dialog title="Show it on a TV" returnTo={opener.current} onClose={() => setOpen(null)}>
          <TvGuide
            onPlay={() => {
              setOpen(null);
              preview.enterTv();
            }}
          />
        </Dialog>
      )}
      {open === "console" && (
        <Dialog title="Put it on a console" returnTo={opener.current} onClose={() => setOpen(null)}>
          <ConsoleGuide preview={preview} slug={slug} />
        </Dialog>
      )}
      {open === "print" && typeof print !== "function" && (
        <Dialog title="Print the box" wide returnTo={opener.current} onClose={() => setOpen(null)}>
          {print}
        </Dialog>
      )}
    </section>
  );
}

function ShowButton({
  title,
  detail,
  disabled,
  onClick,
}: {
  title: string;
  detail: string;
  disabled?: boolean;
  onClick: (e: React.MouseEvent<HTMLElement>) => void;
}) {
  return (
    <button type="button" className="show-button" disabled={disabled} onClick={onClick}>
      <strong>{title}</strong>
      <span>{detail}</span>
    </button>
  );
}

function ClipRecorder({
  preview,
  slug,
  disabled,
  onBusy,
  onError,
}: {
  preview: Preview;
  slug: string;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
  onError: (e: string | null) => void;
}) {
  const [state, setState] = useState<"idle" | "recording" | "saving">("idle");
  const [seconds, setSeconds] = useState(0);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (state !== "recording") return;
    const started = performance.now();
    const t = setInterval(() => setSeconds(Math.min(CLIP_SECONDS, Math.floor((performance.now() - started) / 1000))), 250);
    return () => clearInterval(t);
  }, [state]);

  const finish = async () => {
    const emu = preview.emulator.current;
    if (!emu) return;
    setState("saving");
    try {
      const { frames, palette } = await emu.stopClip();
      if (frames.length < 2) throw new Error("Play for a moment first: the clip was empty.");
      const { encodeClip } = await import("../files/clip.ts");
      const gif = encodeClip(frames, { palette, delayMs: (1000 / 60) * CLIP_EVERY });
      // Packages and jam entries pick up the latest clip.
      useRecentClip.getState().set(gif);
      download(gif, `${slug}-clip.gif`);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setState("idle");
      onBusy(false);
    }
  };
  stopRef.current = () => void finish();

  const start = () => {
    const emu = preview.emulator.current;
    if (!emu) return;
    onError(null);
    onBusy(true);
    setSeconds(0);
    setState("recording");
    emu.startClip(CLIP_EVERY, CLIP_MAX, () => stopRef.current());
    // Straight into the game, so the clip shows you playing.
    preview.stage.current?.querySelector("canvas")?.focus();
  };

  if (state === "recording") {
    return (
      <button type="button" className="show-button recording" onClick={() => stopRef.current()}>
        <strong>
          <span className="rec-dot" aria-hidden="true" /> Recording… {seconds}s
        </strong>
        <span>Play! Click here to stop and save</span>
      </button>
    );
  }
  return (
    <ShowButton
      title={state === "saving" ? "Saving the clip…" : "Make a clip"}
      detail={`Up to ${CLIP_SECONDS} seconds, as a GIF to post`}
      disabled={disabled || state === "saving"}
      onClick={start}
    />
  );
}

function TvGuide({ onPlay }: { onPlay: () => void }) {
  return (
    <div className="guide">
      <p>Three ways to get your game onto the big screen:</p>
      <ol>
        <li>
          <strong>Laptop to TV.</strong> Plug an HDMI cable from your laptop into the TV, then press <em>Play on a TV</em>. A USB or
          Bluetooth gamepad lets you play from the sofa.
        </li>
        <li>
          <strong>The TV's own web browser, a tablet or a phone.</strong> Use <em>Send to family</em> to make a game file, then open it
          on that device. Any up-to-date web browser can play it, with no internet needed.
        </li>
        <li>
          <strong>A real console.</strong> See <em>Put it on a console</em>.
        </li>
      </ol>
      <p className="muted small">In TV mode, press Esc to come back.</p>
      <div className="toolbar">
        <button type="button" onClick={onPlay}>
          Play on a TV now
        </button>
      </div>
    </div>
  );
}

function ConsoleGuide({ preview, slug }: { preview: Preview; slug: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const get = async (format: "a78" | "bin") => {
    setBusy(true);
    setError(null);
    try {
      const rom = await preview.buildSigned();
      download(format === "a78" ? rom.a78 : rom.bin, `${slug}.${format}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="guide">
      <p>
        Your game is a real cartridge program. To play it on an Atari 7800+, 2600+ or an original 7800, the console needs a{" "}
        <strong>flash cartridge</strong>: a cartridge with a memory card slot that loads game files.
      </p>
      <ol>
        <li>Get a flash cartridge that plays 7800 games. Check that its seller lists 7800 games, not only 2600 ones.</li>
        <li>Download your game below and copy it onto the cartridge's memory card.</li>
        <li>Put the cartridge in the console, switch on, and pick your game from the cartridge's menu.</li>
      </ol>
      <div className="toolbar">
        <button type="button" disabled={busy} onClick={() => void get("a78")}>
          {busy ? "Preparing…" : "Download for a flash cart (.a78)"}
        </button>
        <button type="button" className="secondary" disabled={busy} onClick={() => void get("bin")}>
          Plain ROM (.bin)
        </button>
      </div>
      <p className="muted small">
        Most 7800 flash cartridges read .a78 files; use .bin if your cartridge's instructions ask for it. We test every game in two
        emulators, but not yet on every console and firmware: if something goes wrong, note which console and cartridge you used.
      </p>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
