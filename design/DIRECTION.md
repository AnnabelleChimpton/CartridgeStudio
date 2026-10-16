# Cartridge Studio: design direction

This is the look and feel of Cartridge Studio, and the rules that keep it
consistent as more people add to it. It follows the phase 2 audit's design
guidance. The code that carries it out is `app/src/styles.css` (tokens first,
then components, then screens) and the shell in `app/src/ui/`:

- `TopBar`, `ContextStrip` and `StartChooser`;
- `Toaster`, `Icon` and `BrandMark`;
- `prefs.ts`, which holds the tier.

## 1. Identity: the console's own workbench

Cartridge Studio is a workbench for making real cartridges. It should feel
like a well-made tool built from the console's own materials: its 256
colours, its 3×5 character set and its pixels. The game is always the
brightest thing on screen.

- **Built from the palette.** Every colour in the interface is an entry from
  the 7800's NTSC palette (§3). Neutral console greys carry the chrome, and
  `$3B` *cartridge orange* marks the one thing to do next.
- **Tactile.** Buttons have a small solid "keycap" edge and press down when
  clicked. Panels are soft-cornered trays.
- **Honest pixels.** Editor canvases draw exactly what the ROM draws: room
  tiles come from the kit's own tile glyphs, and sprites use 2:1 pixels.
- **Restrained.** A plain CSS TV bezel frames the game. There are no CRT
  shaders or scanlines, no curvature, no mascot, no illustrated hardware, and
  no UI sound effects.
- **Ours.** No console makers' logos, wordmarks, rainbow stripes, fonts, trade
  dress or console likenesses. Consoles are named in plain text only where a
  creator needs to know what plays their game.

**Dark theme only for this pass.** A light theme is deferred. The tokens are
built so one could be added later by redefining the semantic layer.

## 2. Type

| Role | Font | Where |
| --- | --- | --- |
| Interface and reading | **Atkinson Hyperlegible** (OFL, `app/public/fonts/`) | Everything you read or operate. It was designed for low vision; the slashed zero and distinct I, l and 1 matter in names, numbers and `$XX` colours. |
| Brand wordmark | **The kit's own 3×5 font** (`kit/font.ts`), drawn as SVG | The top-bar wordmark: the same letters every game's title screen uses. |
| Display moments | **Press Start 2P** (OFL, `app/public/fonts/`) | The start screen headline, preset card names and the title in TV mode. Never for body text, controls or anything longer than a line. |
| Code | System monospace | Code views, the build log. |

All three fonts ship with the app, so it looks the same offline.

Scale (px): `--fs-xs` 12 (hints, `.small`), `--fs-sm` 13 (secondary UI,
badges), `--fs-md` 14 (controls, panel body), `--fs-body` 15 (reading text,
rule sentences), `--fs-lg` 18 (titles), `--fs-xl` 22 (dialog titles). Press
Start 2P is used at 13, 22 and 28 px only, with line height 1.45 or more.
Panel headings (`h2` in panels) are small tracked labels: 13 px, 700,
uppercase, muted.

## 3. Colour: tokens named after the palette

Two layers.

1. **Palette tokens** are real entries from the console's palette, named by
   their `$hue luma` value, with the colours `ui/ntsc.ts` computes for them:
   `--ntsc-00` `#0d0d0d`, `--ntsc-3b` `#eda37e`, and so on. To change a colour,
   pick another entry; never type in a hex that isn't one.
2. **Semantic tokens** say what a colour is for, and point at a palette token.
   Markup and components use only these.

| Semantic token | Palette entry | Use |
| --- | --- | --- |
| `--sunken`, `--mat` | `$00` `#0d0d0d` | Fields, wells, the mats under canvases |
| `--bg` | `$01` `#1c1c1c` | Page |
| `--surface` (`--panel`) | `$02` `#2b2b2b` | Panels, cards, dialogs |
| `--raised` | `$03` `#3b3b3b` | Secondary buttons, hovered rows |
| `--raised-hover`, `--line` | `$04` `#4a4a4a` | Hovered secondary buttons (under `--text` only), decorative dividers |
| `--field-line` | `$08` `#878787` | Edges of things you type in or choose |
| `--muted` | `$0B` `#b5b5b5` | Secondary text |
| `--text` | `$0F` `#f2f2f2` | Body text |
| `--accent` | `$3B` `#eda37e` | Primary button fill, selection fill |
| `--accent-hover`, `--accent-text` | `$3C` `#fcb38d` | Hovered primary; accent as text or a thin line (links, the "fit" selects, the active tab) |
| `--on-accent` | `$20` `#330b00` | Text on the accent fill |
| `--edge` | `$37` `#b06641` | The keycap edge under primary buttons |
| `--focus` | `$2E` `#ffe188` | The focus ring |
| `--ok` | `$CB` `#76d8a7` | Built, room to spare, the bezel's power light |
| `--error` | `$4B` `#f597ab` | Errors, danger |
| `--teal` | `$BB` `#78ced6` | Second accent: "play", the jam strip |

