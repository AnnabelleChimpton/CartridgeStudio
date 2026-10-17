// "Put it on a cart": the signed ROM for a flash cartridge, what to do with
// it, and an honest account of hardware testing. After a download it asks
// "Did it boot?": Yes offers the First boot card, No opens the list of things
// to try. The boot report is copied, never put in a link.

import { useId, useRef, useState } from "react";
import { sha256Hex } from "../files/package.ts";
import { APP_VERSION } from "../version.ts";
import { BOOT_REPORT_URL, COMPAT, bootReport, type BootAnswer } from "./boot.ts";
import { firstBootCard } from "./first-boot.ts";
import { download, type Preview } from "./usePreview.ts";

interface Props {
  preview: Preview;
  slug: string;
  title: string;
}

interface Downloaded {
  name: string;
  bytes: number;
  sha256: string;
}

export function ConsoleGuide({ preview, slug, title }: Props) {
  const ids = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState("");
  const [file, setFile] = useState<Downloaded | null>(null);
  const [answer, setAnswer] = useState<BootAnswer | null>(null);
  const [troubleOpen, setTroubleOpen] = useState(false);
  const trouble = useRef<HTMLDetailsElement>(null);

  const get = async (format: "a78" | "bin") => {
    setBusy(true);
    setError(null);
    setSaved("");
    try {
      const rom = await preview.buildSigned();
      const bytes = format === "a78" ? rom.a78 : rom.bin;
      const name = `${slug}.${format}`;
      download(bytes, name);
      setFile({ name, bytes: bytes.length, sha256: await sha256Hex(bytes) });
      setAnswer(null);
      setSaved(`Saved “${name}”. Copy it onto the cartridge's memory card.`);
    } catch (e) {
      setError(`${e instanceof Error ? e.message : String(e)} Fix anything listed under the game, then try again.`);
    } finally {
      setBusy(false);
    }
  };

  const report = bootReport({
    title,
    app: APP_VERSION,
    toolchain: preview.ready?.toolchainVersion,
    file: file ?? undefined,
    answer: answer ?? undefined,
  });

  const choose = (a: BootAnswer) => {
    setAnswer(a);
    if (a === "no") {
      setTroubleOpen(true);
      requestAnimationFrame(() => trouble.current?.querySelector("summary")?.focus());
    }
  };

  return (
    <div className="guide">
      <p>
        Your game is a 7800 ROM. To play it on a 7800, 7800+ or 2600+, the console needs a flash cartridge: a cartridge with a memory card
        slot that loads ROM files.
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
      <p className="muted small">Most flash cartridges want the .a78 file. Use the .bin only if your cartridge's instructions ask for one.</p>
      <p role="status" className="small saved">
        {saved}
      </p>
      {error && <p className="error">{error}</p>}

      {file && (
        <div className="boot-ask" role="group" aria-labelledby={`${ids}-boot`}>
          <h3 className="section-h" id={`${ids}-boot`}>
            Did it boot?
          </h3>
          <p className="muted small">Answer once you've tried {file.name} on the console.</p>
          <div className="toolbar">
            {(
              [
                ["yes", "Yes"],
                ["no", "No"],
                ["not-yet", "Not yet"],
              ] as const
            ).map(([a, label]) => (
              <button key={a} type="button" className="secondary" aria-pressed={answer === a} onClick={() => choose(a)}>
                {label}
              </button>
            ))}
          </div>
          <div aria-live="polite">
            {answer === "yes" && <FirstBoot title={title} file={file.name} report={report} />}
            {answer === "no" && <p className="small">The list below has what to try first, and the boot report to post if it still doesn't start.</p>}
            {answer === "not-yet" && <p className="small muted">Not tried yet. The question stays here until the dialog closes.</p>}
          </div>
        </div>
      )}

      <CompatTable />
      <p className="muted small">
        Every game is checked by playing it in js7800, the emulator on this page. Nobody has tested these games on a real 7800+, 2600+ or 7800
        yet.
      </p>

      <details ref={trouble} className="small" open={troubleOpen} onToggle={(e) => setTroubleOpen(e.currentTarget.open)}>
        <summary>If it doesn't start</summary>
        <ul>
          <li>Switch the console off before putting the cartridge in or taking it out, and push the cartridge all the way down.</li>
          <li>Black screen or straight back to the menu? Try the other kind of file (.bin), and make sure it isn't still inside a zip.</li>
          <li>Check that the cartridge's own software (its firmware) is up to date: its maker's website says how.</li>
        </ul>
        <BootReport report={report} />
      </details>
      <p className="muted small">
        Cartridge Studio is an independent project. Atari doesn't make, test or support these games; post problems on GitHub, not to Atari.
      </p>
    </div>
  );
}

/** compatibility.json as a table: one row per boot report, or the single untested row. */
export function CompatTable() {
  const id = useId();
  return (
    <table className="compat small" aria-labelledby={id}>
      <caption id={id}>Tested on hardware</caption>
      <thead>
        <tr>
          <th scope="col">Console</th>
          <th scope="col">Flash cartridge and firmware</th>
          <th scope="col">Result</th>
          <th scope="col">Date</th>
        </tr>
      </thead>
      <tbody>
        {COMPAT.rows.length === 0 ? (
          <tr>
            <td colSpan={4}>{COMPAT.note}</td>
          </tr>
        ) : (
          COMPAT.rows.map((r, i) => (
            <tr key={i}>
              <td>{r.console}</td>
              <td>
                {r.cartridge}, {r.firmware}
              </td>
              <td>
                {r.report ? (
                  <a href={r.report} target="_blank" rel="noreferrer">
                    {r.result}
                    <span className="visually-hidden"> (boot report, opens in a new tab)</span>
                  </a>
                ) : (
                  r.result
                )}
              </td>
              <td>{r.date}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

/** "Copy boot report" and where to post it. */
function BootReport({ report }: { report: string }) {
  const [copied, setCopied] = useState("");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied("Copied. Paste it into the form on GitHub, then fill in the blanks.");
    } catch {
      setCopied("Not copied: select the text above and copy it yourself.");
    }
  };
  return (
    <div className="boot-report-block">
      <textarea className="boot-report" readOnly rows={7} aria-label="Boot report" value={report} />
      <div className="toolbar">
        <button type="button" className="secondary" onClick={() => void copy()}>
          Copy boot report
        </button>
        <span>
          Post your result:{" "}
          <a href={BOOT_REPORT_URL} target="_blank" rel="noreferrer">
            boot report form on GitHub<span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        </span>
      </div>
      <p role="status" className="small">
        {copied}
      </p>
    </div>
  );
}

/** Yes: the First boot card, and the report so the compatibility table can list it. */
function FirstBoot({ title, file, report }: { title: string; file: string; report: string }) {
  const [blocked, setBlocked] = useState(false);
  return (
    <div className="first-boot">
      <p className="small">{title || "Untitled"} booted on a console. Print the First boot card for the box, and post the result so the table below can list it.</p>
      <div className="toolbar">
        <button type="button" onClick={() => setBlocked(!firstBootCard({ title, file, date: new Date().toLocaleDateString() }))}>
          Print the First boot card
        </button>
      </div>
      {blocked && <p className="small error">The browser blocked the card's tab. Allow pop-ups for this page, then press Print the First boot card again.</p>}
      <BootReport report={report} />
    </div>
  );
}
