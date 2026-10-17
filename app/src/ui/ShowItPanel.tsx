// "Show it": every way a game leaves the editor, ordered by what people mean
// to do. As a file: the one-file player for family, and a clip. Console and
// box: the ROM for a flash cartridge, and the print kit. One ZIP: the jam
// entry when a jam is joined, otherwise everything in one package.
// Full screen for a TV is the game's own control, beside the game.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { slugify } from "../files/exports.ts";
import { useRecentClip } from "../files/recent-clip.ts";
import { useJamStore } from "../jam/store.ts";
import { ConsoleGuide } from "./ConsoleDialog.tsx";
import { Dialog } from "./Dialog.tsx";
import { download, type Preview } from "./usePreview.ts";

/** Clips: 20 frames a second (every 3rd frame), up to 10 seconds. */
const CLIP_EVERY = 3;
const CLIP_SECONDS = 10;
const CLIP_MAX = (60 / CLIP_EVERY) * CLIP_SECONDS;

/** The "Everything" package: what it holds, and how to make it. */
export interface Everything {
  /** What's in the ZIP, listed under the button. */
  contents: string[];
  make: () => Promise<{ zip: Uint8Array; name: string }>;
}

interface Props {
  preview: Preview;
  title: string;
  /** The print dialog's contents, or a callback that shows printing elsewhere (e.g. a tab). */
  print: ReactNode | (() => void);
  /** The one-ZIP builder when no jam is joined. */
  everything?: Everything;
  /** This editor has a jam entry panel: while a jam is joined, the ZIP is the jam entry, made there. */
  jam?: boolean;
}

type Open = null | "console" | "print";

