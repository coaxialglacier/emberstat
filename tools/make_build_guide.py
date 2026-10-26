"""Writes build/index.html, the Ember build guide (https://emberstat.com/build/):
the 18 steps of building the wall unit, each with a 3D model, labelled
pictures, drawings and checkboxes.

It is a copy of hardware/soldering_guide.html, whose model data is rebuilt
from the CAD model by soldering_guide_model.py in
hardware/cad/wall_case/v6.6/. Run that first after any change to the case,
then this, from the website folder:

    python3 tools/make_build_guide.py

The copy gets the site's icons, a description, and an EMBER link back to the
home page.
"""
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
GUIDE = SITE.parent / 'hardware' / 'soldering_guide.html'
OUT = SITE / 'build' / 'index.html'

HEAD = '''<title>Ember · Build guide</title>
<meta name="description" content="Building the Ember wall unit step by step: what goes into the case in which order, where the hands and tools go, and every solder joint, with a 3D model and pictures for each step.">
<meta name="theme-color" content="#0b0a09">
<meta name="apple-mobile-web-app-title" content="Build guide">
<link rel="icon" href="../favicon.ico" sizes="32x32">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="../apple-touch-icon.png">'''

HOME_CSS = '''.brand .home { font-family: Michroma, var(--font); font-size: 13px; letter-spacing: 0.18em; text-decoration: none;
  color: var(--muted); align-self: center; }
.brand .home:hover { color: var(--text); }
</style>'''

EDITS = (
    ('<title>Ember build guide</title>', HEAD),
    ('</style>\n</head>', HOME_CSS + '\n<link rel="preconnect" href="https://fonts.googleapis.com">\n'
     '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
     '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Michroma&display=swap">\n</head>'),
    ('<div class="brand"><h1>Ember build guide</h1>', '<div class="brand"><a class="home" href="../">EMBER</a><h1>Build guide</h1>'),
)


def main():
    page = GUIDE.read_text()
    assert '<script id="model-data" type="application/json">{' in page, 'the guide has no model data: run soldering_guide_model.py'
    for old, new in EDITS:
        assert page.count(old) == 1, 'the guide has changed: cannot find ' + old[:40]
        page = page.replace(old, new)
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(page)
    print('wrote {} ({} KB)'.format(OUT.relative_to(SITE), OUT.stat().st_size // 1024))


if __name__ == '__main__':
    main()