Soft tints (`--accent-soft`, `--error-soft`, `--teal-soft`) are a palette
token mixed with transparency. They are used only as backgrounds under
`--text`.

**Invariants**, which are the design system's acceptance criteria:

- Text is at least 4.5:1 against every surface it can sit on (`--sunken`,
  `--bg`, `--surface`, `--raised`).
- Field edges and the focus ring are at least 3:1.
- Every control is at least 24 × 24 px.
- There is one focus ring style: `--focus`, 2 px, 2 px offset.

axe checks contrast on every tab, Show it and a dialog in
`e2e/a11y.spec.ts` and `e2e/shell.spec.ts`.

The emulator, sprite mats and room canvas sit on `$00`: pixel art is drawn
for a TV, and its colours read truest on black.

## 4. Space, shape, depth

- **Spacing** is a 4 px grid: `--s-1` 4, `--s-2` 8, `--s-3` 12, `--s-4` 16,
  `--s-5` 24, `--s-6` 32, `--s-7` 48.
- **Radii:** `--r-sm` 6 (fields), `--r-md` 10 (buttons, rows), `--r-lg` 16
  (panels, cards, dialogs), `--r-pill` (badges, the Mode switch).
- **Depth:** flat, `--shadow-1` (panels) and `--shadow-2` (menus, toasts,
  dialogs). Buttons use a 2 px solid edge, not a blur.
- **Targets:** 24 px minimum (WCAG 2.5.8). Main buttons are 32 to 36 px tall
  and tabs 44 px.
- **Layout:** a two-column workbench, with tabs and editing on the left and
  the game and Show it in a sticky column on the right. At 1280 px the play
  column is 380 to 400 px; it grows to 560 px, and the page stops at 1920 px.
  Below 1000 px (tablets) the game and Show it sit side by side above the
  editor, and the top bar wraps.

## 5. The shell

### Top bar

From left to right:

- the brand mark and the wordmark in the kit font;
- the game title and its kind badge;
- undo and redo;
- the **Mode** switch;
- **Save game file**;
- the **Game** menu (New game, Open…).

### Context strip

One line directly under the top bar, inside its sticky area. It is **one
slot for one item**. Several features want this space, so it shows only the
highest-priority item that is offered:

1. **error**: for example "Couldn't open notes.cartridge". It is announced
   with `role="alert"` and has a Dismiss button.
2. **guide**: the current onboarding step.
3. **jam**: the jam's theme and time left.
4. **offline**: offline or install status.

Items below 1 use `role="status"`. When nothing is offered, the strip takes
no space.

API (`app/src/ui/ContextStrip.tsx`):

```tsx
useContextItem(failed && { kind: "error", message: "Couldn't open it", onDismiss });
<ContextItem kind="guide" message="Step 1 of 3: draw your hero" action={<button>Next</button>} />
```

Each item has `kind`, `message`, an optional single `action` element and an
optional `onDismiss`. CSS lives under `.context-strip` and
`.context-item.{error|guide|jam|offline}`. Don't add a second strip or a
banner elsewhere: offer an item here.

### Show it

Two groups, in this order:

- **Make it real** has primary weight (accent-tinted, larger buttons): "Put
  it on a console", then "Print the box" (box, labels, manual and the
  package).
- **Share it**: "Send to family" (the one-file player), then "Make a clip".

TV mode and full screen are **one control**, "Play on a TV", which sits with
the game's own controls in the Play panel. It shows the game title and the
gamepad prompt.

### The game's bezel

A plain dark-plastic frame in CSS around the screen. It has slightly rounded
corners and a small power light that turns `--ok` when the game is built.
There is no logo, no brand and no curvature, and it disappears in TV mode.

## 6. Editors

