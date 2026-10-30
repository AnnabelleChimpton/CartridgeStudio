import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
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

/** The everything ZIP: what it holds, and how to make it. */
export interface Everything {
  contents: string[];
  make: () => Promise<{ zip: Uint8Array; name: string }>;
}

interface Props {
  preview: Preview;
  title: string;
  /** The print dialog's contents, or a callback that shows printing elsewhere (e.g. a tab). */
  print: ReactNode | (() => void);
  /** The ZIP builder when no jam is joined. */
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
  /** The last thing saved: the one confirmation for each download here. */
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
      setSaved(`Saved ${slug}.html. Opens offline in any browser on a computer or Android phone. Not on iPhone or iPad.`);
    } catch (e) {
      setError(`The player page wasn't made: ${e instanceof Error ? e.message : String(e)}. Your game is saved. Try Send to family again.`);
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
      setSaved(`Saved ${pkg.name}: ROMs, player page, print kit, game file and source.`);
    } catch (e) {
      setError(`The ZIP wasn't made: ${e instanceof Error ? e.message : String(e)}. Your game is saved. Fix anything listed under the game, then try again.`);
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

  const more: ReactNode[] = [
    <button key="family" type="button" className="link" disabled={!ready || busy !== null} onClick={() => void sendToFamily()}>
      {busy === "player" ? "Making the page…" : "Send to family (.html)"}
    </button>,
    <ClipRecorder
      key="clip"
      preview={preview}
      slug={slug}
      disabled={!ready || (busy !== null && busy !== "clip")}
      onBusy={(b) => setBusy(b ? "clip" : null)}
      onError={setError}
      onSaved={setSaved}
    />,
  ];
  if (jamZip) {
    more.push(
      <button key="zip" type="button" className="link" title={`Fill in the entry for ${brief.name}, then make the ZIP there`} onClick={toJamEntry}>
        Jam entry (.zip)
      </button>,
    );
  } else if (everything) {
    more.push(
      <button key="zip" type="button" className="link" disabled={!ready || busy !== null} onClick={() => void makeEverything()}>
        {busy === "zip" ? "Packing…" : "Everything (.zip)"}
      </button>,
    );
  }

  return (
    <section className="panel show-it" aria-labelledby="show-it-h">
      <h2 id="show-it-h" className="visually-hidden">
        Share and download
      </h2>
      <div className="show-main">
        <button type="button" className="primary" disabled={!ready} onClick={openFrom("console")}>
          Put it on a cart (.a78)
        </button>
        <button
          type="button"
          className="keycap"
          disabled={!ready}
          onClick={(e) => (typeof print === "function" ? print() : openFrom("print")(e))}
        >
          Print the box (PDF)
        </button>
      </div>
      <p className="show-more">
        {more.map((item, i) => (
          <Fragment key={i}>
            {i > 0 && <span aria-hidden="true"> · </span>}
            {item}
          </Fragment>
        ))}
      </p>
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
      if (frames.length < 2) throw new Error("The clip was empty. Press Make a GIF, play for a few seconds, then click it again to save.");
      const { encodeClip } = await import("../files/clip.ts");
      const gif = encodeClip(frames, { palette, delayMs: (1000 / 60) * CLIP_EVERY });
      // Packages and jam entries pick up the latest clip.
      useRecentClip.getState().set(gif);
      download(gif, `${slug}-clip.gif`);
      onSaved(`Saved ${slug}-clip.gif. It goes into the next ZIP too.`);
    } catch (e) {
      onError(`The GIF wasn't saved: ${e instanceof Error ? e.message : String(e)} Your game is saved. Try Make a GIF again.`);
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
    onSaved(`Recording, up to ${CLIP_SECONDS} s. Click Recording to stop.`);
    onBusy(true);
    setSeconds(0);
    setState("recording");
    emu.startClip(CLIP_EVERY, CLIP_MAX, () => stopRef.current());
    // Straight into the game, so the clip shows you playing.
    preview.stage.current?.querySelector("canvas")?.focus();
  };

  if (state === "recording") {
    return (
      <button type="button" className="link recording" onClick={() => stopRef.current()}>
        <span className="rec-dot" aria-hidden="true" /> Recording. Click to stop.
        <span className="rec-time" aria-hidden="true">
          {seconds} s
        </span>
      </button>
    );
  }
  return (
    <button type="button" className="link" disabled={disabled || state === "saving"} onClick={start}>
      {state === "saving" ? "Saving the GIF…" : "Make a GIF"}
    </button>
  );
}