export function ShowItPanel({ preview, title, print, everything, jam = false }: Props) {
  const [open, setOpen] = useState<Open>(null);
  /** The button that opened the dialog, for focus to return to. */
  const opener = useRef<HTMLElement | null>(null);
  const openFrom = (what: Open) => (e: React.MouseEvent<HTMLElement>) => {
    opener.current = e.currentTarget;
    setOpen(what);
  };
  const [busy, setBusy] = useState<null | "player" | "clip" | "zip">(null);
  const [error, setError] = useState<string | null>(null);
  /** The last thing saved, and what to do with it: the one confirmation for each download here. */
  const [saved, setSaved] = useState("");
  const brief = useJamStore((s) => s.brief);
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
      download(new TextEncoder().encode(await buildPlayerHtml(title, built.a78, preview.source())), `${slug}.html`);
      setSaved(`Saved “${slug}.html”: your game in one file. It plays on a computer or an Android phone, even without the internet. iPhones and iPads can't run it.`);
    } catch (e) {
      setError(`The player file wasn't made: ${e instanceof Error ? e.message : String(e)}. Your game is saved; press Send to family again.`);
    } finally {
      setBusy(null);
    }
  };

  const makeEverything = async () => {
    if (!everything) return;
    setBusy("zip");
    setError(null);
    setSaved("");
    try {
      const pkg = await everything.make();
      download(pkg.zip, pkg.name);
      setSaved(`Saved “${pkg.name}”, ${Math.round(pkg.zip.length / 1024)} KB.`);
    } catch (e) {
      setError(`The ZIP wasn't made: ${e instanceof Error ? e.message : String(e)}. Your game is saved; fix anything listed under the game, then try again.`);
    } finally {
      setBusy(null);
    }
  };

  /** The jam entry is made in its own panel, where its words and licence are. */
  const toJamEntry = () => {
    const panel = document.querySelector<HTMLElement>(".jam-entry");
    panel?.scrollIntoView({ block: "start" });
    panel?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
  };
  const jamZip = jam && brief;

  return (
    <section className="panel show-it" aria-labelledby="show-it-h">
      <h2 id="show-it-h">Show it</h2>
      <h3 className="show-h" id="show-file-h">
        As a file
      </h3>
      <div className="show-grid" role="group" aria-labelledby="show-file-h">
        <ShowButton
          title={busy === "player" ? "Making the file…" : "Send to family"}
          detail="One .html file that plays on a computer or an Android phone"
          disabled={!ready || busy !== null}
          onClick={() => void sendToFamily()}
        />
        <ClipRecorder
          preview={preview}
          slug={slug}
          disabled={!ready || (busy !== null && busy !== "clip")}
          onBusy={(b) => setBusy(b ? "clip" : null)}
          onError={setError}
          onSaved={setSaved}
        />
      </div>
      <h3 className="show-h" id="show-cart-h">
        Console and box
      </h3>
      <div className="show-grid real" role="group" aria-labelledby="show-cart-h">
        <ShowButton title="Put it on a cart" detail=".a78 or .bin, for a 7800 flash cartridge" disabled={!ready} onClick={openFrom("console")} />
        <ShowButton
          title="Print the box"
          detail="Box, two cartridge labels and a manual, as one PDF"
          disabled={!ready}
          onClick={(e) => (typeof print === "function" ? print() : openFrom("print")(e))}
        />
      </div>
      {(jamZip || everything) && (
        <>
          <h3 className="show-h" id="show-zip-h">
            One ZIP
          </h3>
          <div className="show-zip" role="group" aria-labelledby="show-zip-h">
            {jamZip ? (
              <>
                <ShowButton title={`Jam entry for ${brief.name}`} detail="Fill in the entry below, then make the ZIP there" onClick={toJamEntry} />
                <p className="muted small">The jam entry is the ZIP while you're in a jam. Leave the jam to make the everything package instead.</p>
              </>
            ) : (
              everything && (
                <>
                  <ShowButton
                    title={busy === "zip" ? "Packing…" : "Everything (game, source, print kit)"}
                    detail="One .zip to keep or send"
                    disabled={!ready || busy !== null}
                    describedBy="show-zip-contents"
                    onClick={() => void makeEverything()}
                  />
                  <ul className="small muted zip-contents" id="show-zip-contents" aria-label="In the ZIP">
                    {everything.contents.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </>
              )
            )}
          </div>
        </>
      )}
      {!ready && <p className="muted small">These light up once your game is ready to play.</p>}
      {error && <p className="error">{error}</p>}
      <p role="status" className="small saved">
        {saved}
      </p>

      {open === "console" && (
        <Dialog title="Put it on a cart" returnTo={opener.current} onClose={() => setOpen(null)}>
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
  describedBy,
  onClick,
}: {
  title: string;
  detail: string;
  disabled?: boolean;
  describedBy?: string;
  onClick: (e: React.MouseEvent<HTMLElement>) => void;
}) {
  return (
    <button type="button" className="show-button" disabled={disabled} aria-describedby={describedBy} onClick={onClick}>
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
      const gif = encodeClip(frames, { palette, delayMs: (1000 / 60) * CLIP_EVERY });
      // Packages and jam entries pick up the latest clip.
      useRecentClip.getState().set(gif);
      download(gif, `${slug}-clip.gif`);
      onSaved(`Saved “${slug}-clip.gif”. It also goes into your next package and jam entry.`);
    } catch (e) {
      onError(`The clip wasn't saved: ${e instanceof Error ? e.message : String(e)} Your game is saved; press Make a clip again.`);
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
    // Said once, not every second: the button's own text counts.
    onSaved(`Recording, up to ${CLIP_SECONDS} s. Keep playing; click the Recording button to stop and save the GIF.`);
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
          <span className="rec-dot" aria-hidden="true" /> Recording, {seconds} of {CLIP_SECONDS} s
        </strong>
        <span>Keep playing; click to stop and save the GIF.</span>
      </button>
    );
  }
  return (
    <ShowButton
      title={state === "saving" ? "Saving the clip…" : "Make a clip"}
      detail={`Up to ${CLIP_SECONDS} seconds, as a .gif to post`}
      disabled={disabled || state === "saving"}
      onClick={start}
    />
  );
}
