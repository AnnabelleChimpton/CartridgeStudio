# Cartridge Studio: design direction

This is the look and feel of Cartridge Studio, and the rules that keep it
consistent as more people add to it. The code that carries it out is `app/src/styles.css` (tokens first,
then components, then screens) and the shell in `app/src/ui/`:

- `app/src/ui/tokens.ts`, the one token set, which
  `app/scripts/make-identity.mjs` writes out as `app/src/tokens.css`, the
  tokens block in `site/styles.css`, the manifest, every `theme-color` and
  the icons;
- `app/src/styles.css` (components, then screens);
- the shell in `app/src/ui/`: `TopBar`, `ContextStrip` and `StartChooser`;
  `Toaster`, `Icon`, `brand.ts` and `BrandMark` (with `KitText`); `prefs.ts`,
  which holds the tier.

`node harness/check-hex.mjs` fails on any hex colour outside the generated
files and `ui/ntsc.ts`, and on generated files that are out of date.

## 1. Identity: the console's own workbench

Cartridge Studio is a workbench for making real cartridges. It should feel
like a well-made tool built from the console's own materials: its 256
colours, its 3×5 character set and its pixels. The game is always the
brightest thing on screen.

- **Built from the palette.** Every colour in the interface is an entry from
  the 7800's NTSC palette (§3). Neutral console greys carry the chrome, and
  `$3B` *cartridge orange* marks the one thing to do next.
- **Tactile.** Buttons have a small solid "keycap" edge and press down when
  clicked. Panels are flat trays with 4 px corners, one level deep.
- **Honest pixels.** Editor canvases draw exactly what the ROM draws: room
  tiles come from the kit's own tile glyphs, and sprites use 2:1 pixels.
- **Restrained.** A plain CSS TV bezel frames the game. There are no CRT
  shaders or scanlines, no curvature, no glows, no blur, no dot grids, no
  mascot, no illustrated hardware, and no UI sound effects.
- **Two registers only.** Everything is made of what goes on the cart, or
  borrows from 1980s cartridge-era print (box backs, end labels, booklets,
  crop marks). Nothing else: no retro costume fonts, no AI sparkle.
- **Ours.** No console makers' logos, wordmarks, rainbow stripes, fonts, trade
  dress or console likenesses. Consoles are named in plain text only where a
  creator needs to know what plays their game.

**Dark theme only for this pass.** A light theme is deferred. The tokens are
built so one could be added later by redefining the semantic layer.

## 2. Type

| Role | Font | Where |
| --- | --- | --- |
| Interface and reading | **Atkinson Hyperlegible** (OFL, `app/public/fonts/`) | Everything you read or operate, including the start screen headline, step numbers, badges and site headings. It was designed for low vision; the slashed zero and distinct I, l and 1 matter in names, numbers and `$XX` colours. |
| Game-derived display | **The kit's own 3×5 font** (`kit/font.ts`), drawn as square pixels by `KitText` (`ui/BrandMark.tsx`) | Short strings that come from the game: the wordmark, preset and game titles on cards, the TV-mode title, box, label and player titles, and the "BY …" credit. Uppercase, at whole-number scales of 3× or more. |
| Code and bytes | System monospace | Code views, the build log, ROM sizes in tables. |

The kit font has A to Z, 0 to 9 and `. ! ? - : '`. A title with any other
character (lowercase is uppercased; `&`, accents and the rest are not) is
set in Atkinson Hyperlegible bold instead. Kit-font text always keeps the
words as real text (visually hidden beside the SVG), so screen readers,
search and copying get them.

There is no third display face. Press Start 2P is gone from the app, the
site and the player page; print loads it only until its titles move to the
kit font.

Scale (px): `--fs-xs` 12 (hints, `.small`), `--fs-sm` 13 (secondary UI,
badges), `--fs-md` 14 (controls, panel body), `--fs-body` 15 (reading text,
rule sentences), `--fs-lg` 18 (titles), `--fs-xl` 22 (dialog titles),
`--fs-2xl` 30 (the start screen headline). Panel headings (`h2` in panels)
are small tracked labels: 13 px, 700, uppercase, muted.

