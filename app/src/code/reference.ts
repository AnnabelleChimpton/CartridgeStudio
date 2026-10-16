// A quick 7800basic reference: the commands the kit runtime and the classic
// shooter use, plus the common ones a game needs early. The summaries are
// ours; the official guide has the full story.

export const GUIDE_URL = "https://www.randomterrain.com/7800basic.html";
export const REPO_URL = "https://github.com/7800-devtools/7800basic";

export interface RefEntry {
  name: string;
  /** How it's written, with placeholders in angle brackets. */
  syntax: string;
  summary: string;
  topic: (typeof TOPICS)[number];
  /** A line to insert into game.bas (defaults to the syntax). */
  example?: string;
}

export const TOPICS = ["Program", "Variables", "Flow", "Graphics", "Drawing", "Input", "Sound", "Maths"] as const;

export const REFERENCE: RefEntry[] = [
  // Program
  { topic: "Program", name: "rem", syntax: "rem <anything>", summary: "A comment: the rest of the line is ignored. Works wherever a statement can start.", example: " rem " },
  { topic: "Program", name: "labels", syntax: "<name>", summary: "A word at the very start of a line names that spot for goto and gosub. Statements must be indented by at least one space.", example: "mylabel" },
  { topic: "Program", name: ":", syntax: "<statement> : <statement>", summary: "Puts several statements on one line." },
  { topic: "Program", name: "set romsize", syntax: "set romsize <size>", summary: "Chooses the cartridge size, such as 32k, 48k or 128k (bank-switched sizes need bank statements).", example: " set romsize 32k" },
  { topic: "Program", name: "set zoneheight", syntax: "set zoneheight <8|16>", summary: "How tall each display zone is. Sprites can cross zones; characters and maps line up with them.", example: " set zoneheight 16" },
  { topic: "Program", name: "set screenheight", syntax: "set screenheight <192|208|224>", summary: "How many visible lines the game uses.", example: " set screenheight 192" },
  { topic: "Program", name: "displaymode", syntax: "displaymode <160A|160B|320A|…>", summary: "The graphics mode. 160A gives wide pixels with three colors plus transparent per palette, which is what Cartridge Studio draws.", example: " displaymode 160A" },
  { topic: "Program", name: "asm … end", syntax: "asm\n <6502 assembly>\nend", summary: "Drops into assembly for speed. Indent the lines; end goes on its own line.", example: " asm\n nop\nend" },
  { topic: "Program", name: "include", syntax: "include <file>", summary: "Pulls in an assembly helper file from 7800basic's includes." },
  { topic: "Program", name: "bank", syntax: "bank <n>", summary: "Starts the code for bank n in bank-switched ROMs." },

  // Variables
  { topic: "Variables", name: "dim", syntax: "dim <name> = <location>", summary: "Gives a memory location a name, such as dim lives = var0. Arrays can live at a fixed address like $2200.", example: " dim myvar = var10" },
  { topic: "Variables", name: "autodim", syntax: "autodim byte <name>", summary: "Names a variable and lets 7800basic pick a free byte for it (after autodim init sets the range to use).", example: " autodim byte myvar" },
  { topic: "Variables", name: "const", syntax: "const <NAME> = <value>", summary: "A named number, replaced at compile time. Costs no memory.", example: " const SPEED = 2" },
  { topic: "Variables", name: "var0-var99", syntax: "var0 … var99", summary: "The 100 general-purpose bytes of memory." },
  { topic: "Variables", name: "temp1-temp9", syntax: "temp1 … temp9", summary: "Scratch bytes. Some commands use them too, so don't keep values in them across statements." },
  { topic: "Variables", name: "score0", syntax: "score0 = score0 + <bcd>", summary: "The player's score, kept in BCD (each digit in 4 bits). Add amounts like $000010 or plain numbers." },
  { topic: "Variables", name: "data", syntax: "data <name>\n <values>\nend", summary: "A table of bytes in ROM, read with name[index]. end goes at the start of its own line.", example: " data mytable\n 1, 2, 3\nend" },
  { topic: "Variables", name: "alphadata", syntax: "alphadata <name> <charset>\n '<text>'\nend", summary: "Text or a tile map stored as characters of a character set, for plotchars and plotmap." },

  // Flow
  { topic: "Flow", name: "if … then", syntax: "if <condition> then <statements>", summary: "Runs the rest of the line when the condition holds. Combine conditions with && and ||, negate with !.", example: " if x > 10 then x = 0" },
  { topic: "Flow", name: "else", syntax: "if <c> then <a> else <b>", summary: "What to do when the condition doesn't hold." },
  { topic: "Flow", name: "goto", syntax: "goto <label>", summary: "Jumps to a label.", example: " goto main" },
  { topic: "Flow", name: "gosub … return", syntax: "gosub <label>", summary: "Runs a subroutine and comes back after it reaches return.", example: " gosub mysub" },
  { topic: "Flow", name: "on … goto", syntax: "on <value> goto <label0> <label1> …", summary: "Jumps to the label picked by a value (0 is the first). on … gosub works the same way.", example: " on state goto st0 st1" },
  { topic: "Flow", name: "for … next", syntax: "for <var> = <a> to <b> [step <n>]\n …\n next", summary: "Repeats the lines up to next for each value from a to b.", example: " for i = 0 to 7\n next" },
  { topic: "Flow", name: "drawscreen", syntax: "drawscreen", summary: "Waits for the frame to finish and shows what was plotted. Every game loop calls it once a frame.", example: " drawscreen" },
  { topic: "Flow", name: "reboot", syntax: "reboot", summary: "Restarts the game from the beginning." },

  // Graphics
  { topic: "Graphics", name: "incgraphic", syntax: "incgraphic <file.png> [mode] [color indexes]", summary: "Imports a PNG as a graphic named after the file. Graphics added in the Assets tab get this line for you.", example: " incgraphic mysprite.png 160A 0 1 2 3" },
  { topic: "Graphics", name: "newblock", syntax: "newblock", summary: "Starts a new graphics block when the current one is full." },
  { topic: "Graphics", name: "characterset", syntax: "characterset <graphic>", summary: "Picks the graphic used as the character set for plotchars, plotmap and plotvalue.", example: " characterset font" },
  { topic: "Graphics", name: "alphachars", syntax: "alphachars '<characters>'", summary: "Says which character each cell of the character set draws, in order." },
  { topic: "Graphics", name: "PxCy", syntax: "P<0-7>C<1-3> = <color>", summary: "Palette registers: palette 0-7, colors 1-3. Values are console colors like $1C (hue in the high digit, brightness in the low).", example: " P0C1 = $0F : P0C2 = $86 : P0C3 = $46" },
  { topic: "Graphics", name: "BACKGRND", syntax: "BACKGRND = <color>", summary: "The background color.", example: " BACKGRND = $00" },

  // Drawing
  { topic: "Drawing", name: "clearscreen", syntax: "clearscreen", summary: "Empties the display lists so this frame starts blank.", example: " clearscreen" },
  { topic: "Drawing", name: "savescreen / restorescreen", syntax: "savescreen … restorescreen", summary: "Draw the background once and savescreen it; each frame, restorescreen brings it back, faster than drawing it again." },
  { topic: "Drawing", name: "plotsprite", syntax: "plotsprite <graphic> <palette> <x> <y> [frame]", summary: "Draws a graphic at x, y in a palette. The optional frame picks the n-th graphic imported after it, for animation.", example: " plotsprite mysprite 0 x y" },
  { topic: "Drawing", name: "plotsprite4", syntax: "plotsprite4 <graphic> <palette> <x> <y> [frame]", summary: "Like plotsprite but with smaller display objects: a little quicker, and more of them fit on a line. Mixing graphics modes can upset it." },
  { topic: "Drawing", name: "plotchars", syntax: "plotchars '<text>' <palette> <x> <y>", summary: "Draws text (or a data label) with the current character set at screen position x, y.", example: " plotchars 'HELLO' 0 8 5" },
  { topic: "Drawing", name: "plotvalue", syntax: "plotvalue <charset> <palette> <variable> <digits> <x> <y>", summary: "Draws a number, such as the score, using the digits of a character set.", example: " plotvalue font 0 score0 6 60 1" },
  { topic: "Drawing", name: "plotmap", syntax: "plotmap <map> <palette> <x> <y> <width> <height> …", summary: "Draws part of a character map (from alphadata) as the background." },
  { topic: "Drawing", name: "boxcollision", syntax: "boxcollision(<x1>, <y1>, <w1>, <h1>, <x2>, <y2>, <w2>, <h2>)", summary: "True when two rectangles overlap: the usual way to check if two things touch.", example: " if boxcollision(x1, y1, 8, 8, x2, y2, 8, 8) then gosub hit" },

  // Input
  { topic: "Input", name: "joy0up/down/left/right", syntax: "if joy0left then …", summary: "True while the first joystick is pushed that way (joy1… for the second)." },
  { topic: "Input", name: "joy0fire", syntax: "if joy0fire then …", summary: "True while the fire button is held. Track the previous state to react to a press only once." },
  { topic: "Input", name: "switchreset / switchselect", syntax: "if switchreset then …", summary: "The console's Reset and Select switches." },

  // Sound
  { topic: "Sound", name: "playsfx", syntax: "playsfx <sound> [offset]", summary: "Plays a sound effect defined as data on the TIA chip. The optional offset shifts its pitch.", example: " playsfx sfx_jump" },
  { topic: "Sound", name: "tsound", syntax: "tsound <channel>, [frequency], [waveform], [volume]", summary: "Sets TIA sound channel 0 or 1 directly, for simple tones. Leave out a value to keep it as it is." },

  // Maths
  { topic: "Maths", name: "rand", syntax: "x = rand", summary: "A random byte, 0-255. Use & to narrow it, such as rand & 7 for 0-7.", example: " x = rand & 15" },
  { topic: "Maths", name: "frame", syntax: "frame", summary: "Counts up by one each frame, wrapping at 255: handy for timing and animation." },
  { topic: "Maths", name: "operators", syntax: "+ - * / & | ^", summary: "Byte maths: add, subtract, multiply, divide, and, or, exclusive or. Results wrap at 256; multiply and divide by powers of two are fastest." },
  { topic: "Maths", name: "comparisons", syntax: "= <> < > <= >=", summary: "Comparisons for if. <> means not equal." },
];

export function searchReference(query: string): RefEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return REFERENCE;
  const words = q.split(/\s+/);
  return REFERENCE.filter((e) => {
    const text = `${e.name} ${e.syntax} ${e.summary} ${e.topic}`.toLowerCase();
    return words.every((w) => text.includes(w));
  }).sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)));
}
