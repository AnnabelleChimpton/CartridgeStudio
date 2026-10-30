"""Redraws Atkinson Hyperlegible's zero without the slash, so "7800" reads as 7800.

The new zero is the O, narrowed to the zero's own ink width. The zero keeps its
advance and sidebearings, so text set in the font doesn't move. Tabular zeros
built from the zero follow it. Run once from the repo root:

    python3 app/scripts/make-plain-zero.py

Needs fontTools (pip install fonttools).
"""

import copy
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import GlyphCoordinates

FONTS = Path(__file__).resolve().parent.parent / "public" / "fonts"
FILES = ["atkinson-hyperlegible-regular.ttf", "atkinson-hyperlegible-bold.ttf"]


def redraw(font: TTFont, name: str, source: str = "O") -> bool:
    glyf = font["glyf"]
    zero = glyf[name]
    if zero.isComposite():
        # Built from another glyph (zero.tf is the zero, spaced): it follows that glyph.
        return False
    zero.recalcBounds(glyf)
    o = copy.deepcopy(glyf[source])
    o.recalcBounds(glyf)
    sx = (zero.xMax - zero.xMin) / (o.xMax - o.xMin)
    o.coordinates = GlyphCoordinates([(round(zero.xMin + (x - o.xMin) * sx), y) for x, y in o.coordinates])
    # The O's hinting was written for the O's stems.
    o.program = copy.deepcopy(o.program)
    o.program.fromBytecode(b"")
    o.recalcBounds(glyf)
    glyf[name] = o
    advance, _ = font["hmtx"][name]
    font["hmtx"][name] = (advance, o.xMin)
    return True


def main() -> None:
    for file in FILES:
        path = FONTS / file
        font = TTFont(path)
        done = [n for n in ("zero", "zero.tf") if n in font.getGlyphOrder() and redraw(font, n)]
        font.save(path)
        print(f"{file}: redrew {', '.join(done) or 'nothing'}")


if __name__ == "__main__":
    main()
