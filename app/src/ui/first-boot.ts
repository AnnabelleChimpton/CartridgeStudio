// The "First boot" card: printed when a game boots on a console for the first
// time. A small page of its own, opened in a new tab to print. Print owns the
// label renderer; this card goes through `firstBootCard` so it can be swapped
// for a rendered label without touching the console dialog.

export interface FirstBootInfo {
  title: string;
  /** The ROM file that booted. */
  file?: string;
  /** When it booted, as the card prints it. */
  date: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The card as a standalone HTML page, ready to print. */
export function firstBootCardHtml({ title, file, date }: FirstBootInfo): string {
  const name = esc(title || "Untitled");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>First boot: ${name}</title>
<style>
  body { margin: 0; padding: 24px; background: white; color: black; font: 16px/1.45 system-ui, sans-serif; }
  .card { box-sizing: border-box; width: 3.5in; min-height: 2in; padding: 0.2in; border: 2px solid black; }
  .card h1 { margin: 0 0 4px; font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; }
  .card p { margin: 0; }
  .card .title { font-size: 22px; font-weight: 700; line-height: 1.15; margin: 6px 0 10px; }
  .card dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; margin: 0; font-size: 13px; }
  .card dt { font-weight: 700; }
  .card dd { margin: 0; border-bottom: 1px solid black; min-height: 1.2em; }
  .note { max-width: 3.5in; font-size: 14px; }
  button { font: inherit; padding: 6px 14px; margin-top: 16px; }
  @media print { .note, button { display: none; } body { padding: 0; } }
</style></head>
<body>
<div class="card" data-testid="first-boot-card">
  <h1>First boot</h1>
  <p class="title">${name}</p>
  <dl>
    <dt>Booted on</dt><dd>${esc(date)}</dd>
    <dt>File</dt><dd>${esc(file ?? "")}</dd>
    <dt>Console</dt><dd></dd>
    <dt>Cartridge</dt><dd></dd>
  </dl>
</div>
<p class="note">Write the console and cartridge in by hand, then cut along the border.</p>
<button type="button" onclick="print()">Print the card</button>
</body></html>
`;
}

/** Opens the card in a new tab to print. Returns false when the browser blocked the tab. */
export let firstBootCard = (info: FirstBootInfo): boolean => {
  const url = URL.createObjectURL(new Blob([firstBootCardHtml(info)], { type: "text/html" }));
  const tab = window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return tab !== null;
};

/** For print: replace the card with one drawn by the label renderer. */
export function setFirstBootCard(make: typeof firstBootCard) {
  firstBootCard = make;
}
