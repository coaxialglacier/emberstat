"""Makes the WebP images for the website from the renders and CAD drawings.

The sources stay where they are: the renders in Ember/renders/ (git-ignored)
and the line drawings next to the CAD scripts in hardware/cad/.

Writes into images/:
  room-01-2400.webp, room-01-phone.webp
      The opening view. room-01-phone is a crop round the unit for phones in
      portrait: 1500 x 1600 from the 2400 x 1600 original, centred on the
      unit (x = 564 to 1860 px, read from the render by eye), saved at
      1200 x 1280.
  r-<name>-1600.webp, r-<name>-800.webp
      Gallery renders at two widths.
  p-<name>-1600.webp, p-<name>-800.webp
      The case rendered into Jack's photos of the thermostat's wall.
  d-<name>.webp
      CAD line drawings as light lines on a transparent background, cropped
      to the drawing. The lines are the case's off-white (#d6cdbb).

Run from the website folder:
    python3 tools/make_images.py
Needs cwebp (Homebrew: brew install webp), Pillow and NumPy.
"""
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

WEBSITE = Path(__file__).resolve().parent.parent
EMBER = WEBSITE.parent
RENDERS = EMBER / 'renders'
CAD = EMBER / 'hardware' / 'cad'
OUT = WEBSITE / 'images'

QUALITY = 80
PHONE_CROP = (462, 0, 1500, 1600)   # x, y, width, height in the original
PHONE_WIDTH = 1200

GALLERY = {
    '02-front': '02_front.png',
    '03-left-low': '03_three_quarter_left_low.png',
    '04-side-right': '04_side_right.png',
    '05-top-port': '05_top_port_close.png',
    '07-bottom-port': '07_bottom_port_close.png',
    '08-cover-off': '08_battery_cover_off.png',
    '09-cells': '09_batteries_close.png',
}
PHOTOS = {
    '0201': 'room_IMG_0201.png',
    '0203': 'room_IMG_0203.png',
}
# Some versions' three-quarter previews show only the tag text, so those
# use the view from below.
DRAWINGS = {
    'inside-front': 'wall_case/v6.6/preview_internals_front.svg.png',
    'drive-v6': 'capstan_drive/v6/preview_assembly_front.svg.png',
    'v1': 'wall_case/v1/preview_three_quarter.svg.png',
    'v2': 'wall_case/v2/preview_three_quarter.svg.png',
    'v3': 'wall_case/v3/preview_three_quarter.svg.png',
    'v4': 'wall_case/v4/preview_three_quarter.svg.png',
    'v5': 'wall_case/v5/preview_from_below.svg.png',
    'v6': 'wall_case/v6/preview_from_below.svg.png',
    'v7': 'wall_case/v7/preview_from_below.svg.png',
    'v6.2': 'wall_case/v6.2/preview_from_below.svg.png',
    'v6.5': 'wall_case/v6.5/preview_three_quarter.svg.png',
    'v6.6': 'wall_case/v6.6/preview_front.svg.png',
    'bay': 'wall_case/v6.6/preview_battery_bay.svg.png',
    'bay-end': 'wall_case/v6.6/preview_bay_top_end.svg.png',
    'side-v6.5': 'wall_case/v6.5/preview_side.svg.png',
}
# The inside drawing keeps a fixed crop, because the page places numbered
# markers on it in this crop's coordinates (see index.html, #inside).
FIXED_CROP = {'inside-front': (40, 170, 1360, 1230)}
LINE_COLOUR = (214, 205, 187)
DRAWING_PAD = 24


def cwebp(*args):
    subprocess.run(['cwebp', '-quiet', '-q', str(QUALITY), '-m', '6', *args], check=True)


def opening():
    src = RENDERS / '01_three_quarter_right.png'
    cwebp(str(src), '-o', str(OUT / 'room-01-2400.webp'))
    x, y, w, h = PHONE_CROP
    cwebp('-crop', str(x), str(y), str(w), str(h), '-resize', str(PHONE_WIDTH), '0',
          str(src), '-o', str(OUT / 'room-01-phone.webp'))


def two_widths(prefix, name, src):
    for width in (1600, 800):
        cwebp('-resize', str(width), '0', str(src), '-o', str(OUT / f'{prefix}-{name}-{width}.webp'))


def drawing(name, src):
    """Black lines on white become light lines on transparent."""
    im = Image.open(src).convert('RGBA')
    white = Image.new('RGBA', im.size, (255, 255, 255, 255))
    white.alpha_composite(im)
    grey = np.asarray(white.convert('L')).astype(float) / 255
    alpha = np.clip((1 - grey) * 1.3, 0, 1)
    if name in FIXED_CROP:
        x0, y0, x1, y1 = FIXED_CROP[name]
    else:
        ys, xs = np.nonzero(alpha > 0.05)
        x0, x1 = max(xs.min() - DRAWING_PAD, 0), min(xs.max() + DRAWING_PAD, im.width)
        y0, y1 = max(ys.min() - DRAWING_PAD, 0), min(ys.max() + DRAWING_PAD, im.height)
    rgba = np.zeros((*grey.shape, 4), dtype=np.uint8)
    rgba[..., :3] = LINE_COLOUR
    rgba[..., 3] = (alpha * 255).round().astype(np.uint8)
    out = Image.fromarray(rgba[y0:y1, x0:x1], 'RGBA')
    out.save(OUT / f'd-{name}.webp', quality=88, method=6)
    return out.size


def main():
    OUT.mkdir(exist_ok=True)
    opening()
    for name, file in GALLERY.items():
        two_widths('r', name, RENDERS / file)
    for name, file in PHOTOS.items():
        two_widths('p', name, RENDERS / file)
    for name, file in DRAWINGS.items():
        print(f'd-{name}.webp', *drawing(name, CAD / file))
    total = sum(f.stat().st_size for f in OUT.glob('*.webp'))
    print(len(list(OUT.glob('*.webp'))), 'files,', total // 1024, 'KB')


if __name__ == '__main__':
    main()
