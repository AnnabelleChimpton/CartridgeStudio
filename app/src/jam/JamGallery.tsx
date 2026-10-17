// The organizer's gallery builder (organize.html#gallery): drop in every entry
// ZIP, check them against the brief, and get one static site to post, plus a
// judges' sheet and, once it comes back filled in, a results page.

import { useId, useState } from "react";
import { slugify } from "../files/exports.ts";
import { licenceName, readPackage } from "../files/package.ts";
import { download } from "../ui/usePreview.ts";
import { readBriefText, type JamBrief } from "./brief.ts";
import { organizerFlags } from "./entry.ts";
import { galleryEntries, galleryZip, infoFromEntries, judgesCsv, tallyResults, type GalleryEntry, type GalleryInfo, type Results } from "./gallery.ts";
import { JamPageShell } from "./JamGuide.tsx";
import { useJamStore } from "./store.ts";
import "./jam.css";

interface Added extends GalleryEntry {
  file: string;
}

const lines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

export function JamGallery() {
  const joined = useJamStore((s) => s.brief);
  const [brief, setBrief] = useState<JamBrief | null>(joined);
  const [added, setAdded] = useState<Added[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const [info, setInfo] = useState(() => infoText(joined));
  const [anonymous, setAnonymous] = useState(false);
  const [sheets, setSheets] = useState<{ name: string; text: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [built, setBuilt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const galleryInfo = (): GalleryInfo => ({
    name: info.name.trim() || "Game jam",
    theme: info.theme.trim(),
    dates: info.dates.trim(),
    constraints: lines(info.constraints),
    criteria: lines(info.criteria).slice(0, 8),
    link: /^https?:\/\/\S+$/.test(info.link.trim()) ? info.link.trim() : undefined,
  });
  const check = (e: Added["read"], b: JamBrief | null) => organizerFlags(e, { name: b?.name, app: b?.app, limits: b?.limits });
  const results: Results | null = sheets.length && added.length ? tallyResults(galleryInfo(), added, sheets) : null;

  const applyBrief = (b: JamBrief) => {
    setBrief(b);
    setInfo(infoText(b));
    setAdded((a) => a.map((x) => ({ ...x, flags: check(x.read, b) })));
  };

  const add = async (files: FileList | File[]) => {
    const next: Added[] = [];
    const bad: string[] = [];
    let b = brief;
    for (const f of Array.from(files)) {
      if (f.name.endsWith(".json")) {
        const r = readBriefText(await f.text());
        if (r.ok) {
          b = r.brief;
          applyBrief(r.brief);
        } else bad.push(`${f.name}: ${r.errors.join(" ")}`);
        continue;
      }
      const r = await readPackage(new Uint8Array(await f.arrayBuffer()));
      if (r.ok) next.push({ file: f.name, read: r.read, flags: [] });
      else bad.push(`${f.name}: ${r.error}`);
    }
    for (const n of next) n.flags = check(n.read, b);
    setProblems(bad);
    setBuilt(null);
    setAdded((a) => [...a.filter((x) => !next.some((n) => n.file === x.file)), ...next]);
    if (next.length && !b) {
      const from = infoFromEntries(next.map((x) => x.read));
      setInfo((i) => (i.name ? i : { ...i, name: from.name, theme: i.theme || (from.theme ?? "") }));
    }
  };

  const build = async () => {
    setBusy(true);
    setError(null);
    try {
      const { loadPlayerAssets } = await import("../player/player.ts");
      const gi = galleryInfo();
      const zip = galleryZip(gi, added, await loadPlayerAssets(), { anonymous, results });
      const file = `${slugify(gi.name)}-gallery${anonymous ? "-anonymous" : ""}.zip`;
      download(zip, file);
      setBuilt(file);
    } catch (e) {
      setError(`Building the gallery stopped: ${e instanceof Error ? e.message : String(e)}. The entries you added are still here; press Build the gallery to try again.`);
    } finally {
      setBusy(false);
    }
  };

  const text = (key: keyof typeof info, label: string, area = false) => (
    <div className="jam-field">
      <label htmlFor={`${id}-${key}`}>{label}</label>
      {area ? (
        <textarea id={`${id}-${key}`} rows={3} value={info[key]} onChange={(e) => setInfo({ ...info, [key]: e.target.value })} />
      ) : (
        <input id={`${id}-${key}`} type="text" value={info[key]} onChange={(e) => setInfo({ ...info, [key]: e.target.value })} />
      )}
    </div>
  );

  const listed = galleryEntries(added);

  return (
    <JamPageShell title="Build the jam gallery" current="gallery">
      <p>
        Add every entry ZIP your creators sent. You'll get one ZIP with a gallery page and a player for each game: post it on itch.io as
        an HTML project, put it on GitHub Pages, or open <code>index.html</code> from a folder. It works with no internet.
      </p>

      <section aria-labelledby={`${id}-add`}>
        <h2 id={`${id}-add`}>1. Add the entries</h2>
        <p className="muted small">
          {brief ? (
            <>
              Checking entries against the brief for {brief.name}.
            </>
          ) : (
            <>Add the jam's .jam.json brief too, to check entries against its limits and version.</>
          )}
        </p>
        <div
          className={`jam-drop${over ? " over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void add(e.dataTransfer.files);
          }}
        >
          <label className="button-like">
            Choose entry ZIPs
            <input
              type="file"
              multiple
              accept=".zip,application/zip"
              className="visually-hidden"
              onChange={(e) => {
                const f = e.target.files;
                if (f) void add(Array.from(f));
                e.target.value = "";
              }}
            />
          </label>
          <label className="jam-file-link">
            Open the brief (.jam.json)
            <input
              type="file"
              accept=".json,application/json"
              className="visually-hidden"
              onChange={(e) => {
                const f = e.target.files;
                if (f) void add(Array.from(f));
                e.target.value = "";
              }}
            />
          </label>
          <span className="muted">or drop files here</span>
        </div>
        {problems.length > 0 && (
          <div role="alert">
            <ul className="error">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {listed.length > 0 && (
          <div className="jam-table-wrap">
            <table className="jam-table">
              <caption className="visually-hidden">Entries added</caption>
              <thead>
                <tr>
                  <th scope="col">Game</th>
                  <th scope="col">Credits</th>
                  <th scope="col">Licence</th>
                  <th scope="col">Notes</th>
                  <th scope="col">
                    <span className="visually-hidden">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {listed.map((a) => {
                  const m = a.read.manifest;
                  return (
                    <tr key={a.slug}>
                      <th scope="row">{m.title}</th>
                      <td>{m.credits || <span className="muted">none</span>}</td>
                      <td>
                        {m.licence ? licenceName(m.licence) : <span className="muted">none</span>}
                        {m.jam?.compilation && <div className="muted small">Compilation OK</div>}
                      </td>
                      <td>
                        {a.flags.length ? (
                          <ul className="jam-notes">
                            {a.flags.map((f) => (
                              <li key={f}>{f}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="ok-text">All fine</span>
                        )}
                      </td>
                      <td>
                        <button type="button" className="link" onClick={() => setAdded(added.filter((x) => x.read !== a.read))}>
                          Remove<span className="visually-hidden"> {m.title}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small" aria-live="polite">
          {added.length} {added.length === 1 ? "entry" : "entries"} added.
        </p>
      </section>

      <section aria-labelledby={`${id}-about`}>
        <h2 id={`${id}-about`}>2. Say what the jam was</h2>
        <div className="jam-form">
          {text("name", "Jam name")}
          {text("theme", "Theme")}
          {text("dates", "Dates")}
          {text("constraints", "Rules (one per line)", true)}
          {text("criteria", "What judges score (one per line)", true)}
          {text("link", "Jam page (https://…)")}
        </div>
      </section>

      <section aria-labelledby={`${id}-judge`}>
        <h2 id={`${id}-judge`}>3. Judging (optional)</h2>
        <label className="jam-check">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} /> Anonymous: leave out credits and
          the game files, so judges don't know who made what.
        </label>
        <div className="toolbar jam-wrap">
          <button
            type="button"
            className="secondary"
            disabled={added.length === 0}
            onClick={() => download(new TextEncoder().encode(judgesCsv(galleryInfo(), added, { anonymous })), `${slugify(galleryInfo().name)}-judges.csv`, { toast: true })}
          >
            Download the judges' sheet (.csv)
          </button>
          <label className="jam-file-link">
            Add filled-in sheets
            <input
              type="file"
              multiple
              accept=".csv,text/csv"
              className="visually-hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                const read = await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() })));
                setSheets((s) => [...s.filter((x) => !read.some((r) => r.name === x.name)), ...read]);
              }}
            />
          </label>
          {sheets.length > 0 && (
            <button type="button" className="link" onClick={() => setSheets([])}>
              Clear sheets
            </button>
          )}
        </div>
        <div aria-live="polite">
          {results && (
            <>
              <p className="small">
                {results.sheets} {results.sheets === 1 ? "sheet" : "sheets"} added. The gallery will include a results page. In the lead:{" "}
                {results.rows[0]?.overall === null ? "nobody scored yet" : results.rows[0]?.title}
              </p>
              {results.problems.length > 0 && (
                <ul className="error small">
                  {results.problems.slice(0, 8).map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>

      <section aria-labelledby={`${id}-build`}>
        <h2 id={`${id}-build`}>4. Build it</h2>
        <div className="toolbar">
          <button type="button" disabled={added.length === 0 || busy} onClick={() => void build()}>
            {busy ? "Building…" : "Build the gallery"}
          </button>
        </div>
        <div aria-live="polite">
          {built && (
            <p className="jam-done">
              Saved “{built}”. Unzip it and open <code>index.html</code> to check it, then post the folder.
            </p>
          )}
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
    </JamPageShell>
  );
}

function infoText(b: JamBrief | null) {
  return {
    name: b?.name ?? "",
    theme: b?.theme ?? "",
    dates: b?.dates ?? "",
    constraints: b?.constraints.join("\n") ?? "",
    criteria: b?.criteria.join("\n") ?? "",
    link: b?.link ?? "",
  };
}
