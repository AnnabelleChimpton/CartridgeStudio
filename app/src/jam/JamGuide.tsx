// "How to run a jam" (?jam-guide): make the brief, share the link, collect
// entries, build the gallery. No server and no accounts at any step.

import { useId, useState, type ReactNode } from "react";
import { slugify } from "../files/exports.ts";
import { KIT_PRESETS } from "../kit/presets.ts";
import { download } from "../ui/usePreview.ts";
import { CLASSIC_PRESET, JAM_EXTENSION, briefFileText, briefLink, newBrief, type JamBrief } from "./brief.ts";
import "./jam.css";

const appBase = () => `${location.origin}${location.pathname}`;

export function JamPageShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="page jam-page">
      <nav className="jam-nav" aria-label="Jam pages">
        <a href={import.meta.env.BASE_URL}>Cartridge Studio</a>
        <a href="?jam-guide">How to run a jam</a>
        <a href="?jam-gallery">Gallery builder</a>
      </nav>
      <main>
        <h1>{title}</h1>
        {children}
      </main>
      <footer className="muted small jam-footer">Made with Cartridge Studio. Not affiliated with or endorsed by Atari.</footer>
    </div>
  );
}

export const STARTERS: { id: string; name: string }[] = [
  ...KIT_PRESETS.map((p) => ({ id: p.id, name: p.name })),
  { id: CLASSIC_PRESET, name: "Classic shooter" },
];

export const SUGGESTED_THEMES = [
  "One more life",
  "It's behind you",
  "Small world",
  "Out of time",
  "Collect them all",
  "The floor is lava",
  "Upside down",
  "Two of a kind",
  "Night shift",
  "Lost and found",
];

const SUGGESTED_RULES = ["One room", "Two colours", "No shooting", "Under 3 minutes to finish", "Only one kind of enemy"];

