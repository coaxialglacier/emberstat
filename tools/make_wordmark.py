"""Writes the EMBER wordmark into index.html as an inline SVG.

The letters are the Stop typeface outlines traced by
hardware/cad/wall_case/v6.2/trace_stop_letters.py (stop_letters.json).
The spacing, frame and subtitle break use the same numbers as the case
(hardware/cad/wall_case/v6.6/wall_case_v6.6.py, wordmark_letters() and
wordmark_frame()), so the website wordmark has the case's proportions.

SVG units are millimetres on the case. The y axis is flipped: the traced
letters have y up, SVG has y down.

The SVG replaces everything between <!-- wordmark:start --> and
<!-- wordmark:end --> in index.html. Run from the website folder:
    python3 tools/make_wordmark.py
"""
import json
import re
from math import sqrt
from pathlib import Path

WEBSITE = Path(__file__).resolve().parent.parent
LETTERS = WEBSITE.parent / 'hardware' / 'cad' / 'wall_case' / 'v6.2' / 'stop_letters.json'
INDEX = WEBSITE / 'index.html'

# Same values as wall_case_v6.6.py.
WORDMARK_H = 13.0
WORDMARK_GAP = 1.55
FRAME_LINE = 0.8
FRAME_PAD = (2.5, 2.2)
FRAME_CORNER = 2.0
SUBTITLE_INSET = 5.0
SUBTITLE_SPACE = 1.2
SUBTITLE = 'ENVIRONMENTAL CONTROL UNIT'

# The website sets the subtitle in Michroma, not the case's DIN Alternate
# Bold. SUB_WIDTH is the subtitle's length in the frame break (the case's
# is 34.3); SUB_SIZE is the font size. Measured in the browser: the
# subtitle in Michroma is 23.5 times the font size long, and Michroma
# capitals are 0.75 of the font size tall.
SUB_WIDTH = 36.0
SUB_SIZE = 1.5
SUB_CAP = 0.75


def fmt(v):
    return f'{v:.3f}'.rstrip('0').rstrip('.')


def main():
    data = json.loads(LETTERS.read_text())
    assert abs(data['height'] - WORDMARK_H) < 1e-6

    # Lay the letters out left to right, as wordmark_letters() does.
    letters, x = [], 0.0
    for ch in 'EMBER':
        letter = data['letters'][ch]
        assert not any(o['hole'] for o in letter['outlines'])
        letters.append([[(px + x, py) for px, py in o['points']] for o in letter['outlines']])
        x += letter['width'] + WORDMARK_GAP - 2 * data['thin']
    pts = [p for letter in letters for outline in letter for p in outline]
    min_x, max_x = min(p[0] for p in pts), max(p[0] for p in pts)
    min_y = min(p[1] for p in pts)

    # Frame outer edge, with its bottom-left corner at (0, 0).
    pad_x, pad_y = FRAME_PAD
    dx = FRAME_LINE + pad_x - min_x
    dy = FRAME_LINE + pad_y - min_y
    x0, y0 = 0.0, 0.0
    x1 = max_x + dx + pad_x + FRAME_LINE
    y1 = WORDMARK_H + FRAME_LINE + pad_y + pad_y + FRAME_LINE

    def sx(v):
        return fmt(v)

    def sy(v):
        return fmt(y1 - v)   # flip y

    letter_paths = []
    for i, letter in enumerate(letters):
        d = ' '.join('M' + ' L'.join(f'{sx(px + dx)} {sy(py + dy)}' for px, py in outline) + ' Z'
                     for outline in letter)
        letter_paths.append(f'<path class="wm-letter" style="--i:{i}" d="{d}"/>')

    # Frame drawn as a stroke along the centre of its line. The corner cut on
    # the centre line keeps the 45-degree corners the case has.
    h = FRAME_LINE / 2
    a, b, c, t = x0 + h, x1 - h, y0 + h, y1 - h
    k = FRAME_CORNER - h * (2 - sqrt(2))
    sub_right = x1 - SUBTITLE_INSET
    sub_left = sub_right - SUB_WIDTH
    gap_r, gap_l = sub_right + SUBTITLE_SPACE, sub_left - SUBTITLE_SPACE
    frame = [(gap_r, t), (b - k, t), (b, t - k), (b, c + k), (b - k, c),
             (a + k, c), (a, c + k), (a, t - k), (a + k, t), (gap_l, t)]
    frame_d = 'M' + ' L'.join(f'{sx(px)} {sy(py)}' for px, py in frame)

    # Subtitle capitals centred on the top line.
    baseline = h + SUB_CAP * SUB_SIZE / 2

    svg = f'''<svg class="wordmark" viewBox="0 0 {fmt(x1)} {fmt(y1)}" role="img" aria-labelledby="wm-title">
            <title id="wm-title">EMBER, Environmental Control Unit</title>
            <path class="wm-frame" pathLength="1" d="{frame_d}"/>
            <text class="wm-sub" x="{fmt(sub_left)}" y="{fmt(baseline)}" textLength="{fmt(SUB_WIDTH)}" lengthAdjust="spacing" font-size="{fmt(SUB_SIZE)}">{SUBTITLE}</text>
            <g class="wm-letters">
              {(chr(10) + '              ').join(letter_paths)}
            </g>
          </svg>'''

    html = INDEX.read_text()
    new, n = re.subn(r'(<!-- wordmark:start -->).*?(<!-- wordmark:end -->)',
                     lambda m: f'{m.group(1)}\n          {svg}\n          {m.group(2)}', html, flags=re.S)
    assert n == 1, 'wordmark markers not found in index.html'
    INDEX.write_text(new)
    print(f'wordmark {fmt(x1)} x {fmt(y1)} mm written to {INDEX.name}')


if __name__ == '__main__':
    main()
