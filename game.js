(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const game = new RunnerEngine();
  let width = 900, height = 530, lastTime = 0, ambient = 0, selectedMode = 'classic';
  let soundEnabled = false, audioContext, best = 0, runnerColor = 'mint', toastTimer;
  let coinGoal = false, distanceGoal = false, touchStart = null;
  const palettes = { mint: { color: '#72f3cb', name: 'The Night Shift' }, pink: { color: '#ff7baf', name: 'Pink Noise' }, blue: { color: '#88acff', name: 'Blue Hour' } };
  const format = value => Math.floor(value).toLocaleString();
  try {
    const value = Number(localStorage.getItem('neon-dash-best'));
    best = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    const savedColor = localStorage.getItem('neon-dash-color');
    if (palettes[savedColor]) runnerColor = savedColor;
    soundEnabled = localStorage.getItem('neon-dash-sound') === 'true';
  } catch (_) { /* Storage can be unavailable in private or embedded browsers. */ }
  function save(key, value) { try { localStorage.setItem(key, String(value)); } catch (_) {} }
  function sound(type) {
    if (!soundEnabled) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      const osc = audioContext.createOscillator(), gain = audioContext.createGain();
      const now = audioContext.currentTime;
      const tones = { coin: [880, 1320, 0.1], jump: [240, 500, 0.13], slide: [180, 80, 0.15], crash: [120, 30, 0.35], goal: [660, 1320, 0.3], start: [330, 660, 0.18] };
      const [from, to, duration] = tones[type] || tones.coin;
      osc.type = type === 'crash' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(from, now); osc.frequency.exponentialRampToValueAtTime(to, now + duration);
      gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(0.07, now + 0.008); gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain); gain.connect(audioContext.destination); osc.start(now); osc.stop(now + duration + 0.02);
    } catch (_) { /* Audio is optional. */ }
  }
  function setColor(color) {
    runnerColor = color; document.documentElement.style.setProperty('--runner', palettes[color].color);
    $('runner-name').textContent = palettes[color].name;
    document.querySelectorAll('[data-color]').forEach(button => {
      const selected = button.dataset.color === color;
      button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
    });
    save('neon-dash-color', color);
  }
  function updateSoundButton() {
    $('sound-button').setAttribute('aria-pressed', String(soundEnabled));
    $('sound-button').setAttribute('aria-label', soundEnabled ? 'Turn sound off' : 'Turn sound on');
    $('sound-button').querySelector('.sound-off').hidden = soundEnabled;
  }
  function showToast(message) {
    $('toast').textContent = message; $('toast').classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2400);
  }
  function setModesEnabled(enabled) { document.querySelectorAll('[data-mode]').forEach(button => { button.disabled = !enabled; }); }
  function updateHUD() {
    $('distance').innerHTML = `${format(game.distance)}<span> m</span>`;
    $('coins').textContent = format(game.coins);
    $('coin-progress').textContent = `${Math.min(25, game.coins)} / 25`;
    $('distance-progress').textContent = `${format(Math.min(1000, game.distance))} / 1,000`;
    $('coin-bar').style.width = `${Math.min(100, game.coins / 25 * 100)}%`;
    $('distance-bar').style.width = `${Math.min(100, game.distance / 10)}%`;
    $('speed-label').textContent = `${selectedMode.toUpperCase()} · ${Math.round(game.speed * 3.6)} KM/H`;
    if (!coinGoal && game.coins >= 25) { coinGoal = true; showToast('✦ Follow the gold — goal complete!'); sound('goal'); }
    if (!distanceGoal && game.distance >= 1000) { distanceGoal = true; showToast('✦ Go the distance — goal complete!'); sound('goal'); }
  }
  function startRun() {
    game.start(selectedMode); coinGoal = false; distanceGoal = false;
    $('overlay').className = 'overlay hidden'; $('hud').hidden = false; $('pause-button').disabled = false;
    $('pause-button').textContent = 'Ⅱ'; $('pause-button').setAttribute('aria-label', 'Pause game');
    $('game-status').textContent = 'KEEP MOVING'; $('touch-controls').classList.add('active');
    $('toast').classList.remove('show'); clearTimeout(toastTimer);
    setModesEnabled(false); sound('start'); updateHUD(); canvas.focus({ preventScroll: true });
  }
  function finishRun() {
    const record = game.score > best;
    if (record) { best = game.score; save('neon-dash-best', best); $('header-best').textContent = format(best); }
    $('overlay').className = 'overlay finished'; $('overlay-title').innerHTML = record ? 'NEW<br><span>RECORD.</span>' : 'WHAT A<br><span>RUN.</span>';
    $('overlay-copy').textContent = record ? 'A new personal best. The night is yours.' : 'Shake it off. There’s always one more run.';
    $('overlay').querySelector('.title-badge').textContent = record ? 'YOU JUST RAISED THE BAR' : 'THE CITY WILL BE WAITING';
    $('run-results').hidden = false; $('result-distance').textContent = `${format(game.distance)} m`;
    $('result-coins').textContent = format(game.coins); $('result-score').textContent = format(game.score);
    $('play-label').textContent = 'RUN IT BACK'; $('start-hint').innerHTML = 'or press <kbd>SPACE</kbd> to try again';
    $('pause-button').disabled = true; $('touch-controls').classList.remove('active'); $('game-status').textContent = 'ONE MORE TRY?';
    setModesEnabled(true); $('play-button').focus({ preventScroll: true });
  }
  function togglePause() {
    if (game.state === 'running') {
      game.pause(); $('overlay').className = 'overlay paused'; $('overlay-title').innerHTML = 'TAKE A<br><span>BREATHER.</span>';
      $('overlay-copy').textContent = 'Your run is right here when you’re ready.'; $('run-results').hidden = true;
      $('overlay').querySelector('.title-badge').textContent = 'EVEN THE FASTEST NEED A BREAK';
      $('play-label').textContent = 'KEEP GOING'; $('start-hint').innerHTML = 'or press <kbd>P</kbd> to resume';
      $('pause-button').textContent = '▶'; $('pause-button').setAttribute('aria-label', 'Resume game');
      $('touch-controls').classList.remove('active'); $('game-status').textContent = 'CATCH YOUR BREATH';
      $('play-button').focus({ preventScroll: true });
    } else if (game.state === 'paused' && !document.querySelector('dialog[open]')) {
      game.resume(); $('overlay').className = 'overlay hidden'; $('pause-button').textContent = 'Ⅱ';
      $('pause-button').setAttribute('aria-label', 'Pause game'); $('touch-controls').classList.add('active');
      $('game-status').textContent = 'KEEP MOVING'; canvas.focus({ preventScroll: true });
    }
  }
  function action(type) { if (game.state !== 'running') return; game.action(type); if (type === 'jump' || type === 'slide') sound(type); }
  $('play-button').addEventListener('click', () => game.state === 'paused' ? togglePause() : startRun());
  $('pause-button').addEventListener('click', togglePause);
  $('sound-button').addEventListener('click', () => { soundEnabled = !soundEnabled; save('neon-dash-sound', soundEnabled); updateSoundButton(); if (soundEnabled) sound('coin'); });
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    selectedMode = button.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach(item => { const selected = item === button; item.classList.toggle('selected', selected); item.setAttribute('aria-pressed', String(selected)); });
  }));
  function openDialog(id) { if (game.state === 'running') togglePause(); $(id).showModal(); }
  $('help-button').addEventListener('click', () => openDialog('help-dialog'));
  $('style-button').addEventListener('click', () => openDialog('style-dialog'));
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  });
  document.querySelector('.dialog-done').addEventListener('click', () => $('help-dialog').close());
  document.querySelectorAll('[data-color]').forEach(button => button.addEventListener('click', () => { setColor(button.dataset.color); $('style-dialog').close(); }));
  const keys = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'jump', w: 'jump', W: 'jump', ' ': 'jump', ArrowDown: 'slide', s: 'slide', S: 'slide' };
  document.addEventListener('keydown', event => {
    if (document.querySelector('dialog[open]')) return;
    if (event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (event.key in keys || ['p', 'P', 'Escape'].includes(event.key)) event.preventDefault();
    if (event.repeat) return;
    if (['p', 'P', 'Escape'].includes(event.key)) { togglePause(); return; }
    if (event.key === ' ' && game.state !== 'running') { game.state === 'paused' ? togglePause() : startRun(); return; }
    if (event.key in keys) action(keys[event.key]);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'running') togglePause(); });
  window.addEventListener('blur', () => { if (game.state === 'running') togglePause(); });
  canvas.addEventListener('pointerdown', event => { touchStart = { x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener('pointerup', event => {
    if (!touchStart) return;
    const dx = event.clientX - touchStart.x, dy = event.clientY - touchStart.y; touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    action(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy < 0 ? 'jump' : 'slide');
  });
  canvas.addEventListener('pointercancel', () => { touchStart = null; });
  document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('pointerdown', event => { event.preventDefault(); action(button.dataset.action); }));

  // Perspective projection and original procedural scenery.
  function project(x, z, elevation = 0) {
    const scale = 17 / (Math.max(-3, z) + 17);
    return { x: width / 2 + x * width * 0.27 * scale, y: height * 0.345 + height * 0.66 * scale - elevation * height * 0.19 * scale, scale };
  }
  function polygon(points, color, stroke) {
    ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.closePath();
    ctx.fillStyle = color; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function line(a, b, color, thickness = 1) { ctx.strokeStyle = color; ctx.lineWidth = thickness; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  let seed = 7345;
  function seeded() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  const skyline = Array.from({ length: 60 }, () => ({ x: seeded(), w: 0.015 + seeded() * 0.045, h: 0.035 + seeded() * 0.22, windows: seeded(), color: seeded() }));
  const stars = Array.from({ length: 44 }, () => ({ x: seeded(), y: seeded() * 0.29, alpha: seeded() * 0.5 + 0.1 }));
  function background() {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#14192d'); sky.addColorStop(0.28, '#3d2847'); sky.addColorStop(0.45, '#6b3e5e'); sky.addColorStop(1, '#111b2b');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(width * 0.51, height * 0.31, 0, width * 0.51, height * 0.31, width * 0.47);
    glow.addColorStop(0, '#c681753c'); glow.addColorStop(1, '#b9767300'); ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
    for (const star of stars) { ctx.fillStyle = `rgba(213,210,239,${star.alpha})`; ctx.fillRect(star.x * width, star.y * height, 1, 1); }
    ctx.fillStyle = '#dcc0c17a'; ctx.beginPath(); ctx.arc(width * 0.73, height * 0.17, 15, 0, Math.PI * 2); ctx.fill();
    for (const building of skyline) {
      const x = building.x * width, bh = building.h * height, bw = building.w * width, y = height * 0.39 - bh;
      ctx.fillStyle = building.color > 0.5 ? '#25253bbd' : '#29243cda'; ctx.fillRect(x, y, bw, bh);
      ctx.fillStyle = building.color > 0.5 ? '#c98ba84a' : '#7593b348';
      for (let row = 0; row < Math.floor(bh / 10); row++) for (let col = 0; col < Math.floor(bw / 8); col++) if ((row * 3 + col * 5 + Math.floor(building.windows * 9)) % 4 !== 0) ctx.fillRect(x + 4 + col * 8, y + 6 + row * 10, 2, 3);
      if (building.h > 0.16) line({ x: x + bw / 2, y }, { x: x + bw / 2, y: y - 10 }, '#5a4264');
    }
    const floor = ctx.createLinearGradient(0, height * 0.35, 0, height);
    floor.addColorStop(0, '#293046'); floor.addColorStop(1, '#141d2e');
    polygon([project(-1.67, 280), project(1.67, 280), project(1.67, -3), project(-1.67, -3)], floor);
    polygon([project(-3.5, 280), project(-1.67, 280), project(-1.67, -3), project(-3.5, -3)], '#242033');
    polygon([project(1.67, 280), project(3.5, 280), project(3.5, -3), project(1.67, -3)], '#242033');
    line(project(-1.66, 280), project(-1.66, -3), '#af66b58c', 2); line(project(1.66, 280), project(1.66, -3), '#af66b58c', 2);
    for (const lane of [-1, 0, 1]) {
      for (const rail of [-0.3, 0.3]) { line(project(lane + rail, 280), project(lane + rail, -3), '#677b91', 1.5); line(project(lane + rail + 0.022, 280), project(lane + rail + 0.022, -3), '#172133', 2); }
    }
    const travel = game.state === 'ready' ? ambient * 7 : game.distance;
    for (let z = 0; z < 270; z += 6) {
      const shifted = z - travel % 6;
      if (shifted < -2) continue;
      const p = project(0, shifted);
      for (const lane of [-1, 0, 1]) line(project(lane - 0.38, shifted), project(lane + 0.38, shifted), '#4e435663', Math.max(1, 4 * p.scale));
    }
    for (const side of [-1, 1]) {
      for (let i = 7; i >= 0; i--) {
        const z = i * 37 + 8 - travel % 37;
        if (z < -2) continue;
        streetBuilding(side, z, i);
      }
      for (let i = 7; i >= 0; i--) {
        const z = i * 33 + 15 - travel % 33;
        if (z < 1) continue;
        const bottom = project(side * 1.88, z), top = project(side * 1.88, z, 2.8);
        line(bottom, top, '#6a526e', Math.max(1, bottom.scale * 4));
        const end = project(side * 1.56, z, 2.8); line(top, end, '#8b6894', Math.max(1, bottom.scale * 3));
        ctx.shadowBlur = 15 * bottom.scale; ctx.shadowColor = '#ff9ddd'; line(end, project(side * 1.4, z, 2.8), '#ffc2ed', Math.max(1, bottom.scale * 5)); ctx.shadowBlur = 0;
      }
    }
    const fog = ctx.createLinearGradient(0, height * 0.32, 0, height * 0.6);
    fog.addColorStop(0, '#77517075'); fog.addColorStop(1, '#77517000'); ctx.fillStyle = fog; ctx.fillRect(0, height * 0.32, width, height * 0.3);
  }
  function streetBuilding(side, z, index) {
    const inner = side * 2.35, outer = side * (3.6 + index % 3 * 0.4), tall = 3.3 + index % 4 * 0.7;
    const a = project(inner, z), b = project(outer, z), c = project(outer, z, tall), d = project(inner, z, tall);
    const back = project(inner, z + 29, tall), backBottom = project(inner, z + 29);
    polygon([a, d, back, backBottom], index % 2 ? '#28263b' : '#22283c', '#494057');
    polygon([a, b, c, d], '#201f33', '#43354c');
    for (let floor = 0.6; floor < tall - 0.2; floor += 0.55) {
      for (let room = 0; room < 3; room++) {
        const start = z + 3 + room * 8, color = (floor * 10 + room + index) % 3 > 1 ? '#d9a8889c' : '#9d75b473';
        polygon([project(inner + side * 0.015, start, floor), project(inner + side * 0.015, start + 4, floor), project(inner + side * 0.015, start + 4, floor + 0.21), project(inner + side * 0.015, start, floor + 0.21)], color);
      }
    }
    if (index % 2 === 0) {
      const a = project(inner, z + 5, 1.4), b = project(inner, z + 16, 1.4), c = project(inner, z + 16, 2.2), d = project(inner, z + 5, 2.2);
      polygon([a, b, c, d], '#863b7960', '#e386c980');
      ctx.shadowColor = '#ef92da'; ctx.shadowBlur = a.scale * 13; line(project(inner, z + 7, 1.7), project(inner, z + 14, 1.7), '#ffaae4', Math.max(1, a.scale * 3)); ctx.shadowBlur = 0;
    }
  }
  function box(x, z, halfWidth, length, tall, colors, drawFront = true) {
    const a = project(x - halfWidth, z), b = project(x + halfWidth, z), c = project(x + halfWidth, z, tall), d = project(x - halfWidth, z, tall);
    const farL = project(x - halfWidth, z + length, tall), farR = project(x + halfWidth, z + length, tall);
    polygon([d, c, farR, farL], colors[2], '#ffffff15');
    if (x < 0) polygon([b, c, farR, project(x + halfWidth, z + length)], colors[1]);
    else polygon([a, d, farL, project(x - halfWidth, z + length)], colors[1]);
    if (drawFront) polygon([a, b, c, d], colors[0], '#ffffff20');
  }
  function drawObject(object) {
    if (object.collected || (object.type === 'train' ? object.z + 17 < -3 : object.z < -3) || object.z > 280) return;
    const x = object.lane - 1, z = object.z, p = project(x, z);
    if (object.type === 'coin') {
      const c = project(x, z, 0.7), radius = Math.max(1.5, height * 0.021 * c.scale);
      ctx.shadowColor = '#ffd678'; ctx.shadowBlur = 12 * c.scale;
      ctx.fillStyle = '#ffcc67'; ctx.beginPath(); ctx.ellipse(c.x, c.y, radius * (0.65 + Math.sin(ambient * 3 + z) * 0.15), radius, 0, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffeeb8'; ctx.lineWidth = Math.max(0.7, c.scale * 1.7); ctx.stroke();
      ctx.fillStyle = '#b87728'; ctx.font = `bold ${Math.max(3, radius * 1.3)}px Arial`; ctx.textAlign = 'center'; ctx.fillText('ϟ', c.x, c.y + radius * 0.45);
    } else if (object.type === 'train') {
      const visibleFront = Math.max(-3, z), visibleLength = z + 17 - visibleFront;
      box(x, visibleFront, 0.43, visibleLength, 2.25, ['#446980', '#254257', '#718395'], z >= -3);
      if (z < -3) {
        const side = x < 0 ? x + 0.435 : x - 0.435;
        for (let i = 3; i < 16; i += 4) if (z + i > -3) polygon([project(side, z + i, 1.15), project(side, z + i + 2.5, 1.15), project(side, z + i + 2.5, 1.85), project(side, z + i, 1.85)], '#a3c7d26d');
        return;
      }
      polygon([project(x - 0.35, z - 0.05, 1.22), project(x + 0.35, z - 0.05, 1.22), project(x + 0.31, z - 0.05, 1.99), project(x - 0.31, z - 0.05, 1.99)], '#15283e', '#81b0bf');
      line(project(x, z - 0.1, 1.23), project(x, z - 0.1, 1.98), '#7194a1', Math.max(1, p.scale * 2));
      line(project(x - 0.4, z - 0.1, 0.86), project(x + 0.4, z - 0.1, 0.86), '#e79caa', Math.max(1, p.scale * 4));
      for (const offset of [-0.26, 0.26]) {
        const light = project(x + offset, z - 0.1, 0.45); ctx.shadowColor = '#ffe8b1'; ctx.shadowBlur = 18 * p.scale; ctx.fillStyle = '#fff1c3'; ctx.fillRect(light.x - 6 * p.scale, light.y - 3 * p.scale, 12 * p.scale, 6 * p.scale); ctx.shadowBlur = 0;
      }
      const visibleSide = x < 0 ? x + 0.435 : x - 0.435;
      for (let i = 3; i < 16; i += 4) polygon([project(visibleSide, z + i, 1.15), project(visibleSide, z + i + 2.5, 1.15), project(visibleSide, z + i + 2.5, 1.85), project(visibleSide, z + i, 1.85)], '#a3c7d26d');
    } else if (object.type === 'barrier') {
      box(x, z, 0.45, 1, 0.78, ['#db9b95', '#9e626e', '#f2bbab']);
      for (let i = 0; i < 5; i++) { const offset = -0.4 + i * 0.18; polygon([project(x + offset, z - 0.03, 0.06), project(x + offset + 0.1, z - 0.03, 0.06), project(x + offset + 0.22, z - 0.03, 0.72), project(x + offset + 0.12, z - 0.03, 0.72)], '#492e43'); }
    } else if (object.type === 'gate') {
      for (const offset of [-0.43, 0.43]) box(x + offset, z, 0.045, 1.2, 2.1, ['#887ca8', '#4a4463', '#aba1c6']);
      polygon([project(x - 0.47, z, 1.25), project(x + 0.47, z, 1.25), project(x + 0.47, z, 2.08), project(x - 0.47, z, 2.08)], '#ab638c', '#ffadd2');
      ctx.shadowBlur = 15 * p.scale; ctx.shadowColor = '#ffa9dd'; line(project(x - 0.46, z - 0.02, 1.3), project(x + 0.46, z - 0.02, 1.3), '#ffa9dd', Math.max(1, p.scale * 4)); ctx.shadowBlur = 0;
      for (const offset of [-0.22, 0, 0.22]) { const at = project(x + offset, z - 0.03, 1.7); ctx.strokeStyle = '#ffe0ed'; ctx.lineWidth = Math.max(1, p.scale * 2); ctx.beginPath(); ctx.moveTo(at.x - p.scale * 5, at.y - p.scale * 2); ctx.lineTo(at.x, at.y + p.scale * 3); ctx.lineTo(at.x + p.scale * 5, at.y - p.scale * 2); ctx.stroke(); }
    }
  }
  function runner() {
    const p = project(game.visualLane - 1, 8.5), scale = Math.min(width / 900, height / 530) * 0.95;
    const jumping = game.jumpHeight * height * 0.083, sliding = game.slideTime > 0;
    const active = game.state === 'running', cycle = active ? game.distance * 0.65 : ambient * 4;
    const stride = active && !game.jumpTime && !sliding ? Math.sin(cycle) : 0.1;
    ctx.fillStyle = '#070d1a80'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, 31 * scale * (1 - game.jumpHeight * 0.13), 9 * scale, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(p.x, p.y - jumping); ctx.scale(scale, scale);
    if (sliding) { ctx.translate(0, -10); ctx.rotate(-0.8); ctx.scale(1, 0.65); }
    const lean = (game.lane - game.visualLane) * 0.17; ctx.rotate(lean);
    // Legs and luminous sneakers.
    for (const side of [-1, 1]) {
      const swing = stride * side * 10; ctx.strokeStyle = '#333448'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(side * 8, -40); ctx.lineTo(side * 11 + swing * 0.25, -21); ctx.lineTo(side * 13 + swing * 0.4, -6 - Math.max(0, swing)); ctx.stroke();
      ctx.strokeStyle = '#e6e4f0'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(side * 13 + swing * 0.4 - 3, -5 - Math.max(0, swing)); ctx.lineTo(side * 13 + swing * 0.4 + 6, -4 - Math.max(0, swing)); ctx.stroke();
      ctx.strokeStyle = palettes[runnerColor].color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(side * 13 - 4 + swing * 0.4, -1 - Math.max(0, swing)); ctx.lineTo(side * 13 + 9 + swing * 0.4, -1 - Math.max(0, swing)); ctx.stroke();
    }
    // Arms move in opposition to the stride.
    ctx.strokeStyle = palettes[runnerColor].color; ctx.lineWidth = 10;
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * 15, -76); ctx.lineTo(side * 24, -59 - stride * side * 6); ctx.lineTo(side * 21, -43 - stride * side * 10); ctx.stroke(); }
    ctx.fillStyle = palettes[runnerColor].color; ctx.beginPath(); ctx.roundRect(-18, -86, 36, 49, [12, 12, 5, 5]); ctx.fill();
    ctx.fillStyle = '#203b4045'; ctx.fillRect(6, -80, 10, 41); ctx.strokeStyle = '#d7fff970'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14, -47); ctx.lineTo(14, -47); ctx.stroke();
    ctx.fillStyle = '#253044'; ctx.beginPath(); ctx.roundRect(-10, -77, 20, 27, 6); ctx.fill(); ctx.strokeStyle = '#bed8de80'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#96e8d8'; ctx.fillRect(-3, -68, 6, 2);
    ctx.fillStyle = '#ba8a7a'; ctx.beginPath(); ctx.roundRect(-12, -107, 24, 24, 8); ctx.fill();
    ctx.fillStyle = '#2a2336'; ctx.beginPath(); ctx.roundRect(-14, -115, 28, 21, [11, 11, 4, 4]); ctx.fill();
    ctx.fillStyle = '#545067'; ctx.fillRect(-15, -98, 30, 5); ctx.restore();
  }
  const demoObjects = [{ lane: 0, z: 68, type: 'train' }, { lane: 2, z: 105, type: 'train' }, { lane: 2, z: 38, type: 'barrier' }, ...Array.from({ length: 9 }, (_, i) => ({ lane: 1, z: 23 + i * 8, type: 'coin' }))];
  function render() {
    ctx.clearRect(0, 0, width, height); background();
    const objects = game.state === 'ready' ? demoObjects : game.objects;
    const sorted = [...objects].sort((a, b) => b.z - a.z);
    let playerDrawn = false;
    for (const object of sorted) {
      if (!playerDrawn && object.z < 8.5) { runner(); playerDrawn = true; }
      drawObject(object);
    }
    if (!playerDrawn) runner();
    const vignette = ctx.createRadialGradient(width / 2, height * 0.5, width * 0.1, width / 2, height * 0.5, width * 0.68);
    vignette.addColorStop(0, '#090d1700'); vignette.addColorStop(1, '#090d1755'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
  }
  function resize() {
    const rect = canvas.getBoundingClientRect(); width = rect.width; height = rect.height;
    const dpr = Math.min(2, window.devicePixelRatio || 1); canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }
  let hudElapsed = 0;
  function frame(timestamp) {
    const dt = Math.min(0.05, lastTime ? (timestamp - lastTime) / 1000 : 0); lastTime = timestamp;
    if (game.state !== 'paused' && game.state !== 'over') ambient += dt;
    if (game.state === 'running') {
      game.update(dt); for (const event of game.events) if (['coin', 'crash'].includes(event)) sound(event);
      hudElapsed += dt; if (hudElapsed > 0.08 || game.state === 'over') { updateHUD(); hudElapsed = 0; }
      if (game.state === 'over') finishRun();
    }
    render(); requestAnimationFrame(frame);
  }
  $('header-best').textContent = format(best); setColor(runnerColor); updateSoundButton();
  new ResizeObserver(resize).observe(canvas); resize(); requestAnimationFrame(frame);
})();
