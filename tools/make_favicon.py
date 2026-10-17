"""Makes the browser tab icon: the front of the case as a square.

An off-white tile with clipped corners, the black frame with a gap in its
top line (where the case has its subtitle), and the orange E of the
wordmark. The E is the Stop typeface outline traced by
hardware/cad/wall_case/v6.2/trace_stop_letters.py (stop_letters.json).

The drawing is laid out on a 32 x 32 grid. The frame line runs from 2 to 4,
so it is exactly 1 pixel wide at 16 x 16 and 2 pixels wide at 32 x 32.

Writes into the website folder:
  favicon.svg
      The icon Chrome, Edge and Firefox use.
  favicon.ico
      16 x 16 and 32 x 32, for browsers without SVG icons and for requests
      to /favicon.ico.
  apple-touch-icon.png
      180 x 180, for a phone's home screen. iOS rounds the corners itself and
      fills see-through pixels with black, so this one is a full off-white
      square with the frame and E inset 4 units on a 40-unit grid.

Run from the website folder:
    python3 tools/make_favicon.py
Needs Pillow.
"""
import json
from math import sqrt
from pathlib import Path

from PIL import Image, ImageDraw

WEBSITE = Path(__file__).resolve().parent.parent
LETTERS = WEBSITE.parent / 'hardware' / 'cad' / 'wall_case' / 'v6.2' / 'stop_letters.json'

# Colours from style.css: --beige, --ink, --ember.
BEIGE = '#d6cdbb'
INK = '#0b0a09'
EMBER = '#b84d0f'

GRID = 32
TILE_CORNER = 5.0          # corner cut of the tile, along each edge
FRAME_OUT = 2.0            # frame line's outer edge, in from the tile edge
FRAME_IN = 4.0             # frame line's inner edge
GAP = (18.0, 24.0)         # x range of the gap in the frame's top line
E_HEIGHT = 16.0            # E is centred in the tile

SUPERSAMPLE = 16           # PNG drawing scale before averaging down


def fmt(v):
    return f'{v:.3f}'.rstrip('0').rstrip('.')


def corner_cut(inset):
    """Corner cut of an octagon inset from the tile, keeping its corner lines
    parallel to the tile's and the same distance in as its straight edges."""
    return TILE_CORNER - inset * (2 - sqrt(2))


def octagon(inset):
    """Clipped-corner square inset from the tile edges, clockwise from the
    left end of its top edge."""
    d, c, w = inset, corner_cut(inset), GRID - inset
    return [(d + c, d), (w - c, d), (w, d + c), (w, w - c),
            (w - c, w), (d + c, w), (d, w - c), (d, d + c)]


def frame():
    """The frame line as one polygon: along the outer edge from the left end
    of the gap, round the frame, back along the inner edge to the start."""
    gl, gr = GAP
    o, i = octagon(FRAME_OUT), octagon(FRAME_IN)
    outer = [(gl, FRAME_OUT), o[0], o[7], o[6], o[5], o[4], o[3], o[2], o[1], (gr, FRAME_OUT)]
    inner = [(gr, FRAME_IN), i[1], i[2], i[3], i[4], i[5], i[6], i[7], i[0], (gl, FRAME_IN)]
    return outer + inner


def letter_e():
    """The traced E, scaled to E_HEIGHT and centred in the tile. The traced
    points have y up; the icon has y down."""
    data = json.loads(LETTERS.read_text())
    outlines = [o['points'] for o in data['letters']['E']['outlines']]
    assert not any(o['hole'] for o in data['letters']['E']['outlines'])
    pts = [p for o in outlines for p in o]
    min_x, max_x = min(p[0] for p in pts), max(p[0] for p in pts)
    min_y, max_y = min(p[1] for p in pts), max(p[1] for p in pts)
    s = E_HEIGHT / (max_y - min_y)
    cx, cy = (min_x + max_x) / 2, (min_y + max_y) / 2
    half = GRID / 2
    return [[(half + (x - cx) * s, half - (y - cy) * s) for x, y in o] for o in outlines]


def shapes(full_tile=False, offset=0.0):
    """(fill, polygon) pairs, drawn in order. full_tile draws a plain square
    tile with no clipped corners; offset moves the frame and E."""
    size = GRID + 2 * offset
    tile = [(0, 0), (size, 0), (size, size), (0, size)] if full_tile else octagon(0)
    art = [(INK, frame())] + [(EMBER, o) for o in letter_e()]
    art = [(fill, [(x + offset, y + offset) for x, y in poly]) for fill, poly in art]
    return [(BEIGE, tile)] + art, size


def svg():
    parts, size = shapes()
    paths = '\n'.join(f'  <path fill="{fill}" d="M' + ' L'.join(f'{fmt(x)} {fmt(y)}' for x, y in poly) + ' Z"/>'
                      for fill, poly in parts)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(size)} {fmt(size)}">\n'
            f'{paths}\n</svg>\n')


def png(pixels, **kwargs):
    """Draws the shapes large and averages them down, which gives smooth
    edges. The average is taken on premultiplied colour so the see-through
    corners do not darken the edge pixels."""
    parts, size = shapes(**kwargs)
    big = pixels * SUPERSAMPLE
    k = big / size
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    for fill, poly in parts:
        draw.polygon([(x * k, y * k) for x, y in poly], fill=fill)
    return img.convert('RGBa').resize((pixels, pixels), Image.BOX).convert('RGBA')


def main():
    (WEBSITE / 'favicon.svg').write_text(svg())

    icon32, icon16 = png(32), png(16)
    icon32.save(WEBSITE / 'favicon.ico', format='ICO', sizes=[(16, 16), (32, 32)], append_images=[icon16])

    png(180, full_tile=True, offset=4.0).convert('RGB').save(WEBSITE / 'apple-touch-icon.png')
    print('favicon.svg, favicon.ico (16, 32) and apple-touch-icon.png (180) written')


if __name__ == '__main__':
    main()
