// The print kit's fonts, fetched from the app on first use: Atkinson
// Hyperlegible regular and bold (OFL). Titles are drawn in the kit's own
// 3×5 font as vector shapes, so they need no font file.

import type { PrintFonts } from "./pdf.ts";

let fontsPromise: Promise<PrintFonts> | null = null;

export function loadPrintFonts(): Promise<PrintFonts> {
  const get = async (name: string) => {
    const res = await fetch(`${import.meta.env.BASE_URL}fonts/${name}`);
    if (!res.ok) throw new Error(`Couldn't load the font ${name} (HTTP ${res.status}).`);
    return new Uint8Array(await res.arrayBuffer());
  };
  fontsPromise ??= Promise.all([get("atkinson-hyperlegible-regular.ttf"), get("atkinson-hyperlegible-bold.ttf")]).then(([body, bold]) => ({ body, bold }));
  fontsPromise.catch(() => (fontsPromise = null));
  return fontsPromise;
}
