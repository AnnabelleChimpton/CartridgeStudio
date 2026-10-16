// The kit's character set: a 3×5 font in 4×8 cells (160A characters), plus
// the wall, hazard and goal tiles. One graphic serves text, the score digits
// and the room's tiles.

const GLYPHS: Record<string, string> = {
  "0": "111101101101111", "1": "010110010010111", "2": "111001111100111", "3": "111001111001111",
  "4": "101101111001001", "5": "111100111001111", "6": "111100111101111", "7": "111001010010010",
  "8": "111101111101111", "9": "111101111001111",
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110",
  E: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101",
  I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
  M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100",
  Q: "010101101110011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
  U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101",
  Y: "101101010010010", Z: "111001010100111",
  ".": "000000000000010", "!": "010010010000010", "?": "110001010000010", "-": "000000111000000",
  ":": "000010000010000",
};

/** A textured wall block in colors 1 and 2. */
const WALL = ["1111", "1112", "1112", "2222", "1111", "2111", "2111", "2222"];
/** Hazard tile (`~`): spikes in color 3. */
const HAZARD = ["0000", "0300", "0300", "3330", "0000", "0003", "0003", "3033"];
/** Goal tile (`*`): a dotted square in color 2. */
const GOAL = ["2020", "0000", "2000", "0000", "2000", "0000", "2000", "0000"];
/** Room tiles by map character, 4 pixels × 8 lines each, colors 1-3 of the wall palette. */
export const TILE_GLYPHS: Record<string, string[]> = { "#": WALL, "~": HAZARD, "*": GOAL };

/** The font graphic's 8 rows for `chars`, one 4-pixel-wide cell per character. */
export function fontRows(chars: string): string[] {
  const rows = Array.from({ length: 8 }, () => "");
  for (const ch of chars) {
    for (let r = 0; r < 8; r++) {
      if (TILE_GLYPHS[ch]) rows[r] += TILE_GLYPHS[ch]![r]!;
      else {
        const g = GLYPHS[ch];
        // Glyph rows 1-5 of the cell; 0, 6 and 7 are spacing.
        rows[r] += (g && r >= 1 && r <= 5 ? g.slice((r - 1) * 3, r * 3) : "000") + "0";
      }
    }
  }
  return rows;
}
