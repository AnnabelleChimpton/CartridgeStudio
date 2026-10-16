// Download .a78 / .bin. Downloads are always signed, so they boot on a real console.

import { useState } from "react";
import { slugify } from "../files/exports.ts";
import { download, type Preview } from "../ui/usePreview.ts";

export function RomDownloads({ preview, title }: { preview: Preview; title: string }) {
  const [exporting, setExporting] = useState(false);
  const exportRom = async (format: "a78" | "bin") => {
    setExporting(true);
    try {
      const rom = await preview.buildSigned();
      download(format === "a78" ? rom.a78 : rom.bin, `${slugify(title)}.${format}`);
    } catch (e) {
      preview.setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };
  return (
    <>
      <button type="button" className="secondary" disabled={!preview.lastGood || exporting} onClick={() => void exportRom("a78")}>
        Download .a78
      </button>
      <button type="button" className="secondary" disabled={!preview.lastGood || exporting} onClick={() => void exportRom("bin")}>
        Download .bin
      </button>
      {exporting && <span className="muted small">Preparing download…</span>}
    </>
  );
}
