// 7800basic for CodeMirror: a stream tokenizer (no grammar to keep in sync).
// Statements must be indented; anything at column 0 is a label. `rem` starts
// a comment wherever a statement can start: at the start of a line, after `:`
// and after `then` or `else`. Numbers are decimal, `$` hex or `%` binary.
// Lines between `asm` and `end` are assembly, shown as such.

import type { StreamParser, StringStream } from "@codemirror/language";

/** Statements and keywords (lowercase; 7800basic itself is case-insensitive). */
export const KEYWORDS = new Set(
  `rem dim autodim const set displaymode incgraphic newblock incbanner incmapfile inccompressedgraphic characterset alphachars
  alphadata data sdata speechdata end goto gosub return on if then else for to step next let pop asm inline include bank
  plotsprite plotsprite4 plotchars plotmap plotmapfile plotvalue plotbanner plotanimation clearscreen savescreen restorescreen
  drawscreen drawwait drawhiscores playsfx stopsfx playsong stopsong mutesfx tsound boxcollision reboot lockzone unlockzone
  memcpy memset peekchar pokechar adjustvisible doublebuffer flip changedmaholes topscreen bottomscreen speak savememory
  loadmemory macro endmacro callmacro function incrmtfile playrmt stoprmt sizeof debug interrupts screenheight zoneheight
  romsize tv pokeymusic hssupport hsgamename hsseconds hsdifficultytext hsgameranks pausesilence avoxvoice`
    .split(/\s+/)
    .filter(Boolean),
);

/** Built-in variables and functions: joysticks, the frame counter, registers. */
export const BUILTINS = new Set(
  `rand rand16 frame joy0up joy0down joy0left joy0right joy0fire joy0fire0 joy0fire1 joy1up joy1down joy1left joy1right
  joy1fire joy1fire0 joy1fire1 joy0any joy1any switchreset switchselect switchpause switchleftb switchrightb paldetected
  score0 score1 temp1 temp2 temp3 temp4 temp5 temp6 temp7 temp8 temp9 BACKGRND SWCHA SWCHB INPT4 INPT5 CTRL WSYNC MSTAT
  bcdtodecimal converttobcd`
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase()),
);

/** Palette registers: P0C1 to P7C3. */
const PALETTE_REGISTER = /^p[0-7]c[1-3]$/;
/** Statements whose next word(s) are labels. */
const JUMPS = new Set(["goto", "gosub"]);

export interface BasicState {
  /** A statement can start here (so `rem` is a comment). */
  statement: boolean;
  /** The words after goto/gosub are labels, until the statement ends. */
  label: boolean;
  /** Inside an asm … end block. */
  asm: boolean;
}

export const basicParser: StreamParser<BasicState> = {
  name: "7800basic",
  startState: () => ({ statement: true, label: false, asm: false }),
  copyState: (s) => ({ ...s }),
  token(stream: StringStream, state: BasicState) {
    if (state.asm) {
      if (stream.sol() && !stream.match(/^\s*end\b/i, false)) {
        stream.skipToEnd();
        return "meta";
      }
      if (stream.eatSpace()) return null;
      stream.match(/^end\b/i);
      state.asm = false;
      return "keyword";
    }
    if (stream.sol()) {
      state.statement = true;
      state.label = false;
      // Column 0: a label (or `end`, which closes data and asm blocks).
      const label = stream.match(/^[A-Za-z_][\w.]*/) as RegExpMatchArray | null;
      if (label) {
        const word = label[0].toLowerCase();
        if (word === "end") return "keyword";
        return "labelName";
      }
    }
    if (stream.eatSpace()) return null;

    if (state.statement && stream.match(/^rem\b/i)) {
      stream.skipToEnd();
      return "comment";
    }
    const startOfStatement = state.statement;
    state.statement = false;

    // Sizes and modes such as 32k and 160A.
    if (stream.match(/^\d+[A-Za-z]\w*/)) return "atom";
    if (stream.match(/^\$[0-9A-Fa-f]+/) || stream.match(/^%[01]+/) || stream.match(/^\d+(?:\.\d+)?/)) return "number";

    const quote = stream.peek();
    if (quote === "'" || quote === '"') {
      stream.next();
      while (!stream.eol()) if (stream.next() === quote) break;
      return "string";
    }

    if (stream.eat(":")) {
      state.statement = true;
      state.label = false;
      return "punctuation";
    }
    if (stream.match(/^[()[\]]/)) return "bracket";
    if (stream.match(/^(?:&&|\|\||<=|>=|<>|[-+*/&|^=<>!])/)) return "operator";
    if (stream.eat(",")) return "punctuation";

    const ident = stream.match(/^[A-Za-z_][\w.]*/) as RegExpMatchArray | null;
    if (ident) {
      const word = ident[0].toLowerCase();
      if (KEYWORDS.has(word)) {
        if (JUMPS.has(word)) state.label = true;
        else if (word === "then" || word === "else") state.statement = true;
        else if (word === "asm" && startOfStatement) state.asm = true;
        return "keyword";
      }
      if (state.label) return "labelName";
      if (BUILTINS.has(word) || PALETTE_REGISTER.test(word)) return "builtin";
      return "variableName";
    }
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: "rem" } },
};

/** Lines after a label, or after an indented line, start indented (statements need it). */
export function indentAfter(previousLine: string): number {
  if (!previousLine.trim()) return 1;
  if (/^\S/.test(previousLine)) return 1;
  return /^\s*/.exec(previousLine)![0].length;
}