## 3. Colour: tokens named after the palette

Two layers.

1. **Palette tokens** are real entries from the console's palette, named by
   their `$hue luma` value, with the colours `ui/ntsc.ts` computes for them:
   `--ntsc-00` `#0d0d0d`, `--ntsc-3b` `#eda37e`, and so on. To change a colour,
   pick another entry in `ui/tokens.ts` and rerun
   `node app/scripts/make-identity.mjs`; never type in a hex.
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
| `--teal` | `$BB` `#78ced6` | Second accent: "play", the jam banner |
| `--accent-soft`, `--error-soft`, `--teal-soft`, `--ok-soft` | `$21`, `$41`, `$B1`, `$C1` | Dark fills under `--text` (or their own colour): the selected row, an error line, the jam banner |
| `--power-off`, `--power-paused`, `--power-on` | `$04`, `$C6`, `$CB` | The bezel's power light |
| `--code-*` | `$00` to `$4B` | The 7800basic editor: keyword `$3C`, number `$BB`, string `$CB`, label `$2E`, builtin `$4B`, comment `$0B`, selection `$03`, on `$00` |

The soft fills are palette entries too, not a colour mixed with
transparency. The only mixed values are the dialog scrim and the one shadow,
both `$00` at partial opacity.

There are no violet, gold, cream or navy tokens. The site and the player
page use the same set.

**Invariants**, which are the design system's acceptance criteria:

- Text is at least 4.5:1 against every surface it can sit on (`--sunken`,
  `--bg`, `--surface`, `--raised`). `PAIRS` in `ui/tokens.ts` lists every
  pair, and `ui/tokens.test.ts` checks each one.
- Field edges and the focus ring are at least 3:1.
- Every control is at least 24 × 24 px.
- There is one focus ring style: `--focus`, 2 px, 2 px offset.

axe checks contrast on every tab, Show it and a dialog in
`e2e/a11y.spec.ts` and `e2e/shell.spec.ts`.

The emulator, sprite mats and room canvas sit on plain `$00`, with no dot
grid: pixel art is drawn for a TV, and its colours read truest on black.

## 4. Space, shape, depth

- **Spacing** is a 4 px grid: `--s-1` 4, `--s-2` 8, `--s-3` 12, `--s-4` 16,
  `--s-5` 24, `--s-6` 32, `--s-7` 48.
- **Radii:** `--r-lg` 4 px (panels, cards, dialogs, menus, the bezel) and
  `--r-sm` 2 px (chips, badges, fields, keycap buttons, the Mode switch).
  `--r-md` is kept as an alias of 2 px. Nothing is a pill, and nothing is
  round except a native control.
- **Depth:** flat. Panels are separated by a 1 px `--line`, with no shadow.
  `--shadow-2` is only for dialogs, menus and toasts. Keycap buttons, here
  and on the site, use a 2 px solid edge, not a blur.
- **One container level.** A panel or tray holds rows, not cards. Inside it,
  rules and spacing separate things: rules and counters are rows with
  dividers, guide steps are an inline list, the CPU meter is a plain row
  under the bezel.
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
`.context-item.{error|guide|jam|offline}`. Only errors carry a mark (the
pixel `error` icon, in `--error`); the others are a tinted line of text. Don't add a second strip or a
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

A plain, flat frame in CSS around the screen: `--raised` with a 1 px
`--line` and 4 px corners. Its square power light is the one status light in
the app. It is `--power-off` before the first build, `--power-on` (`$CB`)
while the game runs and `--power-paused` while it is paused, flat, with no
glow. The Play panel says the same thing in words. There is no logo, no
brand and no curvature, and it disappears in TV mode. The site's clips and
the player page use the same bezel and light.

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
| `--dur` | 160 ms | Menus, tabs, toasts, the context strip |
| `--dur-slow` | 200 ms | Cartridge insert, dialog in |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | Everything. Nothing overshoots. |