- **Room painter**: tiles are drawn from `TILE_GLYPHS` in `kit/font.ts`,
  repeated 2×2 per cell in the wall palette's colours, exactly as the ROM's
  `plotmap` draws them. Things are drawn at game scale.
- **Colour picker**: every colour has a plain name ("light sea green",
  "very dark red") from `colorName()` in `ui/ntsc.ts`. The name is in the
  swatch's and each option's accessible name, and is shown under the grid for
  the colour being pointed at.
- **Rules** read as sentences. The "fit" selects are words, in accent text
  with a dotted underline that turns solid on hover or focus.

## 7. Motion

| Token | Value | Use |
| --- | --- | --- |
| `--dur-fast` | 120 ms | Hover, press |
| `--dur` | 200 ms | Menus, tabs, toasts, the context strip |
| `--dur-slow` | 420 ms | Cartridge insert, dialog in |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | Most things |
| `--ease-spring` | `cubic-bezier(.34,1.56,.64,1)` | Small overshoots |

Entrances **move rather than fade**, so text is never shown at reduced
contrast.

The small delights:

- **Build tick:** a pixel check pops in beside "Up to date".
- **Cartridge insert:** the game screen settles into its bezel when an editor
  opens.
- **Preset cards** cycle their cast's animation frames while hovered or
  focused, and lift a little.
- **Toasts** slide up for saves and downloads, then leave on their own.

With `prefers-reduced-motion: reduce`, durations drop to near zero,
entrances are removed and the cards show their first frame only.

## 8. Iconography

Small inline SVG icons drawn for this app (`app/src/ui/Icon.tsx`): a 20 px
grid with 1.75 px round-capped strokes in `currentColor`. There is no icon
font and no third-party set. Icons always sit beside a text label, or the
button has an `aria-label`; the SVG itself is always `aria-hidden`. The brand
mark (`BrandMark.tsx`) is an original chunky cartridge with a four-pixel
spark: it is not a console and not anyone's logo.

## 9. Three tiers, one app

Cartridge Studio serves three kinds of maker. They see the same app, words
and files; the tier only decides what is shown by default.

| Tier | Who | Sees by default |
| --- | --- | --- |
| **Starter** | Families, kids, first-timers working from a preset | Things, Room and Game tabs, the game, Show it and the console-time meter. No rule editor, no counters, no developer drawer. (The classic shooter keeps all its tabs.) |
| **Maker** | Hobbyists building their own game from rules | Everything in Starter, plus the Rules tab, counters and "For developers". |
| **Coder** | People who want 7800basic itself | Everything in Maker, with the developer drawer open. The code workspace (coder-mode branch) plugs in here. |

- **One control:** the Mode switch in the top bar (Starter · Maker · Coder),
  stored per browser in `localStorage["cs-tier"]` and written to
  `<html data-tier="…">`.
- **First visit is Starter.** The switch is always visible, so the next step
  up is one click away.
- **Nothing is lost.** Switching down hides editors, never data.
- **For code:** `useTier()` in `app/src/ui/prefs.ts`; in CSS,
  `[data-tier="…"]`. Tier-gated tabs carry `data-tab="…"`.

The audit's Make, Shape and Code proposal (depth revealed in place through
"Customise", with Dodger leading the chooser) is the likely next step for
naming and placement. It changes copy and placement, not this structure.

## 10. Components

All are in `styles.css` and built only from semantic tokens. Class names
from before the redesign keep working and keep their meaning.

- **Buttons:** primary (bare `button`, or `.primary`), secondary
  (`.secondary`), quiet (`.quiet`, `.icon`, `.link`) and danger (`.danger`,
  which combines with the others).
- **Fields:** text inputs, `.num`, selects and textareas: a sunken fill with a
  `--field-line` edge.
- **"Fit" selects:** `select.fit` and `input.fit`.
- **Tabs:** `.workspace-tabs`.
- **Containers and overlays:** panels (`.panel`), dialogs (`.dialog`), the
  context strip (`.context-strip`), toasts (`.toast`) and menus (`.menu`).
- **Small parts:** badges (`.badge`), segmented controls (`.segmented`) and
  empty states (`.empty`).

## 11. Not doing

- Logos or console likenesses.
- A WebGL CRT effect.
- A mascot.
- UI sound effects.
- A light theme (deferred).
- Illustrated hardware.
- More than one context strip.
