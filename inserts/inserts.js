/* Ember: base insert map.
   Loads model.json (the base's three printed pieces as meshes, and every
   brass insert's place and direction, made by tools/make_insert_map.py),
   draws the pieces with three.js, and walks through the inserts one step at
   a time. Each insert hangs above its hole with a dashed line down into it;
   ticked inserts are drawn pressed in. Ticks and the current step are kept
   in this browser's localStorage. */
(function () {
  'use strict';

  const PIECES = ['left', 'middle', 'right'];
  const PIECE_NAME = { left: 'Left piece', middle: 'Middle piece', right: 'Right piece' };
  // In the all-pieces view the side pieces stand apart, so the joint seats
  // under the middle piece's tabs show.
  const SPREAD = { left: -18, middle: 0, right: 18 };
  // Camera direction from the middle of the view, in case coordinates
  // (X right, Y up the wall, Z out from the wall). Z is up on the screen, as
  // for a piece lying on its back, and the camera stands beyond the bottom
  // edge, so the inserts that go in from the front hang above their holes.
  // From any height that sees over the lip to the right piece's seats, the
  // round flat for the right side screw is hidden under the slanted right
  // face: its ring shows faintly through it.
  const VIEW_DIR = { all: [0.2, -0.8, 1], left: [0.25, -0.8, 1], middle: [-0.55, -0.75, 1], right: [0.6, -0.75, 0.8] };
  const INSERT_L = 4.0;            // the insert's length
  const COLOURS = { scene: 0x15130f, piece: 0xd6cdbb, middle: 0xe6c4a3, edge: 0x3d382f, brass: 0xc99a4b,
    ring: 0xffb24d, dash: 0xece5d6 };
  // The first round (Jack, 2026-10-20): only the inserts needed to test that
  // the base stays on the thermostat plate (the joints that hold the three
  // pieces together and both side screws) and that the motor turns the
  // capstan drive (the motor posts). The rest wait.
  const FIRST_ROUND = ['joint', 'left_screw', 'right_screw', 'motor'];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = v => String(Math.round(v * 10) / 10);
  const $ = id => document.getElementById(id);

  const TEXT = {
    joint: { later: 'M3 x 16 through the middle piece\'s tab, joining the pieces.',
      top: i => 'Level with the floor of the round recess (' + fmt(i.bore) + ' across, ' + fmt(i.sink) + ' deep).' },
    cover: { later: 'M3 x 6 down through the cover\'s top face.',
      top: i => fmt(i.sink) + ' below the lip\'s face, at the bottom of the ' + fmt(i.bore) + ' counterbore.' },
    motor: { later: 'M3 x 8 through the motor\'s tab.', top: () => 'Level with the square post\'s top.',
      note: 'The post wall on the motor side is only 1.0 (0.6 at the knurls). Afterwards, check nothing has bulged into the motor\'s round space.' },
    uln: { later: 'M3 x 8 through the ULN2003 board.',
      top: i => fmt(i.sink) + ' below the post\'s top, at the bottom of the ' + fmt(i.bore) + ' counterbore. Follow it down with the iron\'s tip.' },
    bay: { later: 'M3 x 8 through the battery bay\'s tab.', top: () => 'Level with the tall post\'s top.' },
    xiao: { later: 'M3 x 8 through the XIAO clamp.', top: () => 'Level with the post\'s top.' },
    left_screw: { later: 'M3 x 20 from the front; its tip pushes the left tongue\'s ramp.',
      top: () => 'Level with the block\'s top (the same level as the deck\'s front).' },
    right_screw: { later: 'M3 x 25 from the right side; it pushes the right tongue onto the plate.',
      top: () => 'Level with the round flat on the slanted right face.' },
    bridge: { later: 'M3 x 8 through the AS5600 bridge.', top: () => 'Level with the tall post\'s top.' }
  };

  function facing(ins) {
    if (ins.axis[1] > 0.5) return 'top edge';
    if (ins.axis[0] > 0.5) return 'right side';
    return 'front';
  }
  function holdFor(ins) {
    const side = facing(ins), name = ins.piece + ' piece';
    if (side === 'top edge') return 'Hold the ' + name + ' with its top edge up. The hole opens down into the lip.';
    if (side === 'right side') return 'Hold the right piece with its right side up. The hole is in the round flat on the outside.';
    if (ins.piece === 'middle') return 'Turn the middle piece deck-up (it printed deck-down) and stand it on its rails.';
    return 'Lay the ' + name + ' on its back.';
  }
  function numList(a) {
    return a.length === 1 ? String(a[0]) : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  }

  const view = $('view'), msg = $('view-msg');
  fetch('model.json')
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(start)
    .catch(e => { msg.hidden = false; msg.textContent = 'The model did not load (' + e.message + '). Reload the page to try again.'; });

  function start(data) {
    const inserts = data.inserts.filter(ins => FIRST_ROUND.indexOf(ins.group) >= 0)
      .map((ins, i) => Object.assign({}, ins, { i: i, n: i + 1 }));
    const later = data.inserts.length - inserts.length;
    const N = inserts.length;

    // ----- Saved ticks and step (this browser only) -----
    const KEY = 'ember-base-' + data.version + '-inserts-first-round';
    const done = new Set();
    let step = -1;
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved) {
        (saved.done || []).forEach(n => { if (n >= 1 && n <= N) done.add(n - 1); });
        if (saved.step >= 1 && saved.step <= N) step = saved.step - 1;
      }
    } catch (e) { /* no storage */ }
    if (step < 0) step = firstOpen(0);
    function save() {
      try { localStorage.setItem(KEY, JSON.stringify({ done: Array.from(done).map(i => i + 1), step: step + 1 })); } catch (e) { /* no storage */ }
    }
    function firstOpen(from) {
      for (let k = 0; k < N; k++) { const i = (from + k) % N; if (!done.has(i)) return i; }
      return from % N;
    }

    // ----- Notes and the full list -----
    const nums = g => inserts.filter(i => i.group === g).map(i => i.n);
    [
      'Each one is an M3 brass heat-set insert, 5 across and 4 long, in a hole 4.2 across.',
      'Every hole is deeper than the insert (1.0 deeper, 1.5 at the joint seats), so an insert pushed on goes too far. Stop when its top reaches the level on its card.',
      'Do the joint seats (' + numList(nums('joint')) + ') and the left side screw block (' + numList(nums('left_screw'))
        + ') before the pieces are joined. Once joined, the middle piece\'s tabs sit over the seats and the left piece stands close round the block.',
      'At the joint seats the insert\'s top sits at the bottom of a round recess 6.2 across, and the iron\'s insert tip has to follow it down.',
      'The other ' + later + ' inserts (cover screws, ULN2003 board, battery bay, XIAO clamp and AS5600 bridge) are not needed for this test and are left out here.'
    ].forEach(t => { const li = document.createElement('li'); li.textContent = t; $('notes').appendChild(li); });

    const listEl = $('list');
    PIECES.forEach(piece => {
      const mine = inserts.filter(i => i.piece === piece);
      const by = { 'front': [], 'top edge': [], 'right side': [] };
      mine.forEach(i => by[facing(i)].push(i.n));
      let hold = piece === 'middle' ? 'Deck-up, standing on its rails.'
        : by.front.length === mine.length ? 'On its back for all of them.'
        : 'On its back for all except ' + numList(by['top edge'].concat(by['right side']).sort((a, b) => a - b)) + '.';
      if (by['top edge'].length) hold += ' Top edge up for ' + numList(by['top edge']) + '.';
      if (by['right side'].length) hold += ' Right side up for ' + numList(by['right side']) + '.';
      const sec = document.createElement('div');
      sec.className = 'piece';
      sec.innerHTML = '<h3>' + PIECE_NAME[piece] + '<span>' + mine.length + '</span></h3><p></p><ol class="rows"></ol>';
      sec.querySelector('p').textContent = hold;
      const ol = sec.querySelector('ol');
      mine.forEach(ins => {
        const li = document.createElement('li');
        li.className = 'row';
        li.innerHTML = '<span class="row__n">' + ins.n + '</span><div><div class="row__name"></div><div class="row__top"></div></div>'
          + '<label class="row__tick"><input type="checkbox" id="in-' + ins.n + '">In</label>';
        li.querySelector('.row__name').textContent = ins.name;
        li.querySelector('.row__top').textContent = 'Top: ' + TEXT[ins.group].top(ins);
        const box = li.querySelector('input');
        box.addEventListener('change', () => setDone(ins.i, box.checked));
        li.querySelector('label').addEventListener('click', e => e.stopPropagation());
        li.addEventListener('click', () => {
          goTo(ins.i, true);
          if (window.innerWidth < 900) window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
        });
        ins.row = li;
        ins.box = box;
        ol.appendChild(li);
      });
      listEl.appendChild(sec);
    });

    // One lamp per insert, with a gap between pieces.
    const leds = $('leds');
    inserts.forEach((ins, k) => {
      if (k > 0 && inserts[k - 1].piece !== ins.piece) { const g = document.createElement('span'); g.className = 'gap'; leds.appendChild(g); }
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Insert ' + ins.n + ': ' + ins.name);
      b.innerHTML = '<i></i>';
      b.addEventListener('click', () => goTo(ins.i, true));
      leds.appendChild(b);
      ins.led = b;
    });
    $('step-total').textContent = N;
    $('about-h').textContent = 'Where the ' + N + ' inserts go';
    $('all-h').textContent = 'All ' + N + ', piece by piece';

    // ----- The step card -----
    function renderCard() {
      const ins = inserts[step], t = TEXT[ins.group], isDone = done.has(step);
      $('step-n').textContent = String(ins.n).padStart(2, '0');
      $('step-piece').textContent = PIECE_NAME[ins.piece];
      $('step-dot').textContent = ins.n;
      $('step-name').textContent = ins.name;
      const side = facing(ins);
      $('step-faces').textContent = 'hole faces the ' + side;
      $('step-faces').classList.toggle('is-side', side !== 'front');
      $('step-hold').textContent = holdFor(ins);
      $('step-top').textContent = t.top(ins);
      $('step-later').textContent = t.later;
      $('step-note').hidden = !t.note;
      $('step-note').textContent = t.note || '';
      $('card').classList.toggle('is-done', isDone);
      const main = $('main-action');
      const left = N - done.size;
      main.classList.toggle('is-undo', isDone);
      main.textContent = isDone ? 'Untick this one' : left === 1 ? 'Pressed in · last one' : 'Pressed in · next';
      $('count').textContent = done.size === N ? 'All ' + N + ' in' : done.size + ' of ' + N + ' in';
      inserts.forEach(i => {
        i.led.classList.toggle('is-done', done.has(i.i));
        i.led.classList.toggle('is-on', i.i === step);
        i.row.classList.toggle('is-on', i.i === step);
        i.row.classList.toggle('is-done', done.has(i.i));
        i.box.checked = done.has(i.i);
      });
      if (gl) gl.mark();
    }

    function setDone(i, on) {
      if (on) done.add(i); else done.delete(i);
      save();
      renderCard();
    }

    function goTo(i, animate) {
      step = (i + N) % N;
      save();
      renderCard();
      if (gl) gl.focus(inserts[step], animate);
    }

    $('main-action').addEventListener('click', () => {
      if (done.has(step)) { setDone(step, false); return; }
      setDone(step, true);
      if (done.size < N) goTo(firstOpen(step + 1), true);
    });
    $('prev').addEventListener('click', () => goTo(step - 1, true));
    $('next').addEventListener('click', () => goTo(step + 1, true));

    const untick = $('untick');
    let armed = null;
    untick.addEventListener('click', () => {
      if (!armed) {
        untick.textContent = 'Tap again to untick all';
        armed = setTimeout(() => { untick.textContent = 'Untick all'; armed = null; }, 3000);
        return;
      }
      clearTimeout(armed);
      armed = null;
      untick.textContent = 'Untick all';
      done.clear();
      save();
      renderCard();
    });

    const slider = $('explode'), out = $('explode-out');
    function showExplode() { const v = Number(slider.value); out.textContent = v === 0 ? 'pressed in' : fmt(v) + ' mm'; }
    showExplode();

    // ----- The 3D view -----
    let gl = null;
    try {
      if (!window.THREE || !THREE.OrbitControls) throw new Error('three.js did not load');
      gl = makeView();
      msg.hidden = true;
    } catch (e) {
      msg.textContent = 'The 3D view could not start in this browser (' + e.message + '). The steps and the list still give every insert.';
    }
    slider.addEventListener('input', () => { showExplode(); if (gl) gl.setExplode(Number(slider.value)); });

    const segs = Array.from(document.querySelectorAll('.seg__b'));
    segs.forEach(b => b.addEventListener('click', () => { if (gl) gl.show(b.dataset.view, true); }));
    $('fit').addEventListener('click', () => { if (gl) gl.show(gl.current(), true); });

    renderCard();
    if (gl) gl.focus(inserts[step], false);

    function makeView() {
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      view.insertBefore(renderer.domElement, view.firstChild);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(COLOURS.scene);
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000);
      camera.up.set(0, 0, 1);                  // out from the wall is up on the screen (set before the controls read it)
      scene.add(new THREE.HemisphereLight(0xffffff, 0x6f685c, 0.7));
      const key = new THREE.DirectionalLight(0xffffff, 0.6);
      key.position.set(-0.6, 0.9, 1);           // the key light turns with the camera: from up and left of the viewer
      key.target.position.set(0, 0, -1);
      camera.add(key, key.target);
      scene.add(camera);

      function bytes(s) {
        const bin = atob(s), out = new Uint8Array(bin.length);
        for (let k = 0; k < bin.length; k++) out[k] = bin.charCodeAt(k);
        return out;
      }
      const edgeMat = new THREE.LineBasicMaterial({ color: COLOURS.edge });
      const pieces = {};
      PIECES.forEach(name => {
        const q = new Int16Array(bytes(data.pieces[name].positions).buffer);
        const pos = new Float32Array(q.length);
        for (let k = 0; k < q.length; k++) pos[k] = q[k] * data.step;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setIndex(new THREE.BufferAttribute(new Uint16Array(bytes(data.pieces[name].indices).buffer), 1));
        g.computeVertexNormals();
        const mat = new THREE.MeshPhongMaterial({ color: name === 'middle' ? COLOURS.middle : COLOURS.piece, side: THREE.DoubleSide,
          shininess: 8, specular: 0x161616, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
        const group = new THREE.Group();
        group.add(new THREE.Mesh(g, mat), new THREE.LineSegments(new THREE.EdgesGeometry(g, 28), edgeMat));
        scene.add(group);
        pieces[name] = { group: group, pos: pos };
      });

      // One insert: knurled outside (the flat facets), a groove round the middle, and the M3 bore.
      const R = 2.5, BORE = 1.5;
      const insertGeo = new THREE.LatheGeometry([[BORE, 0], [2.3, 0], [R, 0.2], [R, 1.65], [2.2, 1.85], [2.2, 2.15], [R, 2.35],
        [R, 3.8], [2.3, INSERT_L], [BORE, INSERT_L], [BORE, 0]].map(p => new THREE.Vector2(p[0], p[1])), 22);
      const dashGeo = new THREE.CylinderGeometry(0.28, 0.28, 1, 8);
      const dashMat = new THREE.MeshBasicMaterial({ color: COLOURS.dash });
      const ringMat = new THREE.MeshBasicMaterial({ color: COLOURS.ring, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      // The same ring and dashes again, faint and drawn through whatever is in
      // front of them, as hidden lines are on a drawing: so a hole behind a
      // wall still shows where it is.
      const hiddenRingMat = new THREE.MeshBasicMaterial({ color: COLOURS.ring, side: THREE.DoubleSide, transparent: true,
        opacity: 0.35, depthTest: false, depthWrite: false });
      const hiddenDashMat = new THREE.MeshBasicMaterial({ color: COLOURS.dash, transparent: true, opacity: 0.28,
        depthTest: false, depthWrite: false });
      const DASH = 1.6, GAP = 1.0, HOLE_BELOW = 0.8, MAX_OUT = 30;
      const upY = new THREE.Vector3(0, 1, 0);
      let explode = Number(slider.value);

      inserts.forEach(ins => {
        const axis = new THREE.Vector3().fromArray(ins.axis);
        const frame = new THREE.Group();     // origin: the pressed-in insert's bottom; +Y: out of the hole
        frame.position.fromArray(ins.top).addScaledVector(axis, -INSERT_L);
        frame.quaternion.setFromUnitVectors(upY, axis);
        const mat = new THREE.MeshPhongMaterial({ color: COLOURS.brass, shininess: 70, specular: 0x5e4a2a, flatShading: true });
        const body = new THREE.Mesh(insertGeo, mat);
        body.userData.i = ins.i;
        const inner = ins.bore ? ins.bore / 2 + 0.15 : 2.3;
        const ringGeo = new THREE.RingGeometry(inner, inner + 0.7, 48);
        const ring = new THREE.Group();
        const faint = new THREE.Mesh(ringGeo, hiddenRingMat);
        faint.renderOrder = 10;
        ring.add(new THREE.Mesh(ringGeo, ringMat), faint);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = INSERT_L + ins.sink + 0.03;
        const dashes = [];
        const count = Math.ceil((MAX_OUT + HOLE_BELOW) / (DASH + GAP)) + 1;
        for (let k = 0; k < count; k++) {
          const d = new THREE.Group();
          const f = new THREE.Mesh(dashGeo, hiddenDashMat);
          f.renderOrder = 10;
          d.add(new THREE.Mesh(dashGeo, dashMat), f);
          dashes.push(d);
          frame.add(d);
        }
        frame.add(body, ring);
        pieces[ins.piece].group.add(frame);
        const badge = document.createElement('button');
        badge.type = 'button';
        badge.className = 'badge';
        badge.textContent = ins.n;
        badge.setAttribute('aria-label', 'Insert ' + ins.n + ': ' + ins.name);
        badge.addEventListener('click', () => goTo(ins.i, true));
        $('badges').appendChild(badge);
        ins.badge = badge;
        ins.obj = { frame: frame, body: body, mat: mat, ring: ring, dashes: dashes, out: done.has(ins.i) ? 0 : explode };
        place(ins);
      });

      // Moves an insert to its distance out, with the dashed line from
      // inside its hole up to the insert's bottom.
      function place(ins) {
        const o = ins.obj;
        o.body.position.y = o.out;
        let y = -HOLE_BELOW, k = 0;
        while (k < o.dashes.length && y < o.out - 0.15) {
          const len = Math.min(DASH, o.out - y), d = o.dashes[k++];
          d.visible = true;
          d.position.y = y + len / 2;
          d.scale.y = len;
          y += DASH + GAP;
        }
        while (k < o.dashes.length) o.dashes[k++].visible = false;
      }

      const controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.screenSpacePanning = true;
      controls.zoomSpeed = 1.2;
      controls.addEventListener('change', () => { dirty = true; });
      controls.addEventListener('start', () => { anim = null; });

      let halfH = 100, current = 'all', dirty = true, anim = null;
      const tmp = new THREE.Vector3(), tip = new THREE.Vector3();

      function size() {
        const w = view.clientWidth, h = view.clientHeight;
        renderer.setSize(w, h, false);
        const a = w / Math.max(h, 1);
        camera.left = -halfH * a; camera.right = halfH * a; camera.top = halfH; camera.bottom = -halfH;
        camera.updateProjectionMatrix();
        dirty = true;
      }

      // The camera pose that fits what is drawn (the visible pieces and their
      // inserts pulled out) to the view; sets the frustum to match.
      function fitPose() {
        const pts = [];
        PIECES.forEach(p => {
          if (!pieces[p].group.visible) return;
          const sx = pieces[p].group.position.x, pos = pieces[p].pos;
          for (let k = 0; k < pos.length; k += 3) pts.push(pos[k] + sx, pos[k + 1], pos[k + 2]);
          inserts.filter(i => i.piece === p).forEach(ins => {
            for (const along of [0, explode + 8]) {   // 8: the insert and its number beyond it
              pts.push(ins.top[0] + sx + ins.axis[0] * along, ins.top[1] + ins.axis[1] * along, ins.top[2] + ins.axis[2] * along);
            }
          });
        });
        const box = new THREE.Box3();
        for (let k = 0; k < pts.length; k += 3) box.expandByPoint(tmp.set(pts[k], pts[k + 1], pts[k + 2]));
        const centre = box.getCenter(new THREE.Vector3());
        const dir = new THREE.Vector3().fromArray(VIEW_DIR[current]).normalize();
        const look = new THREE.Matrix4().lookAt(dir, new THREE.Vector3(), new THREE.Vector3(0, 0, 1));
        const right = new THREE.Vector3().setFromMatrixColumn(look, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(look, 1);
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (let k = 0; k < pts.length; k += 3) {
          tmp.set(pts[k], pts[k + 1], pts[k + 2]).sub(centre);
          const a = tmp.dot(right), b = tmp.dot(up);
          if (a < x0) x0 = a; if (a > x1) x1 = a; if (b < y0) y0 = b; if (b > y1) y1 = b;
        }
        centre.addScaledVector(right, (x0 + x1) / 2).addScaledVector(up, (y0 + y1) / 2 + 0.03 * (y1 - y0));
        const aspect = view.clientWidth / Math.max(view.clientHeight, 1);
        halfH = Math.max((y1 - y0) / 2, (x1 - x0) / 2 / aspect) * 1.1;
        size();
        return { target: centre, position: centre.clone().addScaledVector(dir, 800), zoom: 1, dir: dir };
      }

      function setPose(p) {
        controls.target.copy(p.target);
        camera.position.copy(p.position);
        camera.zoom = p.zoom;
        camera.updateProjectionMatrix();
        controls.update();
        dirty = true;
      }
      function animateTo(p) {
        if (reduced) { setPose(p); return; }
        anim = { t0: performance.now(), from: { target: controls.target.clone(), position: camera.position.clone(), zoom: camera.zoom }, to: p };
      }

      // Shows one piece, or all three apart; `animate` eases from the current view.
      function show(name, animate) {
        const changed = name !== current;
        current = name;
        segs.forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === name)));
        PIECES.forEach(p => {
          pieces[p].group.visible = name === 'all' || name === p;
          pieces[p].group.position.x = name === 'all' ? SPREAD[p] : 0;
        });
        scene.updateMatrixWorld();
        const pose = fitPose();
        if (animate && !changed) animateTo(pose); else { anim = null; setPose(pose); }
      }

      // Shows the insert's piece and moves in toward the insert.
      function focus(ins, animate) {
        const changed = current !== ins.piece;
        if (changed) show(ins.piece, false);
        const pose = fitPose();
        const mid = new THREE.Vector3(0, ins.obj.out / 2 + INSERT_L / 2, 0);
        ins.obj.frame.localToWorld(mid);
        pose.target.lerp(mid, 0.5);
        pose.position = pose.target.clone().addScaledVector(pose.dir, 800);
        pose.zoom = view.clientWidth < 700 ? 1.25 : 1.1;
        if (animate) animateTo(pose); else setPose(pose);
        mark();
      }

      function mark() {
        inserts.forEach(ins => {
          const on = ins.i === step;
          ins.obj.mat.emissive.setHex(on ? 0x6a3c00 : 0x000000);
          ins.obj.ring.scale.setScalar(on ? 1.3 : 1);
          ins.badge.classList.toggle('is-on', on);
          ins.badge.classList.toggle('is-done', done.has(ins.i));
          ins.badge.classList.toggle('is-dim', !on);
        });
        dirty = true;
      }

      function placeBadges() {
        const w = view.clientWidth, h = view.clientHeight;
        inserts.forEach(ins => {
          if (!pieces[ins.piece].group.visible) { ins.badge.hidden = true; return; }
          ins.badge.hidden = false;
          // Just beyond the insert's top end on the screen: above it for the
          // ones that go in from the front, beside it for the others.
          tmp.set(0, ins.obj.out + INSERT_L, 0);
          ins.obj.frame.localToWorld(tmp);
          tmp.project(camera);
          tip.set(0, ins.obj.out + INSERT_L + 1, 0);
          ins.obj.frame.localToWorld(tip);
          tip.project(camera);
          let dx = (tip.x - tmp.x) * w, dy = (tmp.y - tip.y) * h;
          const len = Math.hypot(dx, dy);
          if (len < 1e-6) { dx = 0; dy = -1; } else { dx /= len; dy /= len; }
          const gap = ins.i === step ? 21 : 17;
          const x = (tmp.x + 1) / 2 * w + dx * gap, y = (1 - tmp.y) / 2 * h + dy * gap;
          ins.badge.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
        });
      }

      function loop(now) {
        let moving = false;
        if (anim) {
          const k = Math.min(1, (now - anim.t0) / 450), e = 1 - Math.pow(1 - k, 3);
          controls.target.lerpVectors(anim.from.target, anim.to.target, e);
          camera.position.lerpVectors(anim.from.position, anim.to.position, e);
          camera.zoom = anim.from.zoom + (anim.to.zoom - anim.from.zoom) * e;
          camera.updateProjectionMatrix();
          controls.update();
          if (k >= 1) anim = null;
          moving = true;
        }
        inserts.forEach(ins => {
          const target = done.has(ins.i) ? 0 : explode, o = ins.obj;
          if (o.out !== target) {
            o.out = reduced || Math.abs(target - o.out) < 0.05 ? target : o.out + (target - o.out) * 0.16;
            place(ins);
            moving = true;
          }
        });
        if (dirty || moving) {
          scene.updateMatrixWorld();
          renderer.render(scene, camera);
          placeBadges();
          dirty = false;
        }
        requestAnimationFrame(loop);
      }

      // A tap on an insert (a tap, not the end of a drag) goes to its step.
      const ray = new THREE.Raycaster();
      let downAt = null;
      renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
      renderer.domElement.addEventListener('pointerup', e => {
        if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
        const r = renderer.domElement.getBoundingClientRect();
        ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera);
        const hit = ray.intersectObjects(inserts.filter(i => pieces[i.piece].group.visible).map(i => i.obj.body), false)[0];
        if (hit) goTo(hit.object.userData.i, true);
      });

      new ResizeObserver(() => size()).observe(view);
      size();
      requestAnimationFrame(loop);

      return {
        show: show,
        focus: focus,
        mark: mark,
        current: () => current,
        setExplode: v => {
          explode = v;
          inserts.forEach(ins => { if (!done.has(ins.i)) { ins.obj.out = v; place(ins); } });
          dirty = true;
        }
      };
    }
  }
})();