Entrances **move rather than fade**, so text is never shown at reduced
contrast. Nothing lifts on hover: hover and `:focus-visible` give a card or
button an `--accent-text` border. `steps()` is only for sprite-like things.

Each animation, and what it tells you:

- **Cartridge insert:** the game screen settles into its bezel when an editor
  opens: the game is loaded. The one themed motion; ease-out, no overshoot.
- **Build tick:** a pixel check steps in beside "Up to date": the build
  finished.
- **Preset cards** cycle their cast's animation frames while hovered or
  focused: these sprites are what the game draws.
- **Menus and dialogs** drop in 4 to 8 px: this opened from where you clicked.
- **Toasts** slide up, then leave on their own: a save or download happened.
- **Tabs:** the underline grows under the chosen tab: this is where you are.
- **Recording:** the square beside "Recording" blinks once a second: a clip
  is being made.

With `prefers-reduced-motion: reduce`, durations drop to near zero,
entrances are removed and the cards show their first frame only.

## 8. Iconography and the mark

**Icons** (`app/src/ui/Icon.tsx`) are filled square pixels on a 10 × 10 grid,
drawn at 2× (20 px) with `crispEdges` in `currentColor`. The set is small:
play, pause, restart, sound, mute, undo, redo, copy, close, a menu chevron,
and one `error` mark for the context strip. Icons are square-pixelled (1:1);
2:1 pixels are only for game content. There is no icon font and no
third-party set.

Icons appear only where a word would be too many: the emulator's controls,
undo and redo, copy, and a dialog's close button. Buttons whose label says
everything (Show it, Save game file, menu items, toasts, the context strip
apart from errors) have no icon. The SVG is always `aria-hidden`; the button
has a text label or an `aria-label`.

**The mark** (`ui/brand.ts`, drawn by `BrandMark.tsx`) is a cartridge on a
16 × 16 grid: the shell in `$3B` with its `$37` keycap edge one pixel lower,
a square grip bar, and "CS" in the kit's 3×5 font on a `$0F` label. It is
original artwork: not a console and not anyone's logo. `make-identity.mjs`
draws the same rects into `icon.svg`, the 192 and 512 PNGs, the
apple-touch icon, the maskable icon (the whole mark inside the 80% safe
circle), the 32 px favicon and the site's mark. It reads at 16 px.

## 9. Three tiers, one app

Cartridge Studio serves three kinds of maker. They see the same app, words
and files; the tier only decides what is shown by default.

| Tier | Detail line in the switch | Sees by default |
| --- | --- | --- |
| **Kit** | "Things, the room and the game settings." | The Things, Room, Rules and Game tabs, the game and the console-time meter. Counters and the developer drawer are hidden. |
| **Rules** | Adds counters. | Everything in Kit, plus counters and the developer drawer. |
| **7800basic** | Adds the Code tab and opens Cartridge stats. | Everything in Rules, plus the Code tab (the generated 7800basic, editable after eject), with Cartridge stats open. |

- **One control:** the tier switch in the top bar (Kit · Rules · 7800basic),
  stored per browser in `localStorage["cs-tier"]` and written to
  `<html data-tier="…">`.
- **First visit is Kit.** The switch is always visible, so the next step up
  is one click away.
- **Nothing is lost.** Switching down hides editors, never data.
- **For code:** `TIERS` and `useTier()` in `app/src/ui/prefs.ts`; in CSS,
  `[data-tier="…"]`. Tier-gated tabs carry `data-tab="…"`.

Owner's note, October 2026: the Kit tier keeps the Rules tab visible
(decided October 16). Tier names and detail lines change with the code, in
the same commit, and this table follows them.

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
- **Small parts:** badges (`.badge`, square tags), the Mode switch
  (`.segmented`, a square-ended radio group whose chosen option is filled
  `--accent`), kit-font titles (`.kit-text`) and empty states (`.empty`,
  inline and left-aligned, no dashed box).

## 11. Not doing

- Logos or console likenesses.
- A WebGL CRT effect.
- A mascot.
- UI sound effects.
- A light theme (deferred).
- Illustrated hardware.
- More than one context strip.
