"""Writes inserts/model.json, the data behind the base insert map
(inserts/index.html): the wall case base's three printed pieces as meshes and
every brass insert's place and direction.

The data comes from the drawing next to the design,
hardware/cad/wall_case/v6.6/base_inserts_diagram.html, whose data block is
rebuilt from the CAD model (and checked against it) by
base_inserts_diagram.py in the same folder. Run that first after any change
to the base, then this, from the website folder:

    python3 tools/make_insert_map.py
"""
import json
import re
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
DRAWING = SITE.parent / 'hardware' / 'cad' / 'wall_case' / 'v6.6' / 'base_inserts_diagram.html'
OUT = SITE / 'inserts' / 'model.json'


def main():
    page = DRAWING.read_text()
    found = re.search(r'<script id="model-data" type="application/json">(.*?)</script>', page, re.S)
    data = json.loads(found.group(1))
    assert data.get('inserts'), 'the drawing has no inserts in its data block: run base_inserts_diagram.py'
    OUT.write_text(json.dumps(data, separators=(',', ':')))
    print('{} inserts, {} pieces; wrote {} ({} KB)'.format(
        len(data['inserts']), len(data['pieces']), OUT.relative_to(SITE), OUT.stat().st_size // 1024))


if __name__ == '__main__':
    main()
