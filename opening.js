// Opening view sequence. Adds state classes to .opening on a timeline; the
// CSS does the fades. A click or key press during the sequence jumps to the
// end; the Replay button runs it again.
(() => {
  const opening = document.querySelector('.opening');
  const typed = opening.querySelector('.crt__text');
  const replay = opening.querySelector('.replay');
  const line = typed.textContent;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Times in ms from the start of the sequence.
  const TYPE_START = 300;
  const TYPE_STEP = 34;          // per character
  const DARK = 500;
  const LAMP = 2000;
  const SUN = 3500;
  const MARK = 4900;
  const DONE = 6000;
  const STATES = ['is-typing', 'is-dark', 'is-lamp', 'is-sun', 'is-mark', 'is-done'];

  // The dark, lamp and bloom layers use copies of the one render.
  const picture = opening.querySelector('.room__sun picture');
  for (const name of ['dark', 'lamp', 'bloom']) {
    const copy = picture.cloneNode(true);
    const img = copy.querySelector('img');
    img.alt = '';
    img.removeAttribute('fetchpriority');
    opening.querySelector(`.room__${name}`).append(copy);
  }
  // Wait for the image to load, but not more than 2.5 s. (img.decode() stayed
  // pending in the desktop app's browser pane, so it is not used.)
  const img = picture.querySelector('img');
  const imageReady = Promise.race([
    img.complete ? Promise.resolve() : new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    }),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]);

  let timers = [];
  let running = false;
  let runId = 0;              // a newer run or a skip makes older runs stop

  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const add = (cls) => opening.classList.add(cls);

  function reset() {
    timers.forEach(clearTimeout);
    timers = [];
    add('is-instant');
    opening.classList.remove(...STATES);
    typed.textContent = '';
    void opening.offsetWidth;   // apply the reset before transitions return
    opening.classList.remove('is-instant');
  }

  function finish() {
    runId++;
    timers.forEach(clearTimeout);
    timers = [];
    running = false;
    add('is-instant');
    typed.textContent = line;
    STATES.forEach(add);
    void opening.offsetWidth;
    opening.classList.remove('is-instant');
  }

  async function run() {
    reset();
    const id = ++runId;
    running = true;
    add('is-typing');
    for (let i = 1; i <= line.length; i++) {
      at(TYPE_START + i * TYPE_STEP, () => { typed.textContent = line.slice(0, i); });
    }
    at(DARK, () => add('is-dark'));
    // Wait for the image before the lights, so the fade is not lost to loading.
    // The later steps keep their spacing after the lamp if the image is late.
    const start = performance.now();
    await imageReady;
    if (id !== runId) return;
    const elapsed = performance.now() - start;
    const lamp = Math.max(LAMP, elapsed);
    at(lamp - elapsed, () => add('is-lamp'));
    at(lamp + SUN - LAMP - elapsed, () => add('is-sun'));
    at(lamp + MARK - LAMP - elapsed, () => add('is-mark'));
    at(lamp + DONE - LAMP - elapsed, () => { add('is-done'); running = false; });
  }

  function skip(event) {
    if (!running) return;
    if (event.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(event.key)) return;
    finish();
  }

  replay.addEventListener('click', (event) => {
    event.stopPropagation();
    run();
  });
  window.addEventListener('pointerdown', skip);
  window.addEventListener('keydown', skip);

  if (reduceMotion) {
    finish();
  } else {
    // Start once the fonts are in, so the typed line does not change font
    // part way through; do not wait more than 1.2 s.
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]).then(run);
  }
})();
