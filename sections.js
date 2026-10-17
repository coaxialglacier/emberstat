// The sections below the opening view: the section index, appear-on-scroll,
// enlarged pictures, the parts markers, the cord drive model and the
// battery life chart.
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

  // ---------- Inside: markers and the parts list light up together ----------
  const pins = document.querySelectorAll('.pin');
  const parts = document.querySelectorAll('.parts li');
  const light = (n) => {
    pins.forEach((p) => p.classList.toggle('is-active', p.dataset.part === n));
    parts.forEach((p) => p.classList.toggle('is-active', p.dataset.part === n));
  };
  [...pins, ...parts].forEach((el) => {
    el.addEventListener('mouseenter', () => light(el.dataset.part));
    el.addEventListener('focus', () => light(el.dataset.part));
    el.addEventListener('click', () => light(el.dataset.part));
  });

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
  const ns = 'http://www.w3.org/2000/svg';
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
