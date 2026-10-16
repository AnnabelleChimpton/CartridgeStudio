// "Show it": every way a game leaves the editor, in plain words. Play it big
// on a TV, send a one-file player to family, record a clip to post, put it on
// a real console, or print a box and manual.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { slugify } from "../files/exports.ts";
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
  /** The last thing saved, said out loud: a small celebration and what to do with it. */
  const [saved, setSaved] = useState("");
  const ready = !!preview.lastGood;
  const slug = slugify(title);

  const sendToFamily = async () => {
    const built = preview.lastGood;
    if (!built) return;
    setBusy("player");
    setError(null);
    setSaved("");
    try {
      const { buildPlayerHtml } = await import("../player/player.ts");
      download(new TextEncoder().encode(await buildPlayerHtml(title, built.a78)), `${slug}.html`);
      setSaved(`Saved “${slug}.html”: your game in one file. Open it on a laptop or desktop to play, even without the internet.`);
    } catch (e) {
      setError(`We couldn't make the game file (${e instanceof Error ? e.message : String(e)}). Try again in a moment; if it keeps happening, reload the page.`);
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
          detail="One file that plays in a laptop or desktop web browser"
          disabled={!ready || busy !== null}
          onClick={() => void sendToFamily()}
        />
        <ClipRecorder preview={preview} slug={slug} disabled={!ready || busy === "player"} onBusy={(b) => setBusy(b ? "clip" : null)} onError={setError} onSaved={setSaved} />
        <ShowButton title="Put it on a console" detail="With a 7800 flash cartridge" disabled={!ready} onClick={openFrom("console")} />
        <ShowButton
          title="Print the box"
          detail="Box, cartridge labels and manual"
          disabled={!ready}
          onClick={(e) => (typeof print === "function" ? print() : openFrom("print")(e))}
        />
      </div>
      {!ready && <p className="muted small">These light up once your game is ready to play.</p>}
      <p className="muted small">
        <button type="button" className="link" onClick={openFrom("tv")}>
          How do I connect a TV?
        </button>
      </p>
      {error && <p className="error">{error}</p>}
      <p role="status" className="small saved">
        {saved}
      </p>

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
          <ConsoleGuide preview={preview} slug={slug} title={title} />
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
  onSaved,
}: {
  preview: Preview;
  slug: string;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
  onError: (e: string | null) => void;
  onSaved: (message: string) => void;
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
      if (frames.length < 2) throw new Error("The clip was empty. Press Make a clip, play for a few seconds, then click it again to save.");
      const { encodeClip } = await import("../files/clip.ts");
      download(encodeClip(frames, { palette, delayMs: (1000 / 60) * CLIP_EVERY }), `${slug}-clip.gif`);
      onSaved(`Saved “${slug}-clip.gif”. Post it or send it anywhere pictures go.`);
    } catch (e) {
      onError(`We couldn't save the clip (${e instanceof Error ? e.message : String(e)}). Try again.`);
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
    onSaved("");
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
          <strong>Another computer.</strong> Use <em>Send to family</em> to make a game file, then open it in a laptop or desktop web
          browser, with no internet needed. On a phone or tablet, open it in Safari or Chrome to see it; it has no touch controls yet,
          so playing needs a keyboard or gamepad.
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

function ConsoleGuide({ preview, slug, title }: { preview: Preview; slug: string; title: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState("");
  const [copied, setCopied] = useState("");
  const get = async (format: "a78" | "bin") => {
    setBusy(true);
    setError(null);
    setSaved("");
    try {
      const rom = await preview.buildSigned();
      download(format === "a78" ? rom.a78 : rom.bin, `${slug}.${format}`);
      setSaved(`Saved “${slug}.${format}”. Copy it onto the cartridge's memory card.`);
    } catch (e) {
      setError(`${e instanceof Error ? e.message : String(e)} Fix anything listed under the game, then try again.`);
    } finally {
      setBusy(false);
    }
  };
  const report = [
    `Game: ${title}`,
    `Game file size: ${preview.lastGood ? `${Math.round(preview.lastGood.a78.length / 1024)} KB` : "not built yet"}`,
    `Made with: Cartridge Studio${preview.ready ? ` (${preview.ready.toolchainVersion})` : ""}`,
    `Browser: ${navigator.userAgent}`,
    "Console (7800+, 2600+, original 7800…):",
    "Flash cartridge and its firmware version:",
    "File used (.a78 or .bin):",
    "What happened (black screen, menu only, crash, works):",
  ].join("\n");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied("Copied. Paste it into your message, then fill in the blanks.");
    } catch {
      setCopied("Couldn't copy: select the text above and copy it yourself.");
    }
  };
  return (
    <div className="guide">
      <p>
        Your game is made in the 7800 cartridge format, for consoles that play 7800 games, like the Atari 7800+, 2600+ and the
        original 7800. To play it on one, the console needs a <strong>flash cartridge</strong>: a cartridge with a memory card slot
        that loads game files.
      </p>
      <ol>
        <li>Get a flash cartridge that plays 7800 games. Check that its seller lists 7800 games, not only 2600 ones.</li>
        <li>Download your game below and copy the file onto the cartridge's memory card.</li>
        <li>Put the cartridge in the console, switch on, and pick your game from the cartridge's menu.</li>
      </ol>
      <div className="toolbar">
        <button type="button" disabled={busy} onClick={() => void get("a78")}>
          {busy ? "Preparing…" : "Download for a flash cartridge (.a78)"}
        </button>
        <button type="button" className="secondary" disabled={busy} onClick={() => void get("bin")}>
          Other kind (.bin)
        </button>
      </div>
      <p role="status" className="small saved">
        {saved}
      </p>
      {error && <p className="error">{error}</p>}
      <p className="muted small">
        Most flash cartridges want the .a78 file; use the other kind only if your cartridge's instructions ask for a .bin. Every game is
        checked by playing it in js7800, the emulator on this page. Nobody has tested these games on a real 7800+, 2600+ or 7800 yet,
        so if you try one, please tell us how it went.
      </p>
      <details className="small">
        <summary>If it doesn't start</summary>
        <ul>
          <li>Switch the console off before putting the cartridge in or taking it out, and push the cartridge all the way down.</li>
          <li>Black screen or straight back to the menu? Try the other kind of file (.bin), and make sure it isn't still inside a zip.</li>
          <li>Check that the cartridge's own software (its firmware) is up to date: its maker's website says how.</li>
          <li>
            Still stuck? Copy this report into a message to us, and fill in the blanks:
            <textarea className="boot-report" readOnly rows={8} aria-label="Boot report" value={report} />
            <button type="button" className="secondary" onClick={() => void copy()}>
              Copy the report
            </button>{" "}
            <span role="status">{copied}</span>
          </li>
        </ul>
      </details>
      <p className="muted small">
        Cartridge Studio is an independent project. Atari doesn't make, test or support these games, so please ask us for help, not
        Atari.
      </p>
    </div>
  );
}
