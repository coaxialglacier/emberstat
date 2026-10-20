# emberstat

Website for Ember, published with GitHub Pages at https://emberstat.com.

- `index.html`, `style.css`, `opening.js` and `sections.js` are the page.
- `images/` holds the WebP images, made by `tools/make_images.py`.
- `tools/make_wordmark.py` writes the EMBER wordmark into `index.html`.
- `favicon.svg`, `favicon.ico` and `apple-touch-icon.png` are the tab and
  home-screen icons, made by `tools/make_favicon.py`.
- `inserts/` is the base insert map (https://emberstat.com/inserts/): where
  each brass insert goes in the wall case base, step by step, made for a
  phone. `inserts/model.json` holds the pieces and the inserts, written by
  `tools/make_insert_map.py` from the drawing in
  `hardware/cad/wall_case/v6.6/` (rebuild that first with its
  `base_inserts_diagram.py`).
- `CNAME` holds the custom domain. GitHub Pages reads it; do not delete it.

The tools read renders and CAD drawings from the Ember project folder that
contains this one, so they run only from that checkout.

Pushing to `main` publishes the site. GitHub takes about a minute to rebuild it.
