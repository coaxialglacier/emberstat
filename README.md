# emberstat

Website for Ember, published with GitHub Pages at https://emberstat.jacklewissimmons.com.

- `index.html`, `style.css`, `opening.js` and `sections.js` are the page.
- `images/` holds the WebP images, made by `tools/make_images.py`.
- `tools/make_wordmark.py` writes the EMBER wordmark into `index.html`.
- `CNAME` holds the custom domain. GitHub Pages reads it; do not delete it.

The tools read renders and CAD drawings from the Ember project folder that
contains this one, so they run only from that checkout.

Pushing to `main` publishes the site. GitHub takes about a minute to rebuild it.
