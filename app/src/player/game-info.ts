// What the offline player needs to know about a game besides its ROM: how it's
// played (for the controls line and the touch pad) and a few of its sprites
// (for the box-front pre-roll). Read from the game file defensively, without
// the kit's schema, so it keeps working while the game format grows.

/** How the joystick is used: not at all, left and right only, or freely. */
export type Movement = "none" | "lr" | "free";
/** What the button does: fires during play, only starts the game, or unknown (hand-written code). */
export type ButtonUse = "fire" | "start" | "button";

export interface PlayerControls {
  move: Movement;
  button: ButtonUse;
}

/** One sprite frame: rows of `0`-`3` and the 7800 colours (`$3A`) for 1-3. */
export interface BoxSprite {
  rows: string[];
  colors: [string, string, string];
}

export interface BoxArt {
  /** The game's background colour, as a 7800 colour (`$00`). */
  background: string;
  /** The hero first, then up to three others. */
  sprites: BoxSprite[];
}

export interface PlayerInfo {
  controls: PlayerControls;
  art?: BoxArt;
  /** The game's "Made by", when it has one. */
  madeBy?: string;
}

/** For games we know nothing about: the full joystick and a button. */
export const UNKNOWN_CONTROLS: PlayerControls = { move: "free", button: "button" };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const COLOR = /^\$[0-9A-Fa-f]{2}$/;
const ROW = /^[0-3]+$/;

/** Every key in a JSON tree. */
function keys(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) for (const x of v) keys(x, out);
  else if (isObj(v))
    for (const [k, x] of Object.entries(v)) {
      out.add(k);
      keys(x, out);
    }
  return out;
}

/** A kit type the joystick moves: `control` (kit v2) or a player behaviour (v1 files). */
const controlAxes = (t: unknown): string | undefined => {
  if (!isObj(t)) return undefined;
  if (isObj(t.control)) return str(t.control.axes) ?? "both";
  const b = str(t.behaviour);
  return b === "player-lr" ? "lr" : b === "player-4way" || b === "player-8way" ? "both" : undefined;
};

/** Kit games: the joystick-controlled things say how it moves; fire does something if a rule or type uses it. */
function kitControls(game: Obj): PlayerControls {
  const axes = arr(game.types).map(controlAxes).filter((a): a is string => !!a);
  const all = keys(game);
  const lr = axes.length > 0 && axes.every((a) => a === "lr");
  const free = axes.length > 0 && !lr;
  // Fire always starts the game from the title; it fires during play if a type shoots or a rule
  // listens for the button (a later kit may add a trigger like { fire: ... }).
  const fires = arr(game.types).some((t) => isObj(t) && str(t.shoots)) || [...all].some((k) => /^(fire|pressFire|button)$/i.test(k));
  return { move: free ? "free" : lr ? "lr" : "none", button: fires ? "fire" : "start" };
}

/** Hand-written 7800basic: look for the joystick reads it uses. */
function codeControls(source: string): PlayerControls {
  const vertical = /\bjoy0(up|down)\b/i.test(source);
  const horizontal = /\bjoy0(left|right)\b/i.test(source);
  const button = /\bjoy0fire/i.test(source);
  if (!vertical && !horizontal && !button) return UNKNOWN_CONTROLS;
  return { move: vertical ? "free" : horizontal ? "lr" : "none", button: button ? "button" : "start" };
}

function paletteColors(game: Obj): Map<string, [string, string, string]> {
  const m = new Map<string, [string, string, string]>();
  for (const p of arr(game.palettes)) {
    if (!isObj(p)) continue;
    const id = str(p.id);
    const c = arr(p.colors).map(str);
    if (id && c.length === 3 && c.every((x) => x && COLOR.test(x))) m.set(id, c as [string, string, string]);
  }
  return m;
}

function sprite(rows: unknown, palette: unknown, palettes: Map<string, [string, string, string]>): BoxSprite | null {
  const r = arr(rows).map(str);
  const colors = palettes.get(str(palette) ?? "") ?? [...palettes.values()][0];
  if (!colors || r.length === 0 || r.length > 32 || !r.every((x) => x && ROW.test(x) && x.length <= 32)) return null;
  if (!r.some((x) => /[1-3]/.test(x!))) return null;
  return { rows: r as string[], colors };
}

/** The hero and a few others: kit types, a shooter's sprites, or a code project's graphics. */
function boxArt(game: Obj): BoxArt | undefined {
  const palettes = paletteColors(game);
  const sprites: { s: BoxSprite; hero: boolean }[] = [];
  for (const t of [...arr(game.types), ...arr(game.sprites)]) {
    if (!isObj(t)) continue;
    const frame = arr(t.frames)[0];
    const s = sprite(frame, t.palette, palettes);
    const hero = controlAxes(t) !== undefined || str(t.role) === "player";
    if (s) sprites.push({ s, hero });
  }
  for (const g of arr(game.graphics)) {
    if (!isObj(g)) continue;
    const s = sprite(g.rows, g.palette, palettes);
    if (s) sprites.push({ s, hero: /player|hero/i.test(str(g.name) ?? "") });
  }
  if (sprites.length === 0) return undefined;
  sprites.sort((a, b) => Number(b.hero) - Number(a.hero));
  const bg = str(game.background) ?? (isObj(game.background) ? str(game.background.color) : undefined);
  return { background: bg && COLOR.test(bg) ? bg : "$00", sprites: sprites.slice(0, 4).map((x) => x.s) };
}

/** Everything the player can learn from a game file (a kit game, code project or Classic shooter). */
export function playerInfo(game: unknown): PlayerInfo {
  if (!isObj(game)) return { controls: UNKNOWN_CONTROLS };
  let controls = UNKNOWN_CONTROLS;
  if ("kit" in game) controls = kitControls(game);
  else if (typeof game.source === "string") controls = codeControls(game.source);
  // The Classic shooter: a ship that slides left and right and fires.
  else if (isObj(game.template) && /shooter/.test(str(game.template.id) ?? "")) controls = { move: "lr", button: "fire" };
  const madeBy = str(game.madeBy)?.trim().slice(0, 29);
  return { controls, art: boxArt(game), ...(madeBy ? { madeBy } : {}) };
}

/** The controls in words, for a keyboard and for a touch screen. */
export function controlsText({ move, button }: PlayerControls): { keys: string; touch: string } {
  const keyMove = move === "lr" ? "Left and right arrows move." : move === "free" ? "Arrow keys move." : "";
  const keyButton = button === "fire" ? "Space or Z fires." : button === "start" ? "Space or Z starts the game." : "Space or Z is the button.";
  const touchMove = move === "lr" ? "The arrows move." : move === "free" ? "The pad moves." : "";
  const touchButton = button === "fire" ? "Fire fires." : button === "start" ? "Tap Start to begin." : "Tap the button to press it.";
  return {
    keys: [keyMove, keyButton, "P pauses. Gamepads work too."].filter(Boolean).join(" "),
    touch: [touchButton, touchMove].filter(Boolean).join(" "),
  };
}