function BriefMaker() {
  const id = useId();
  const [f, setF] = useState({ name: "", theme: "", dates: "", constraints: "", link: "" });
  const [presets, setPresets] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  let brief: JamBrief | null = null;
  let problem: string | null = null;
  if (f.name.trim()) {
    const link = f.link.trim();
    if (link && !/^https?:\/\/\S+$/.test(link)) problem = "The jam page must be a web address starting with https://";
    else {
      try {
        brief = newBrief({
          name: f.name,
          theme: f.theme,
          dates: f.dates,
          constraints: f.constraints.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 8),
          presets,
          ...(link ? { link } : {}),
        });
      } catch {
        problem = "Something in the brief is too long.";
      }
    }
  }
  const url = brief ? briefLink(brief, appBase()) : "";

  const field = (key: keyof typeof f, label: string, opts: { area?: boolean; hint?: string; placeholder?: string } = {}) => {
    const p = {
      id: `${id}-${key}`,
      value: f[key],
      placeholder: opts.placeholder,
      "aria-describedby": opts.hint ? `${id}-${key}-hint` : undefined,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setCopied(false);
        setF({ ...f, [key]: e.target.value });
      },
    };
    return (
      <div className="jam-field">
        <label htmlFor={p.id}>{label}</label>
        {opts.area ? <textarea rows={3} {...p} /> : <input type="text" maxLength={key === "link" ? 500 : 120} {...p} />}
        {opts.hint && (
          <span id={`${id}-${key}-hint`} className="muted small">
            {opts.hint}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="jam-maker">
      <div className="jam-form">
        {field("name", "Jam name", { placeholder: "e.g. Spooky Cartridge Jam" })}
        {field("theme", "Theme", { placeholder: SUGGESTED_THEMES[0] })}
        {field("dates", "Dates", { placeholder: "e.g. Fri 31 Oct to Sun 2 Nov" })}
        {field("constraints", "Rules, one per line (optional)", { area: true, hint: `Ideas: ${SUGGESTED_RULES.join(", ")}.` })}
        {field("link", "Jam page (optional)", { placeholder: "https://itch.io/jam/…", hint: "Where creators read the rules and send their entries." })}
        <fieldset className="jam-presets">
          <legend>Starting games to offer</legend>
          <p className="muted small">Tick none to offer all of them.</p>
          {STARTERS.map((s) => (
            <label key={s.id}>
              <input
                type="checkbox"
                checked={presets.includes(s.id)}
                onChange={(e) => {
                  setCopied(false);
                  setPresets(e.target.checked ? [...presets, s.id] : presets.filter((p) => p !== s.id));
                }}
              />{" "}
              {s.name}
            </label>
          ))}
        </fieldset>
      </div>
      <div className="jam-output">
        {problem && <p className="error">{problem}</p>}
        {!brief && !problem && <p className="muted">Give the jam a name to get its link.</p>}
        {brief && (
          <>
            <label htmlFor={`${id}-url`}>The jam link</label>
            <textarea id={`${id}-url`} className="jam-url" readOnly rows={3} value={url} onFocus={(e) => e.currentTarget.select()} />
            <div className="toolbar">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(url).then(() => setCopied(true), () => setCopied(false));
                }}
              >
                Copy link
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => download(new TextEncoder().encode(briefFileText(brief)), `${slugify(brief.name)}${JAM_EXTENSION}`)}
              >
                Download the brief ({JAM_EXTENSION})
              </button>
              <a href={url} target="_blank" rel="noreferrer">
                Try it<span className="visually-hidden"> (opens in a new tab)</span>
              </a>
            </div>
            <p className="muted small" aria-live="polite">
              {copied ? "Copied." : `${url.length} characters.`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export function JamGuide() {
  const id = useId();
  return (
    <JamPageShell title="How to run a jam">
      <p className="jam-lede">
        A jam on Cartridge Studio needs no server and no sign-ups. You make a brief, share one link, collect ZIP files, and build a
        gallery you can post anywhere. Every game is a real 7800 cartridge program that also plays in any web browser.
      </p>

      <section aria-labelledby={`${id}-1`}>
        <h2 id={`${id}-1`}>1. Make the brief</h2>
        <p>
          The brief is the jam's name, theme, dates and any extra rules. You can also narrow the starting games, for example only
          the maze for a maze jam. Everything stays in the link: nothing is uploaded.
        </p>
        <BriefMaker />
      </section>

      <section aria-labelledby={`${id}-2`}>
        <h2 id={`${id}-2`}>2. Share the link</h2>
        <p>
          Post the jam link on your jam page (itch.io jams work well), a forum thread or a chat. Opening it shows a jam banner with the
          theme and rules, and the entry form. If a link is too long for where you post, share the <code>{JAM_EXTENSION}</code> file
          instead: creators open it from the start screen.
        </p>
        <p className="muted small">
          Creators' games stay in their own browser. Remind them to save their game file now and then, and to make their entry before
          the deadline.
        </p>
      </section>

      <section aria-labelledby={`${id}-3`}>
        <h2 id={`${id}-3`}>3. Collect entries</h2>
        <p>
          In the editor, creators fill in a title, credits, a short description and the controls, and press <em>Make my jam entry</em>.
          That saves one ZIP holding a page that plays the game offline, the game file, signed ROMs, a clip if they made one, and an{" "}
          <code>entry.json</code>.
        </p>
        <p>
          Ask for that ZIP, unchanged, through your jam page's submission form, by email, or in a forum post. Because the game file is
          included, anyone can open an entry and see how it was made.
        </p>
      </section>

      <section aria-labelledby={`${id}-4`}>
        <h2 id={`${id}-4`}>4. Build the gallery</h2>
        <p>
          Open the <a href="?jam-gallery">gallery builder</a>, drop in every entry ZIP and press <em>Build the gallery</em>. You get
          one ZIP with an <code>index.html</code> showing every game, and each game's player page.
        </p>
        <ul>
          <li>
            <strong>itch.io:</strong> make an HTML project, upload the gallery ZIP and tick “This file will be played in the browser”.
          </li>
          <li>
            <strong>GitHub Pages:</strong> unzip it into a repository and turn on Pages for that branch.
          </li>
          <li>
            <strong>A stream or a party:</strong> unzip it anywhere and open <code>index.html</code>. No internet needed.
          </li>
        </ul>
        <p className="muted small">
          Each game's ROM is in the gallery too, so people can play it in a 7800 emulator or, with a flash cartridge, on a real 7800+,
          2600+ or 7800.
        </p>
      </section>

      <section aria-labelledby={`${id}-5`}>
        <h2 id={`${id}-5`}>Suggested themes</h2>
        <p>Short themes that suit one-screen games and can be read more than one way:</p>
        <ul className="jam-themes">
          {SUGGESTED_THEMES.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="muted small">
          A weekend suits newcomers; a week suits people who want to draw every frame. Announce the theme when the jam starts, not
          before.
        </p>
      </section>
    </JamPageShell>
  );
}
