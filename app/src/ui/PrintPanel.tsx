// "Print the box": the print PDF with box, labels and manual, as the kit and
// code editors' print panels show it. The everything ZIP, which carries this
// PDF, is made from Show it. pdf-lib and the fonts load only when a
// creator downloads.

import { useState } from "react";
import { slugify } from "../files/exports.ts";
import type { Layout, Paper, PrintSubject, Screenshot } from "../print/pdf.ts";
import { loadPrintFonts } from "../print/fonts.ts";

const PAPER_KEY = "cartridge-studio:paper";

/** The paper last chosen, or the one the browser's language suggests. */
export function defaultPaper(): Paper {
  try {
    const saved = localStorage.getItem(PAPER_KEY);
    if (saved === "letter" || saved === "a4") return saved;
  } catch {
    // Storage can be blocked; fall through to the locale.
  }
  return /^(en-(US|CA)|es-(MX|US)|fr-CA)$/i.test(navigator.language) ? "letter" : "a4";
}

const LAYOUT_KEY = "cartridge-studio:print-layout";

function savedLayout(): Layout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === "booklet" ? "booklet" : "plain";
  } catch {
    return "plain";
  }
}

interface ControlsProps {
  title: string;
  /** The manual as it will print: the creator's edit, or the draft. */
  text: string;
  edited: boolean;
  onText: (text: string) => void;
  onReset: () => void;
  makePdf: (paper: Paper, layout: Layout) => Promise<Uint8Array>;
  onDownload: (bytes: Uint8Array, name: string) => void;
}

/** The manual editor, paper choice and the PDF download, for any kind of game. */
export function PrintControls({ title, text, edited, onText, onReset, makePdf, onDownload }: ControlsProps) {
  const [paper, setPaper] = useState<Paper>(defaultPaper);
  const [layout, setLayout] = useState<Layout>(savedLayout);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choosePaper = (p: Paper) => {
    setPaper(p);
    try {
      localStorage.setItem(PAPER_KEY, p);
    } catch {
      // Not remembered; that's fine.
    }
  };

  const chooseLayout = (l: Layout) => {
    setLayout(l);
    try {
      localStorage.setItem(LAYOUT_KEY, l);
    } catch {
      // Not remembered; that's fine.
    }
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      onDownload(await makePdf(paper, layout), `${slugify(title)}-print.pdf`);
    } catch (e) {
      setError(`Making the PDF stopped: ${e instanceof Error ? e.message : String(e)}. Your game is saved; press the button again to retry.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="muted small">
        A printable box front and back, two cartridge labels and a manual. The box art uses your sprites, and the back
        shows what's in the preview right now.
      </p>

      <div className="print-row">
        <span>Manual</span>
        {edited && (
          <button type="button" className="link" onClick={onReset} title="Go back to the text written from your rules and settings">
            Reset to draft
          </button>
        )}
      </div>
      <textarea className="manual-text" aria-label="Manual text" spellCheck value={text} rows={12} onChange={(e) => onText(e.target.value)} />
      <p className="muted small">
        {edited
          ? "Edited: the manual no longer follows changes to your rules and settings."
          : "Written from your rules and settings, and kept up to date until you edit it."}{" "}
        Start a line with “# ” for a heading or “- ” for a bullet.
      </p>

      <div className="toolbar">
        <label className="print-paper">
          <span className="muted small">Paper</span>
          <select value={paper} onChange={(e) => choosePaper(e.target.value as Paper)}>
            <option value="letter">US Letter</option>
            <option value="a4">A4</option>
          </select>
        </label>
        <label className="print-paper">
          <span className="muted small">Manual</span>
          <select value={layout} onChange={(e) => chooseLayout(e.target.value as Layout)} aria-describedby="print-layout-hint">
            <option value="plain">Plain pages</option>
            <option value="booklet">Booklet</option>
          </select>
        </label>
        <button type="button" onClick={() => void run()} disabled={busy}>
          {busy ? "Making PDF…" : "Download print PDF"}
        </button>
      </div>
      <p className="muted small" id="print-layout-hint">
        {layout === "booklet"
          ? `Booklet: ${paper === "a4" ? "A5" : "half-letter"} pages, two to a sheet. Print double-sided, flipping on the short edge, then fold and staple down the middle.`
          : "Plain pages: the manual on full sheets, printed one side or both."}
      </p>
      {error && <p className="error">{error}</p>}
    </>
  );
}

/** Builds the PDF for a subject, loading pdf-lib and the fonts on first use. */
export async function printPdf(subject: PrintSubject, paper: Paper, layout: Layout, screenshot: () => Promise<Screenshot | undefined>) {
  const [{ buildPrintPdf }, fonts, shot] = await Promise.all([import("../print/pdf.ts"), loadPrintFonts(), screenshot()]);
  return buildPrintPdf({ subject, paper, layout, fonts, screenshot: shot });
}
