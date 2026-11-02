"""Copy the rupee sign (U+20B9) from a Hind Devanagari subset into the Latin
subset of the same weight.

Google Fonts puts the rupee sign in Hind's Devanagari subset (~36-38 KB a
weight), so an English page showing a fine in rupees downloaded the whole
Devanagari subset for that one glyph. The glyph is a single unhinted outline
with no kerning or substitutions, and both subsets share their metrics (1000
units per em, the same ascent and descent), so it is copied as it is: appended
after the Latin glyphs, whose ids, outlines and layout tables stay unchanged.

The site's Latin files (public/fonts/hind/hind-<weight>-latin-rupee.woff2)
were made from the Google Fonts v18 Latin subsets, which are in git history
as public/fonts/hind/hind-<weight>-latin.woff2:

    git show 3e3231b:public/fonts/hind/hind-400-latin.woff2 > latin-400.woff2
    python3 scripts/add-rupee-to-latin-font.py latin-400.woff2 \\
      public/fonts/hind/hind-400-devanagari.woff2 \\
      public/fonts/hind/hind-400-latin-rupee.woff2

Needs fontTools with Brotli: `pip install fonttools brotli`. It refuses a
Latin file that already has the glyph.
"""

import sys

from fontTools.ttLib import TTFont

RUPEE = 0x20B9


def add_rupee(latin_path: str, devanagari_path: str, out_path: str) -> None:
    # Keep the file's own header values: Google's subsets carry the whole
    # family's bounding box, which already encloses the rupee sign.
    latin = TTFont(latin_path, recalcBBoxes=False, recalcTimestamp=False)
    source = TTFont(devanagari_path)

    name = source.getBestCmap()[RUPEE]
    if name in latin.getGlyphOrder():
        raise SystemExit(f"{latin_path} already has a glyph named {name}")
    glyph = source["glyf"][name]
    if glyph.isComposite():
        raise SystemExit(f"{name} is a composite glyph; copy its components too")

    # Append, so every existing glyph keeps its id (GSUB, GPOS and GDEF refer
    # to glyphs by id).
    latin.setGlyphOrder(latin.getGlyphOrder() + [name])
    latin["glyf"][name] = glyph
    latin["hmtx"][name] = source["hmtx"][name]
    for table in latin["cmap"].tables:
        if table.isUnicode():
            table.cmap[RUPEE] = name
    class_def = latin["GDEF"].table.GlyphClassDef
    if class_def is not None:
        class_def.classDefs[name] = 1  # a base glyph, as in the source

    latin.flavor = "woff2"
    latin.save(out_path)


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    add_rupee(*sys.argv[1:])
