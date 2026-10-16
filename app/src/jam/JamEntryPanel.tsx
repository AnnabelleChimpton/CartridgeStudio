// The creator's side of a jam: a few words about the game, then one button
// that packs everything the organizer needs into a ZIP.

import { useId, useState } from "react";
import type { Preview } from "../ui/usePreview.ts";
import { download } from "../ui/usePreview.ts";
import { ENTRY_LIMITS, entryFileName, entryTitle, entryZip } from "./entry.ts";
import { useJamStore, type EntryWords } from "./store.ts";
import "./jam.css";

interface Props {
  preview: Preview;
  gameTitle: string;
  /** The .cartridge game file, with its thumbnail. */
  cartridgeFile: () => Promise<Uint8Array>;
}

export function JamEntryPanel({ preview, gameTitle, cartridgeFile }: Props) {
  const brief = useJamStore((s) => s.brief);
  const words = useJamStore((s) => s.words);
  const clip = useJamStore((s) => s.clip);
  const { setWords, setClip } = useJamStore.getState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const id = useId();
  if (!brief) return null;
  const ready = !!preview.lastGood;
  const title = entryTitle(words, gameTitle);

  const make = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const rom = await preview.buildSigned();
      const [{ buildPlayerHtml }, cartridge] = await Promise.all([import("../player/player.ts"), cartridgeFile()]);
      const playerHtml = await buildPlayerHtml(title, rom.a78);
      const name = entryFileName(title);
      download(entryZip({ brief, words, gameTitle, playerHtml, cartridge, a78: rom.a78, bin: rom.bin, clip }), name);
      setDone(name);
    } catch (e) {
      setError(`We couldn't make the entry: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof EntryWords, label: string, opts: { area?: boolean; placeholder?: string; hint?: string } = {}) => {
    const props = {
      id: `${id}-${key}`,
      value: words[key],
      maxLength: ENTRY_LIMITS[key],
      placeholder: opts.placeholder,
      "aria-describedby": opts.hint ? `${id}-${key}-hint` : undefined,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setWords({ [key]: e.target.value }),
    };
    return (
      <div className="jam-field">
        <label htmlFor={props.id}>{label}</label>
        {opts.area ? <textarea rows={3} {...props} /> : <input type="text" {...props} />}
        {opts.hint && (
          <span id={`${id}-${key}-hint`} className="muted small">
            {opts.hint}
          </span>
        )}
      </div>
    );
  };

  return (
    <section className="panel jam-entry" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>Jam entry</h2>
      <p className="small">
        For <strong>{brief.name}</strong>
        {brief.theme && (
          <>
            {" "}
            · theme <strong>{brief.theme}</strong>
          </>
        )}
      </p>
      {field("title", "Title", { placeholder: gameTitle, hint: "Leave empty to use the game's title." })}
      {field("credits", "Credits", { placeholder: "Who made it, e.g. Sam and Robin" })}
      {field("description", "Short description", { area: true, placeholder: "One or two sentences for the gallery." })}
      {field("controls", "Controls", { placeholder: "e.g. Arrows move, fire button jumps" })}

      <div className="jam-clip">
        <span>
          Clip:{" "}
          {clip ? (
            <strong className="ok-text">ready ({Math.round(clip.length / 1024)} KB)</strong>
          ) : (
            <span className="muted">none yet. Use “Make a clip” in Show it, or choose a GIF.</span>
          )}
        </span>
        <label className="jam-file-link">
          {clip ? "Choose another GIF" : "Choose a GIF"}
          <input
            type="file"
            accept="image/gif,.gif"
            className="visually-hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              const bytes = new Uint8Array(await f.arrayBuffer());
              if (new TextDecoder().decode(bytes.subarray(0, 3)) !== "GIF") setError(`${f.name} isn't a GIF.`);
              else setClip(bytes);
            }}
          />
        </label>
        {clip && (
          <button type="button" className="link" onClick={() => setClip(null)}>
            Remove clip
          </button>
        )}
      </div>

      <div className="toolbar">
        <button type="button" disabled={!ready || busy} onClick={() => void make()}>
          {busy ? "Making the entry…" : "Make my jam entry"}
        </button>
      </div>
      <p className="muted small">
        One ZIP with a page that plays the game offline, the game file, signed ROMs{clip ? ", your clip" : ""} and these details.
      </p>
      <div aria-live="polite">
        {done && (
          <p className="jam-done">
            Saved <strong>{done}</strong>. Send it to the organizer
            {brief.link ? (
              <>
                {" "}
                as <a href={brief.link} target="_blank" rel="noreferrer">the jam page<span className="visually-hidden"> (opens in a new tab)</span></a> says
              </>
            ) : null}
            .
          </p>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
