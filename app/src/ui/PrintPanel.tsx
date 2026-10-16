// "Make cartridge": the print PDF with box, labels and manual. pdf-lib and the
// fonts load only when a creator downloads.

import { useState } from "react";
import type { Template } from "../project/schema.ts";
import { useProjectStore } from "../project/store.ts";
import { draftManual } from "../print/manual.ts";
import type { Paper, PrintFonts, Screenshot } from "../print/pdf.ts";
import { slugify, submissionZip } from "../files/exports.ts";

const PAPER_KEY = "cartridge-studio:paper";

function defaultPaper(): Paper {
  try {
    const saved = localStorage.getItem(PAPER_KEY);
    if (saved === "letter" || saved === "a4") return saved;
  } catch {
    // Storage can be blocked; fall through to the locale.
  }
  return /^(en-(US|CA)|es-(MX|US)|fr-CA)$/i.test(navigator.language) ? "letter" : "a4";
}

let fontsPromise: Promise<PrintFonts> | null = null;
function loadFonts(): Promise<PrintFonts> {
  const get = async (name: string) => {
    const res = await fetch(`${import.meta.env.BASE_URL}fonts/${name}`);
    if (!res.ok) throw new Error(`Couldn't load the font ${name}`);
    return new Uint8Array(await res.arrayBuffer());
  };
  fontsPromise ??= Promise.all([
    get("press-start-2p.ttf"),
    get("atkinson-hyperlegible-regular.ttf"),
    get("atkinson-hyperlegible-bold.ttf"),
  ]).then(([title, body, bold]) => ({ title, body, bold }));
  fontsPromise.catch(() => (fontsPromise = null));
  return fontsPromise;
}

interface Props {
  template: Template;
  /** The preview's current picture, for the box back. */
  screenshot: () => Promise<Screenshot | undefined>;
  /** A signed build of the current project. */
  buildSigned: () => Promise<{ a78: Uint8Array; bin: Uint8Array }>;
  /** The current project as a .cartridge file. */
  cartridgeFile: () => Promise<Uint8Array>;
  onDownload: (bytes: Uint8Array, name: string) => void;
}

export function PrintPanel({ template, screenshot, buildSigned, cartridgeFile, onDownload }: Props) {
  const project = useProjectStore((s) => s.project);
  const edit = useProjectStore((s) => s.edit);
  const [paper, setPaper] = useState<Paper>(defaultPaper);
  const [busy, setBusy] = useState<null | "pdf" | "package">(null);
  const [error, setError] = useState<string | null>(null);

  const edited = project.cartridge.manualText !== null;
  const text = project.cartridge.manualText ?? draftManual(project, template);

  const choosePaper = (p: Paper) => {
    setPaper(p);
    try {
      localStorage.setItem(PAPER_KEY, p);
    } catch {
      // Not remembered; that's fine.
    }
  };

  const makePdf = async () => {
    const [{ buildPrintPdf }, fonts, shot] = await Promise.all([import("../print/pdf.ts"), loadFonts(), screenshot()]);
    return buildPrintPdf({ project, template, paper, fonts, screenshot: shot });
  };

  const run = async (what: "pdf" | "package") => {
    setBusy(what);
    setError(null);
    const slug = slugify(project.title);
    try {
      if (what === "pdf") {
        onDownload(await makePdf(), `${slug}-print.pdf`);
      } else {
        const [pdf, rom, file] = await Promise.all([makePdf(), buildSigned(), cartridgeFile()]);
        onDownload(submissionZip({ project, template, ...rom, pdf, cartridgeFile: file }), `${slug}-submission.zip`);
      }
    } catch (e) {
      setError(`We couldn't make the ${what === "pdf" ? "PDF" : "package"}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="panel print" aria-labelledby="print-h">
      <h2 id="print-h">Make cartridge</h2>
      <p className="muted small">
        A printable box front and back, two cartridge labels and a manual. The box art uses your sprites, and the back
        shows what's in the preview right now.
      </p>

      <div className="print-row">
        <span>Manual</span>
        {edited && (
          <button
            type="button"
            className="link"
            onClick={() => edit((d) => void (d.cartridge.manualText = null))}
            title="Go back to the text written from your rules and settings"
          >
            Reset to draft
          </button>
        )}
      </div>
      <textarea
        className="manual-text"
        aria-label="Manual text"
        spellCheck
        value={text}
        rows={12}
        onChange={(e) => edit((d) => void (d.cartridge.manualText = e.target.value), "manual")}
      />
      <p className="muted small">
        {edited
          ? "Edited: the manual no longer follows changes to your rules and settings."
          : "Written from your rules and settings, and kept up to date until you edit it."}{" "}
        Start a line with “# ” for a heading or “- ” for a bullet.
      </p>

      <div className="toolbar">
        <label className="print-paper">
          <span className="muted small">Paper</span>
          <select aria-label="Paper size" value={paper} onChange={(e) => choosePaper(e.target.value as Paper)}>
            <option value="letter">US Letter</option>
            <option value="a4">A4</option>
          </select>
        </label>
        <button type="button" onClick={() => void run("pdf")} disabled={busy !== null}>
          {busy === "pdf" ? "Making PDF…" : "Download print PDF"}
        </button>
      </div>
      <div className="toolbar">
        <button type="button" className="secondary" onClick={() => void run("package")} disabled={busy !== null}>
          {busy === "package" ? "Packing…" : "Download submission package"}
        </button>
        <span className="muted small">Signed ROMs, this PDF, your game file, source and a checklist, in one ZIP.</span>
      </div>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
