// The sections below the opening view: the section index, appear-on-scroll,
// enlarged pictures, the spread borders, the labelled readouts, the fitted
// headlines, the cord drive model and the battery life chart.
(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Section index: shown once the opening view is scrolled past ----------
  const index = document.querySelector('.index');
  const opening = document.querySelector('.opening');
  new IntersectionObserver(([entry]) => {
    index.classList.toggle('is-shown', !entry.isIntersecting);
  }, { threshold: 0.12 }).observe(opening);

  const links = new Map([...index.querySelectorAll('ol a')].map((a) => [a.hash.slice(1), a]));
  const sectionWatch = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      links.forEach((a) => a.classList.remove('is-current'));
      links.get(entry.target.id)?.classList.add('is-current');
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('.section').forEach((s) => sectionWatch.observe(s));

  // ---------- Appear on scroll ----------
  const revealWatch = new IntersectionObserver((entries, watch) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      watch.unobserve(entry.target);
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.reveal').forEach((el) => revealWatch.observe(el));

  // ---------- Enlarged pictures ----------
  const box = document.querySelector('.lightbox');
  const boxImg = box.querySelector('img');
  document.querySelectorAll('.frame__open').forEach((button) => {
    button.addEventListener('click', () => {
      boxImg.src = button.dataset.full;
      boxImg.alt = button.querySelector('img').alt;
      box.showModal();
    });
  });
  // A click on the dark area round the picture closes it.
  box.addEventListener('click', (event) => { if (event.target === box) box.close(); });

  // ---------- Spread borders ----------
  // The wordmark's line round each spread: 45-degree corners, and a break in
  // the top edge round every .fr__label (the EMBER plate, the section code).
  // Line width and corner cut come from the CSS variables --line and --cut.
  const ns = 'http://www.w3.org/2000/svg';

  function drawFrame(fr) {
    const w = fr.clientWidth;
    const h = fr.clientHeight;
    if (!w || !h) return;
    const style = getComputedStyle(fr);
    const line = parseFloat(style.getPropertyValue('--line')) || 1.5;
    const cut = parseFloat(style.getPropertyValue('--cut')) || 18;
    let svg = fr.querySelector(':scope > .fr__line');
    if (!svg) {
      svg = document.createElementNS(ns, 'svg');
      svg.classList.add('fr__line');
      svg.append(document.createElementNS(ns, 'path'));
      fr.prepend(svg);
    }
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    // The corner cut on the line's centre keeps the line the same width round each corner.
    const half = line / 2;
    const k = cut - half * (2 - Math.SQRT2);
    const [a, b, c, d] = [half, w - half, half, h - half];
    const box = fr.getBoundingClientRect();
    const gaps = [...fr.querySelectorAll(':scope > .fr__label')]
      .map((label) => { const r = label.getBoundingClientRect(); return [r.left - box.left - 10, r.right - box.left + 10]; })
      .sort((p, q) => p[0] - q[0]);
    const tops = [];
    let x = a + k;
    for (const [g0, g1] of gaps) {
      if (g0 > x) tops.push([x, g0]);
      x = Math.max(x, g1);
    }
    const f = (v) => v.toFixed(1);
    let path = `M${f(x)} ${f(c)} L${f(b - k)} ${f(c)} L${f(b)} ${f(c + k)} L${f(b)} ${f(d - k)} L${f(b - k)} ${f(d)} L${f(a + k)} ${f(d)} L${f(a)} ${f(d - k)} L${f(a)} ${f(c + k)} L${f(a + k)} ${f(c)}`;
    tops.forEach(([s0, s1], i) => {
      path += i === 0 && s0 <= a + k + 0.5 ? ` L${f(s1)} ${f(c)}` : ` M${f(s0)} ${f(c)} L${f(s1)} ${f(c)}`;
    });
    if (!gaps.length) path += ' Z';
    svg.firstChild.setAttribute('d', path);
  }

  // ---------- Readouts: parts labelled with lines at right angles ----------
  // Each label sits level with its part where it can, pushed down when two
  // would overlap; the line runs from a dot on the part to the label. On
  // narrow screens the CSS hides the lines and shows numbered marks instead.
  function layoutReadout(r) {
    const fig = r.querySelector('.readout__fig');
    const img = fig.querySelector('img');
    const items = [...r.querySelectorAll('.readout__col li')];
    if (!r.dataset.marked) {
      items.forEach((li, i) => {
        const mark = document.createElement('span');
        mark.className = 'readout__mark';
        mark.textContent = i + 1;
        mark.setAttribute('aria-hidden', 'true');
        mark.style.setProperty('--x', `${li.dataset.x}%`);
        mark.style.setProperty('--y', `${li.dataset.y}%`);
        fig.append(mark);
      });
      r.dataset.marked = '1';
    }
    let svg = r.querySelector(':scope > .readout__lines');
    if (!svg) {
      svg = document.createElementNS(ns, 'svg');
      svg.classList.add('readout__lines');
      svg.setAttribute('aria-hidden', 'true');
      r.append(svg);
    }
    svg.replaceChildren();
    items.forEach((li) => { li.style.top = ''; });
    r.querySelectorAll('.readout__col').forEach((col) => { col.style.minHeight = ''; });
    if (getComputedStyle(svg).display === 'none') return;

    const rb = r.getBoundingClientRect();
    const fb = img.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${rb.width} ${rb.height}`);
    const ANCHOR = 8;                 // half the height of a label's first line
    for (const col of r.querySelectorAll('.readout__col')) {
      const left = col.classList.contains('readout__col--l');
      const cb = col.getBoundingClientRect();
      const colTop = cb.top - rb.top;
      const edge = left ? cb.right - rb.left + 8 : cb.left - rb.left - 8;
      const jog = left ? edge + 16 : edge - 16;
      const list = [...col.children].map((li) => ({
        li,
        px: fb.left - rb.left + (li.dataset.x / 100) * fb.width,
        py: fb.top - rb.top + (li.dataset.y / 100) * fb.height,
      })).sort((p, q) => p.py - q.py);
      let floor = -Infinity;
      for (const it of list) {
        const top = Math.max(it.py - ANCHOR, floor);
        it.li.style.top = `${top - colTop}px`;
        floor = top + it.li.offsetHeight + 12;
        const ly = top + ANCHOR;
        const pts = Math.abs(ly - it.py) < 1
          ? [[it.px, it.py], [edge, it.py]]
          : [[it.px, it.py], [jog, it.py], [jog, ly], [edge, ly]];
        const lineEl = document.createElementNS(ns, 'polyline');
        lineEl.setAttribute('points', pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' '));
        const dot = document.createElementNS(ns, 'circle');
        dot.setAttribute('cx', it.px.toFixed(1));
        dot.setAttribute('cy', it.py.toFixed(1));
        dot.setAttribute('r', '3');
        svg.append(lineEl, dot);
      }
      col.style.minHeight = `${Math.max(0, floor - colTop)}px`;
    }
  }

  // ---------- Headlines: the longest line fills the lockup's width ----------
  function fit() {
    document.querySelectorAll('.lock .fit').forEach((el) => {
      el.style.fontSize = '200px';
      const widest = Math.max(...[...el.children].map((s) => s.scrollWidth));
      el.style.fontSize = `${Math.min(58, (200 * el.clientWidth) / widest).toFixed(2)}px`;
    });
  }

  const frames = document.querySelectorAll('.spread__frame');
  const readouts = document.querySelectorAll('[data-readout]');
  let queued = false;
  function layout() {
    queued = false;
    fit();
    frames.forEach(drawFrame);
    readouts.forEach(layoutReadout);
  }
  const relayout = () => { if (!queued) { queued = true; requestAnimationFrame(layout); } };
  new ResizeObserver(relayout).observe(document.body);
  document.fonts.ready.then(relayout);
  readouts.forEach((r) => r.querySelector('img').addEventListener('load', relayout));
  layout();

  // ---------- Cord drive model ----------
  // Sizes in mm from capstan_drive_v6.py and PLAN.md: shaft spacing 42, cord
  // radius 5.66 on the capstan and 35.66 on the sector (ratio 6.30), 180
  // degrees of travel = 12,902 half steps at 2.0 ms. Angles are SVG degrees,
  // clockwise from the right; the dial and the capstan both turn clockwise.
  const RATIO = 6.30;
  const STEPS_FULL = 12902;
  const STEP_MS = 2.0;
  const ON_FROM = 120;              // degrees of travel from OFF
  const PLAY_SPEED = 10;            // the buttons play moves 10 times faster
  const SECTOR_R = 36.9;
  const CORD_R = 35.66;
  const SLICE = [-35, 215];         // the sector's arc, local angles

  const svg = document.querySelector('.drivesvg');
  const pt = (r, deg) => [r * Math.cos(deg * Math.PI / 180), r * Math.sin(deg * Math.PI / 180)];
  const f = (v) => v.toFixed(3);
  const arcPath = (r, d0, d1) => {
    const [x0, y0] = pt(r, d0);
    const [x1, y1] = pt(r, d1);
    return `M ${f(x0)} ${f(y0)} A ${r} ${r} 0 ${d1 - d0 > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)}`;
  };
  const el = (name, attrs, parent) => {
    const node = document.createElementNS(ns, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    parent.append(node);
    return node;
  };

  // The fixed scale on the right: 0 at the top (OFF) to 180 at the bottom.
  const scale = svg.querySelector('.dv-scale');
  for (let t = 0; t <= 180; t += 10) {
    const major = t % 30 === 0;
    const [x0, y0] = pt(40, t - 90);
    const [x1, y1] = pt(major ? 44 : 42.5, t - 90);
    el('line', { x1: f(x0), y1: f(y0), x2: f(x1), y2: f(y1), class: major ? 'major' : '' }, scale);
    if (major) {
      const [tx, ty] = pt(47.2, t - 90);
      el('text', { x: f(tx), y: f(ty + 0.95), 'text-anchor': 'middle' }, scale).textContent = t;
    }
  }
  el('path', { d: arcPath(50.5, ON_FROM - 90, 90), class: 'zone' }, scale);
  const [onX, onY] = pt(54, 150 - 90);
  el('text', { x: f(onX), y: f(onY + 1), 'text-anchor': 'middle', class: 'zone-text' }, scale).textContent = 'ON';
  el('text', { x: '0', y: '-51.5', 'text-anchor': 'middle' }, scale).textContent = 'OFF';

  // The sector: a solid slice, the cord on its rim, a sled near each end.
  const [s0x, s0y] = pt(SECTOR_R, SLICE[0]);
  const [s1x, s1y] = pt(SECTOR_R, SLICE[1]);
  svg.querySelector('.dv-slice').setAttribute('d',
    `M 0 0 L ${f(s0x)} ${f(s0y)} A ${SECTOR_R} ${SECTOR_R} 0 1 1 ${f(s1x)} ${f(s1y)} Z`);
  svg.querySelector('.dv-cord').setAttribute('d', arcPath(CORD_R, SLICE[0] + 7, SLICE[1] - 7));
  const sleds = svg.querySelector('.dv-sleds');
  for (const a of [SLICE[0] + 13, SLICE[1] - 13]) {
    el('rect', { x: -2.6, y: -4, width: 5.2, height: 8, rx: 0.6, transform: `rotate(${a}) translate(27 0)` }, sleds);
  }
  el('text', { x: '-42', y: '-10.5', 'text-anchor': 'middle', class: 'dv-label' }, svg).textContent = 'CAPSTAN';
  el('text', { x: '-27', y: '47', 'text-anchor': 'middle', class: 'dv-label' }, svg).textContent = 'SECTOR';

  const sector = svg.querySelector('.dv-sector');
  const needle = svg.querySelector('.dv-needle');
  const capstanTurn = svg.querySelector('.dv-capstan-turn');
  const slider = document.querySelector('[data-in="travel"]');
  const out = (name) => document.querySelector(`[data-out="${name}"]`);
  const outs = { travel: out('travel'), turns: out('turns'), steps: out('steps'), time: out('time'), state: out('state') };

  let travel = 0;
  function setTravel(t) {
    travel = Math.min(180, Math.max(0, t));
    sector.setAttribute('transform', `rotate(${f(travel)})`);
    needle.setAttribute('transform', `rotate(${f(travel)})`);
    capstanTurn.setAttribute('transform', `rotate(${f(travel * RATIO)})`);
    const steps = Math.round(travel / 180 * STEPS_FULL);
    outs.travel.textContent = `${String(Math.round(travel)).padStart(3, '0')}°`;
    outs.turns.textContent = (travel / 360 * RATIO).toFixed(2);
    outs.steps.textContent = steps.toLocaleString('en-GB');
    outs.time.textContent = (steps * STEP_MS / 1000).toFixed(1);
    const on = travel >= ON_FROM;
    outs.state.classList.toggle('is-on', on);
    outs.state.querySelector('.led').classList.toggle('is-on', on);
    outs.state.querySelector('span').textContent = on ? 'Thermostat on' : 'Thermostat off';
    slider.value = Math.round(travel);
  }

  let playing = 0;
  function moveTo(target) {
    cancelAnimationFrame(playing);
    if (reduceMotion) { setTravel(target); return; }
    const degPerMs = 180 / (STEPS_FULL * STEP_MS / PLAY_SPEED);
    let last = performance.now();
    const tick = (now) => {
      const step = degPerMs * (now - last);
      last = now;
      const left = target - travel;
      if (Math.abs(left) <= step) { setTravel(target); return; }
      setTravel(travel + Math.sign(left) * step);
      playing = requestAnimationFrame(tick);
    };
    playing = requestAnimationFrame(tick);
  }

  slider.addEventListener('input', () => { cancelAnimationFrame(playing); setTravel(Number(slider.value)); });
  document.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', () => moveTo(Number(b.dataset.move))));
  setTravel(0);

  // ---------- Battery life chart ----------
  // From hardware/battery/README.md, "Battery life" (alkaline cells, to the
  // 3.3 V motor cutoff): [moves a day, years, days].
  const LIFE = {
    season: [[2, 3.9, 1420], [4, 2.4, 864], [6, 1.6, 572], [8, 1.3, 478], [12, 1.0, 377]],
    year: [[2, 2.8, 1036], [4, 1.7, 618], [6, 1.2, 440], [8, 0.9, 342], [12, 0.6, 237]],
  };
  const MOVE_MAH = 0.75;            // one move, on average
  const DAY_MAH = 0.48 + 0.24;      // idle current and self-discharge, a day

  const bars = document.querySelector('[data-bars]');
  const modeButtons = document.querySelectorAll('[data-mode]');
  const pOut = { years: out('years'), days: out('days'), mah: out('mah'), motor: out('motor') };
  let mode = 'season';
  let moves = 4;

  // Build the bars when the mode changes; choosing a bar only relights them,
  // so keyboard focus stays on the chosen bar.
  function drawChart() {
    bars.replaceChildren();
    for (const [n, years] of LIFE[mode]) {
      const bar = document.createElement('button');
      bar.type = 'button';
      bar.className = 'lbar';
      bar.dataset.moves = n;
      bar.setAttribute('aria-label', `${n} moves a day: ${years.toFixed(1)} years`);
      bar.innerHTML = `<span>${n} a day</span><span class="lbar__track"><span class="lbar__fill" style="--v:${years}"></span></span><span class="lbar__value">${years.toFixed(1)} yr</span>`;
      bar.addEventListener('click', () => { moves = n; select(); });
      bars.append(bar);
    }
    select();
  }

  function select() {
    for (const bar of bars.children) {
      const chosen = Number(bar.dataset.moves) === moves;
      bar.classList.toggle('is-selected', chosen);
      bar.setAttribute('aria-pressed', String(chosen));
    }
    const [, years, days] = LIFE[mode].find(([n]) => n === moves);
    const when = mode === 'season' ? 'October to April' : 'every day of the year';
    const mah = moves * MOVE_MAH + DAY_MAH;
    pOut.years.textContent = years.toFixed(1);
    pOut.days.textContent = `${days} days at ${moves} moves a day, ${when}`;
    pOut.mah.textContent = `${mah.toFixed(1)} mAh`;
    pOut.motor.textContent = `${Math.round(moves * MOVE_MAH / mah * 100)} %`;
  }

  modeButtons.forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    modeButtons.forEach((m) => m.setAttribute('aria-pressed', String(m === b)));
    drawChart();
  }));
  drawChart();
})();
