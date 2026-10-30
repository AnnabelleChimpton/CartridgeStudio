# Fonts for the print PDF

Embedded (subset) in the box, label and manual PDF. Atkinson Hyperlegible is
licensed under the SIL Open Font License 1.1, which allows embedding. Titles
are drawn in the kit's own 3×5 font as vector shapes, so they need no file.

| File | Font | License |
| --- | --- | --- |
| `atkinson-hyperlegible-regular.ttf`, `-bold.ttf` | Atkinson Hyperlegible (text) | `atkinson-hyperlegible-OFL.txt` |

Copied from the `@expo-google-fonts/atkinson-hyperlegible` 0.4.1 package (Google Fonts
releases), with one change: zero redrawn without the slash, from O
(`app/scripts/make-plain-zero.py`), so "7800" doesn't read as "78ØØ". The OFL
names no Reserved Font Name for this family, so the name is unchanged.
TrueType rather than WOFF2: pdf-lib can only subset and embed TrueType/OpenType
outlines.
