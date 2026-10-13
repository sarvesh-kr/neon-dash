(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const canvas = $('game'),
    ctx = canvas.getContext('2d', { alpha: true });
  const gameFrame = canvas.closest('.game-frame');
  const pauseButton = $('pause-button');
  const graphicsQuality = $('graphics-quality');
  const overlayTitle = $('overlay-title');
  const game = new RunnerEngine();
  const geometry = NeonGeometry;
  const renderer3D = window.Neon3D?.create(canvas, geometry) || null;
  const runnerMotion = renderer3D?.runner.motion || window.NeonMotion.create();
  const gesture = new NeonSwipe();
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motionPreference.matches;
  const districts = [
    {
      name: 'MIDNIGHT DISTRICT',
      sky: ['#14192d', '#3d2847', '#6b3e5e', '#111b2b'],
      glow: '#c681753c',
      rail: '#af66b58c',
      sign: '#ffaae4',
      light: 1,
      floor: '#293046',
      fog: '#77517075',
    },
    {
      name: 'VIOLET MARKET',
      sky: ['#1a1531', '#392d66', '#6b4384', '#191b35'],
      glow: '#b080e53c',
      rail: '#aa88ef99',
      sign: '#a7adff',
      floor: '#332d4a',
      light: 2,
      fog: '#76569075',
    },
    {
      name: 'HARBOR RUN',
      sky: ['#0b1d2c', '#1c4755', '#42797c', '#102532'],
      glow: '#75c6c33c',
      rail: '#68d0c899',
      sign: '#97ffe8',
      floor: '#243e48',
      light: 3,
      fog: '#56868475',
    },
  ];
  let districtIndex = 0,
    currentDistrict = districts[0],
    cachedDpr = 1;
  let previousPose = { lane: 1, jump: 0 },
    viewLane = 1,
    viewJump = 0;
  let impact = 0,
    endDelay = 0,
    finishShown = true,
    newRecord = false,
    particleCount = 0,
    dustDistance = 0;
  let width = 900,
    height = 530,
    lastTime = 0,
    ambient = 0,
    selectedMode = 'classic';
  let soundEnabled = true,
    best = 0,
    runnerColor = 'mint',
    toastTimer;
  let coinGoal = false,
    distanceGoal = false;
  const palettes = {
    mint: { color: '#72f3cb', name: 'The Night Shift' },
    pink: { color: '#ff7baf', name: 'Pink Noise' },
    blue: { color: '#88acff', name: 'Blue Hour' },
  };
  const format = (value) => Math.floor(value).toLocaleString();
  const preferences = new NeonPreferences();
  best = preferences.get('best');
  runnerColor = preferences.get('color');
  soundEnabled = preferences.get('sound');
  const sound = (type) => NeonAudio.effect(type);
  const isTouch = () => navigator.maxTouchPoints > 0;
  const nodes = Object.fromEntries(
    [
      'distance-value',
      'coins',
      'coin-progress',
      'distance-progress',
      'coin-bar',
      'distance-bar',
      'speed-label',
      'magnet-label',
      'shield-label',
    ].map((id) => [id, $(id)]),
  );
  const hudValues = {};
  function text(id, value) {
    if (hudValues[id] !== value) {
      nodes[id].textContent = value;
      hudValues[id] = value;
    }
  }
  function setColor(color) {
    if (!Object.hasOwn(palettes, color)) return;
    runnerColor = color;
    document.documentElement.style.setProperty('--runner', palettes[color].color);
    $('runner-name').textContent = palettes[color].name;
    document.querySelectorAll('[data-color]').forEach((button) => {
      const selected = button.dataset.color === color;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    preferences.set('color', color);
    drawnState = undefined;
    scheduleFrame();
  }
  function updateSoundButton() {
    $('sound-button').setAttribute('aria-pressed', String(soundEnabled));
    $('sound-button').setAttribute('aria-label', soundEnabled ? 'Turn sound off' : 'Turn sound on');
  }
  function setPauseButton(paused) {
    pauseButton.setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
    pauseButton.setAttribute('aria-pressed', String(paused));
  }
  function setOverlayTitle(first, second) {
    const accent = document.createElement('span');
    accent.textContent = second;
    overlayTitle.replaceChildren(
      document.createTextNode(first),
      document.createElement('br'),
      accent,
    );
  }
  function showToast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2400);
  }
  function setDistrict(index, announce = false) {
    const next = index % districts.length,
      changed = next !== districtIndex;
    districtIndex = next;
    currentDistrict = districts[next];
    $('district-name').textContent = currentDistrict.name;
    $('district-number').textContent = String(Math.floor(game.distance / 750) + 1).padStart(2, '0');
    if (changed) {
      cacheScenery(cachedDpr);
      if (announce) showToast(`NOW ENTERING · ${currentDistrict.name}`);
    }
  }
  const effectColors = {
    coin: '#ffd67b',
    land: '#b4ced9',
    shield: '#a7f7cf',
    'shield-break': '#a7f7cf',
    magnet: '#88caff',
    dodge: '#b7ffe1',
    crash: '#ffb19b',
  };
  function feedback(effect) {
    const point = project(
      (effect.lane ?? game.visualLane) - 1,
      effect.z ?? 8.5,
      effect.type === 'coin' ? 0.7 : 0,
    );
    const target = project(game.visualLane - 1, 8.5, 0.7);
    if (!reducedMotion)
      NeonEffects.emit(
        effect.type,
        point.x,
        point.y,
        effectColors[effect.type] || '#ffffff',
        effect.type === 'coin' && game.magnetTime > 0 ? target : null,
      );
    if (effect.type === 'crash') {
      // Persist the completed run before an animation or navigation can delay it.
      newRecord = game.score > best;
      if (newRecord) {
        best = game.score;
        preferences.set('best', best);
        $('header-best').textContent = format(best);
      }
      impact = 0.3;
      endDelay = 0.3;
      NeonAudio.setPlaying(false);
      $('pause-button').disabled = true;
    }
    if (effect.type === 'shield-break') {
      impact = 0.15;
      showToast('SHIELD SAVED YOUR RUN');
      sound('goal');
    }
    if (effect.type === 'shield') {
      showToast('SHIELD · ONE HIT PROTECTED');
      sound('goal');
    }
    if (effect.type === 'magnet') {
      showToast('MAGNET · COINS COME TO YOU');
      sound('goal');
    }
  }
  function setModesEnabled(enabled) {
    document.querySelectorAll('[data-mode]').forEach((button) => {
      button.disabled = !enabled;
    });
  }
  function updateHUD() {
    text('distance-value', format(game.distance));
    text('coins', format(game.coins));
    text('coin-progress', `${Math.min(25, game.coins)} / 25`);
    text('distance-progress', `${format(Math.min(1000, game.distance))} / 1,000`);
    nodes['coin-bar'].style.transform = `scaleX(${Math.min(1, game.coins / 25)})`;
    nodes['distance-bar'].style.transform = `scaleX(${Math.min(1, game.distance / 1000)})`;
    text('speed-label', `${selectedMode.toUpperCase()} · ${Math.round(game.speed * 3.6)} KM/H`);
    $('magnet-status').hidden = game.magnetTime <= 0;
    $('shield-status').hidden = game.shieldTime <= 0;
    text('magnet-label', `MAGNET ${Math.ceil(game.magnetTime)}s`);
    text('shield-label', `SHIELD ${Math.ceil(game.shieldTime)}s`);
    $('magnet-meter').style.transform = `scaleX(${game.magnetTime / 10})`;
    $('shield-meter').style.transform = `scaleX(${game.shieldTime / 12})`;
    if (!coinGoal && game.coins >= 25) {
      coinGoal = true;
      showToast('✦ Follow the gold — goal complete!');
      sound('goal');
    }
    if (!distanceGoal && game.distance >= 1000) {
      distanceGoal = true;
      showToast('✦ Go the distance — goal complete!');
      sound('goal');
    }
  }
  function startRun() {
    gesture.reset();
    void NeonFullscreen.enterNative();
    NeonAudio.unlock();
    NeonAudio.setPlaying(true);
    accumulator = 0;
    lastTime = 0;
    endDelay = 0;
    finishShown = false;
    newRecord = false;
    impact = 0;
    NeonEffects.reset();
    particleCount = 0;
    dustDistance = 0;
    game.start(selectedMode);
    coinGoal = false;
    distanceGoal = false;
    previousPose = { lane: 1, jump: 0 };
    viewLane = 1;
    viewJump = 0;
    $('boost-guide').hidden = true;
    setDistrict(0);
    $('overlay').className = 'overlay hidden';
    $('hud').hidden = false;
    $('pause-button').disabled = false;
    setPauseButton(false);
    $('game-status').textContent = 'KEEP MOVING';
    $('toast').classList.remove('show');
    clearTimeout(toastTimer);
    setModesEnabled(false);
    sound('start');
    updateHUD();
    canvas.focus({ preventScroll: true });
    hudElapsed = 0;
    scheduleFrame();
  }
  function finishRun() {
    gesture.reset();
    finishShown = true;
    NeonAudio.setPlaying(false);
    const record = newRecord;
    $('overlay').className = 'overlay finished';
    setOverlayTitle(record ? 'NEW' : 'WHAT A', record ? 'RECORD.' : 'RUN.');
    const tips = {
      train: 'Switch lanes to dodge trains. Jumping won’t clear them.',
      barrier: 'Swipe up a little earlier to clear the striped barrier.',
      crate: 'Jump the cargo crates, or switch to an open lane.',
      gate: 'Swipe down to slide beneath the glowing gate.',
    };
    $('overlay-copy').textContent =
      tips[game.crashReason] ||
      (record
        ? 'A new personal best. The night is yours.'
        : 'Shake it off. There’s always one more run.');
    $('overlay').querySelector('.title-badge').textContent = record
      ? 'YOU JUST RAISED THE BAR'
      : 'THE CITY WILL BE WAITING';
    $('run-results').hidden = false;
    $('result-distance').textContent = `${format(game.distance)} m`;
    $('result-coins').textContent = format(game.coins);
    $('result-score').textContent = format(game.score);
    $('result-clears').textContent = format(game.dodges);
    $('play-label').textContent = 'RUN IT BACK';
    $('start-hint').textContent = isTouch()
      ? 'Swipe to move · up to jump · down to slide'
      : 'or press SPACE to try again';
    $('pause-button').disabled = true;
    $('game-status').textContent = 'ONE MORE TRY?';
    $('magnet-status').hidden = true;
    $('shield-status').hidden = true;
    setModesEnabled(true);
    $('play-button').focus({ preventScroll: true });
  }
  function togglePause() {
    gesture.reset();
    if (game.state === 'running') {
      NeonAudio.setPlaying(false);
      accumulator = 0;
      game.pause();
      $('overlay').className = 'overlay paused';
      setOverlayTitle('TAKE A', 'BREATHER.');
      $('overlay-copy').textContent = 'Your run is right here when you’re ready.';
      $('run-results').hidden = true;
      $('overlay').querySelector('.title-badge').textContent = 'EVEN THE FASTEST NEED A BREAK';
      $('play-label').textContent = 'KEEP GOING';
      $('start-hint').textContent = isTouch() ? 'Tap KEEP GOING to resume' : 'or press P to resume';
      setPauseButton(true);
      $('game-status').textContent = 'CATCH YOUR BREATH';
      $('play-button').focus({ preventScroll: true });
    } else if (
      game.state === 'paused' &&
      !document.hidden &&
      !document.querySelector('dialog[open]')
    ) {
      lastTime = 0;
      accumulator = 0;
      NeonAudio.unlock();
      NeonAudio.setPlaying(true);
      game.resume();
      $('overlay').className = 'overlay hidden';
      setPauseButton(false);
      $('game-status').textContent = 'KEEP MOVING';
      canvas.focus({ preventScroll: true });
    }
    scheduleFrame();
  }
  function action(type) {
    if (!game.action(type)) return;
    if (type === 'jump' || type === 'slide') sound(type);
    if (!reducedMotion && (type === 'left' || type === 'right' || type === 'slide')) {
      const point = project(game.visualLane - 1, 8.5);
      NeonEffects.emit('land', point.x, point.y, '#afc7da');
    }
  }
  $('play-button').addEventListener('click', () =>
    game.state === 'paused' ? togglePause() : startRun(),
  );
  $('pause-button').addEventListener('click', togglePause);
  $('sound-button').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    preferences.set('sound', soundEnabled);
    NeonAudio.setEnabled(soundEnabled);
    updateSoundButton();
    if (soundEnabled) NeonAudio.unlock();
  });
  document.querySelectorAll('[data-mode]').forEach((button) =>
    button.addEventListener('click', () => {
      selectedMode = button.dataset.mode;
      document.querySelectorAll('[data-mode]').forEach((item) => {
        const selected = item === button;
        item.classList.toggle('selected', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
    }),
  );
  function openDialog(id) {
    if (game.state === 'running') togglePause();
    $(id).showModal();
  }
  $('help-button').addEventListener('click', () => openDialog('help-dialog'));
  $('home-screen-button').addEventListener('click', () => openDialog('home-screen-dialog'));
  $('style-button').addEventListener('click', () => openDialog('style-dialog'));
  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) {
        const rect = dialog.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          dialog.close();
      }
    });
  });
  document.querySelector('.dialog-done').addEventListener('click', () => $('help-dialog').close());
  document.querySelectorAll('[data-color]').forEach((button) =>
    button.addEventListener('click', () => {
      setColor(button.dataset.color);
      $('style-dialog').close();
    }),
  );
  const keys = {
    ArrowLeft: 'left',
    a: 'left',
    A: 'left',
    ArrowRight: 'right',
    d: 'right',
    D: 'right',
    ArrowUp: 'jump',
    w: 'jump',
    W: 'jump',
    ' ': 'jump',
    ArrowDown: 'slide',
    s: 'slide',
    S: 'slide',
  };
  document.addEventListener('keydown', (event) => {
    if (document.querySelector('dialog[open]')) return;
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.target.closest?.(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
      )
    )
      return;
    if ((event.key === ' ' || event.key === 'Enter') && event.target.closest?.('button, a')) return;
    const movement = Object.hasOwn(keys, event.key);
    if (
      (movement && game.state === 'running') ||
      event.key === ' ' ||
      ['p', 'P', 'Escape'].includes(event.key)
    )
      event.preventDefault();
    if (event.repeat) return;
    if (['p', 'P', 'Escape'].includes(event.key)) {
      togglePause();
      return;
    }
    if (event.key === ' ' && game.state !== 'running') {
      if (game.state === 'paused') togglePause();
      else startRun();
      return;
    }
    if (movement) action(keys[event.key]);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'running') togglePause();
  });
  window.addEventListener('blur', () => {
    if (game.state === 'running') togglePause();
  });
  // The play surface is an input control, including its HUD and overlays.
  // Keep native selection, image dragging, and long-press menus out of it.
  for (const type of ['contextmenu', 'selectstart', 'dragstart']) {
    gameFrame.addEventListener(type, (event) => event.preventDefault());
  }
  // WebKit can show a touch callout independently of pointer defaults.
  // Cancel canvas touch defaults without cancelling toolbar button taps.
  canvas.addEventListener('touchstart', (event) => event.preventDefault(), { passive: false });
  canvas.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0 || game.state !== 'running') return;
    if (
      !gesture.begin(
        event.pointerId,
        event.clientX,
        event.clientY,
        canvas.getBoundingClientRect().width,
      )
    )
      return;
    event.preventDefault();
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (_) {
      /* Window listeners cover capture failures. */
    }
  });
  function swipe(event) {
    if (game.state !== 'running' || event.pointerId !== gesture.id) return;
    if (event.pointerType === 'mouse' && !(event.buttons & 1)) {
      gesture.cancel(event.pointerId);
      return;
    }
    const samples = event.getCoalescedEvents?.();
    if (samples)
      for (const sample of samples) {
        const direction = gesture.move(event.pointerId, sample.clientX, sample.clientY);
        if (direction) action(direction);
      }
    const direction = gesture.move(event.pointerId, event.clientX, event.clientY);
    if (direction) action(direction);
  }
  // Keep a started swipe usable at canvas edges and when capture is unavailable.
  window.addEventListener('pointermove', swipe, { passive: true });
  window.addEventListener('pointerup', (event) => {
    const direction = gesture.end(event.pointerId, event.clientX, event.clientY);
    if (direction && game.state === 'running') action(direction);
  });
  function cancelSwipe(event) {
    gesture.cancel(event.pointerId);
  }
  window.addEventListener('pointercancel', cancelSwipe);
  canvas.addEventListener('lostpointercapture', cancelSwipe);

  // Perspective projection and original procedural scenery.
  const projectionPoints = Array.from({ length: 4096 }, () => ({ x: 0, y: 0, scale: 0 }));
  let projectionCursor = 0;
  function project(x, z, elevation = 0) {
    if (renderer3D?.active) return renderer3D.project(x, z, elevation);
    const scale = 17 / (Math.max(geometry.nearClip, z) + 17);
    const point = projectionPoints[projectionCursor];
    projectionCursor = (projectionCursor + 1) % projectionPoints.length;
    point.x = width / 2 + x * width * 0.27 * scale;
    point.y = height * 0.345 + height * 0.66 * scale - elevation * height * 0.19 * scale;
    point.scale = scale;
    return point;
  }
  function polygon(points, color, stroke, context = ctx) {
    context.beginPath();
    points.forEach((point, index) =>
      index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y),
    );
    context.closePath();
    context.fillStyle = color;
    context.fill();
    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = 1;
      context.stroke();
    }
  }
  function line(a, b, color, thickness = 1, context = ctx) {
    context.strokeStyle = color;
    context.lineWidth = thickness;
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.stroke();
  }
  let seed = 7345;
  function seeded() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }
  const skyline = Array.from({ length: 60 }, () => ({
    x: seeded(),
    w: 0.015 + seeded() * 0.045,
    h: 0.035 + seeded() * 0.22,
    windows: seeded(),
    color: seeded(),
  }));
  const stars = Array.from({ length: 44 }, () => ({
    x: seeded(),
    y: seeded() * 0.29,
    alpha: seeded() * 0.5 + 0.1,
  }));
  const backdrop = document.createElement('canvas');
  let fogGradient, vignetteGradient;
  function cacheScenery(dpr) {
    if (renderer3D?.active) {
      backdrop.width = backdrop.height = 0;
      return;
    }
    backdrop.width = canvas.width;
    backdrop.height = canvas.height;
    const ctx = backdrop.getContext('2d', { alpha: false });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, currentDistrict.sky[0]);
    sky.addColorStop(0.28, currentDistrict.sky[1]);
    sky.addColorStop(0.45, currentDistrict.sky[2]);
    sky.addColorStop(1, currentDistrict.sky[3]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(
      width * 0.51,
      height * 0.31,
      0,
      width * 0.51,
      height * 0.31,
      width * 0.47,
    );
    glow.addColorStop(0, currentDistrict.glow);
    glow.addColorStop(1, '#b9767300');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    for (const star of stars) {
      ctx.fillStyle = `rgba(213,210,239,${star.alpha})`;
      ctx.fillRect(star.x * width, star.y * height, 1, 1);
    }
    ctx.fillStyle = '#dcc0c17a';
    ctx.beginPath();
    ctx.arc(width * 0.73, height * 0.17, 15, 0, Math.PI * 2);
    ctx.fill();
    for (const building of skyline) {
      const x = building.x * width,
        bh = building.h * height,
        bw = building.w * width,
        y = height * 0.39 - bh;
      ctx.fillStyle = building.color > 0.5 ? '#25253bbd' : '#29243cda';
      ctx.fillRect(x, y, bw, bh);
      ctx.fillStyle = building.color > 0.5 ? '#c98ba84a' : '#7593b348';
      for (let row = 0; row < Math.floor(bh / 10); row++)
        for (let col = 0; col < Math.floor(bw / 8); col++)
          if ((row * 3 + col * 5 + Math.floor(building.windows * 9)) % 4 !== 0)
            ctx.fillRect(x + 4 + col * 8, y + 6 + row * 10, 2, 3);
      if (building.h > 0.16) {
        ctx.strokeStyle = '#5a4264';
        ctx.beginPath();
        ctx.moveTo(x + bw / 2, y);
        ctx.lineTo(x + bw / 2, y - 10);
        ctx.stroke();
      }
    }
    const floorGradient = ctx.createLinearGradient(0, height * 0.35, 0, height);
    floorGradient.addColorStop(0, currentDistrict.floor);
    floorGradient.addColorStop(1, '#141d2e');
    fogGradient = ctx.createLinearGradient(0, height * 0.32, 0, height * 0.6);
    fogGradient.addColorStop(0, currentDistrict.fog);
    fogGradient.addColorStop(1, '#77517000');
    vignetteGradient = ctx.createRadialGradient(
      width / 2,
      height * 0.5,
      width * 0.1,
      width / 2,
      height * 0.5,
      width * 0.68,
    );
    vignetteGradient.addColorStop(0, '#090d1700');
    vignetteGradient.addColorStop(1, '#090d1755');
    // Bake the road and fixed rails into the backdrop instead of repainting them.
    polygon(
      [project(-1.67, 280), project(1.67, 280), project(1.67, -3), project(-1.67, -3)],
      floorGradient,
      undefined,
      ctx,
    );
    polygon(
      [project(-3.5, 280), project(-1.67, 280), project(-1.67, -3), project(-3.5, -3)],
      '#242033',
      undefined,
      ctx,
    );
    polygon(
      [project(1.67, 280), project(3.5, 280), project(3.5, -3), project(1.67, -3)],
      '#242033',
      undefined,
      ctx,
    );
    line(project(-1.66, 280), project(-1.66, -3), currentDistrict.rail, 2, ctx);
    line(project(1.66, 280), project(1.66, -3), currentDistrict.rail, 2, ctx);
    for (const lane of [-1, 0, 1]) {
      for (const rail of [-0.3, 0.3]) {
        line(project(lane + rail, 280), project(lane + rail, -3), '#677b91', 1.5, ctx);
        line(
          project(lane + rail + 0.022, 280),
          project(lane + rail + 0.022, -3),
          '#172133',
          2,
          ctx,
        );
      }
    }
  }
  function background() {
    ctx.drawImage(backdrop, 0, 0, width, height);
    const travel = game.state === 'ready' ? ambient * 7 : game.distance;
    for (let band = 0; band < 2; band++) {
      ctx.beginPath();
      ctx.strokeStyle = '#4e435663';
      ctx.lineWidth = band ? 1 : 2.5;
      for (let z = band ? 60 : 0; z < (band ? 270 : 60); z += 6) {
        const shifted = z - (travel % 6);
        if (shifted < -2) continue;
        for (const lane of [-1, 0, 1]) {
          const a = project(lane - 0.38, shifted),
            b = project(lane + 0.38, shifted);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
      }
      ctx.stroke();
    }
    for (const side of [-1, 1]) {
      for (let i = 7; i >= 0; i--) {
        const z = i * 37 + 8 - (travel % 37);
        if (z < -2) continue;
        streetBuilding(side, z, i);
      }
      for (let i = 7; i >= 0; i--) {
        const z = i * 33 + 15 - (travel % 33);
        if (z < 1) continue;
        const bottom = project(side * 1.88, z),
          top = project(side * 1.88, z, 2.8);
        line(bottom, top, '#6a526e', Math.max(1, bottom.scale * 4));
        const end = project(side * 1.56, z, 2.8);
        line(top, end, '#8b6894', Math.max(1, bottom.scale * 3));
        const tip = project(side * 1.4, z, 2.8);
        NeonGraphics.light(
          ctx,
          (end.x + tip.x) / 2,
          end.y,
          46 * bottom.scale,
          32 * bottom.scale,
          currentDistrict.light,
        );
        line(end, tip, currentDistrict.sign, Math.max(1, bottom.scale * 5));
        // Soft reflections add street depth using the same fixed light atlas.
        if (bottom.scale > 0.13) {
          const reflection = project(side * 1.55, z);
          ctx.globalAlpha = 0.24;
          NeonGraphics.light(
            ctx,
            reflection.x,
            reflection.y,
            62 * bottom.scale,
            16 * bottom.scale,
            currentDistrict.light,
          );
          ctx.globalAlpha = 1;
        }
      }
    }
    ctx.fillStyle = fogGradient;
    ctx.fillRect(0, height * 0.32, width, height * 0.3);
  }
  function streetBuilding(side, z, index) {
    const inner = side * 2.35,
      outer = side * (3.6 + (index % 3) * 0.4),
      tall = 3.3 + (index % 4) * 0.7;
    const a = project(inner, z),
      b = project(outer, z),
      c = project(outer, z, tall),
      d = project(inner, z, tall);
    const back = project(inner, z + 29, tall),
      backBottom = project(inner, z + 29);
    polygon([a, d, back, backBottom], index % 2 ? '#28263b' : '#22283c', '#494057');
    polygon([a, b, c, d], '#201f33', '#43354c');
    if (a.scale < 0.16) return; // Distant windows and signs occupy subpixel areas.
    for (let floor = 0.6; floor < tall - 0.2; floor += 0.55) {
      for (let room = 0; room < 3; room++) {
        const start = z + 3 + room * 8,
          color = (floor * 10 + room + index) % 3 > 1 ? '#d9a8889c' : '#9d75b473';
        polygon(
          [
            project(inner + side * 0.015, start, floor),
            project(inner + side * 0.015, start + 4, floor),
            project(inner + side * 0.015, start + 4, floor + 0.21),
            project(inner + side * 0.015, start, floor + 0.21),
          ],
          color,
        );
      }
    }
    if (index % 2 === 0) {
      const a = project(inner, z + 5, 1.4),
        b = project(inner, z + 16, 1.4),
        c = project(inner, z + 16, 2.2),
        d = project(inner, z + 5, 2.2);
      polygon([a, b, c, d], '#863b7960', '#e386c980');
      NeonGraphics.light(
        ctx,
        (a.x + b.x) / 2,
        (a.y + d.y) / 2,
        Math.abs(a.x - b.x) + 18 * a.scale,
        30 * a.scale,
        currentDistrict.light,
      );
      line(
        project(inner, z + 7, 1.7),
        project(inner, z + 14, 1.7),
        currentDistrict.sign,
        Math.max(1, a.scale * 3),
      );
    }
  }
  function box(x, z, halfWidth, length, tall, colors, drawFront = true, base = 0) {
    const a = project(x - halfWidth, z, base),
      b = project(x + halfWidth, z, base),
      c = project(x + halfWidth, z, base + tall),
      d = project(x - halfWidth, z, base + tall);
    const farL = project(x - halfWidth, z + length, base + tall),
      farR = project(x + halfWidth, z + length, base + tall);
    polygon([d, c, farR, farL], colors[2], '#ffffff15');
    if (x < 0) polygon([b, c, farR, project(x + halfWidth, z + length, base)], colors[1]);
    else polygon([a, d, farL, project(x - halfWidth, z + length, base)], colors[1]);
    if (drawFront) polygon([a, b, c, d], colors[0], '#ffffff20');
  }
  function drawObject(object) {
    if (
      object.collected ||
      (object.type === 'train'
        ? object.z + geometry.train.length < geometry.nearClip
        : object.z < geometry.nearClip) ||
      object.z > 280
    )
      return;
    const shape = geometry[object.type];
    const x = object.lane - 1,
      z = object.z,
      p = project(x, z);
    if (object.type === 'coin' || object.type === 'magnet' || object.type === 'shield') {
      const boost = object.type !== 'coin';
      const c = project(x, z, boost ? 0.95 + Math.sin(ambient * 3 + z) * 0.07 : 0.7);
      const radius = Math.max(1.5, height * (boost ? 0.033 : 0.021) * c.scale);
      NeonItems.draw(ctx, object.type, c.x, c.y, radius, Math.abs(ambient * 8 + z));
    } else if (object.type === 'train') {
      const visibleFront = Math.max(geometry.nearClip, z),
        visibleLength = z + shape.length - visibleFront;
      box(
        x,
        visibleFront,
        shape.halfWidth,
        visibleLength,
        shape.height,
        ['#446980', '#254257', '#718395'],
        z >= geometry.nearClip,
      );
      if (z < geometry.nearClip) {
        const side = x < 0 ? x + 0.435 : x - 0.435;
        for (let i = 3; i < 16; i += 4)
          if (z + i > geometry.nearClip)
            polygon(
              [
                project(side, z + i, 1.15),
                project(side, z + i + 2.5, 1.15),
                project(side, z + i + 2.5, 1.85),
                project(side, z + i, 1.85),
              ],
              '#a3c7d26d',
            );
        return;
      }
      polygon(
        [
          project(x - 0.35, z - 0.05, 1.22),
          project(x + 0.35, z - 0.05, 1.22),
          project(x + 0.31, z - 0.05, 1.99),
          project(x - 0.31, z - 0.05, 1.99),
        ],
        '#15283e',
        '#81b0bf',
      );
      line(
        project(x, z - 0.1, 1.23),
        project(x, z - 0.1, 1.98),
        '#7194a1',
        Math.max(1, p.scale * 2),
      );
      line(
        project(x - 0.4, z - 0.1, 0.86),
        project(x + 0.4, z - 0.1, 0.86),
        '#e79caa',
        Math.max(1, p.scale * 4),
      );
      for (const offset of [-0.26, 0.26]) {
        const light = project(x + offset, z - 0.1, 0.45);
        NeonGraphics.light(ctx, light.x, light.y, 48 * p.scale, 28 * p.scale, 0);
        ctx.fillStyle = '#fff1c3';
        ctx.fillRect(light.x - 6 * p.scale, light.y - 3 * p.scale, 12 * p.scale, 6 * p.scale);
      }
      const visibleSide = x < 0 ? x + 0.435 : x - 0.435;
      for (let i = 3; i < 16; i += 4)
        polygon(
          [
            project(visibleSide, z + i, 1.15),
            project(visibleSide, z + i + 2.5, 1.15),
            project(visibleSide, z + i + 2.5, 1.85),
            project(visibleSide, z + i, 1.85),
          ],
          '#a3c7d26d',
        );
    } else if (object.type === 'barrier') {
      box(x, z, shape.halfWidth, shape.length, shape.height, ['#db9b95', '#9e626e', '#f2bbab']);
      for (let i = 0; i < 5; i++) {
        const offset = -0.4 + i * 0.18;
        polygon(
          [
            project(x + offset, z - 0.03, 0.06),
            project(x + offset + 0.1, z - 0.03, 0.06),
            project(x + Math.min(shape.halfWidth, offset + 0.22), z - 0.03, 0.72),
            project(x + offset + 0.12, z - 0.03, 0.72),
          ],
          '#492e43',
        );
      }
    } else if (object.type === 'crate') {
      box(x, z, shape.halfWidth, shape.length, shape.height, ['#b98c53', '#715d49', '#d2ae78']);
      for (const offset of [-0.28, 0.28])
        line(
          project(x + offset, z - 0.05, 0.05),
          project(x + offset, z - 0.05, 0.94),
          '#f2d594',
          Math.max(1, p.scale * 4),
        );
      line(
        project(x - 0.34, z - 0.06, 0.18),
        project(x + 0.34, z - 0.06, 0.8),
        '#6a4c37',
        Math.max(1, p.scale * 4),
      );
      line(
        project(x + 0.34, z - 0.06, 0.18),
        project(x - 0.34, z - 0.06, 0.8),
        '#6a4c37',
        Math.max(1, p.scale * 4),
      );
    } else if (object.type === 'gate') {
      for (const offset of [-shape.postOffset, shape.postOffset])
        box(x + offset, z, shape.postHalfWidth, shape.length, shape.height, [
          '#887ca8',
          '#4a4463',
          '#aba1c6',
        ]);
      box(
        x,
        z,
        shape.beamHalfWidth,
        shape.length,
        shape.beamTop - shape.clearance,
        ['#ab638c', '#824b72', '#ffadd2'],
        true,
        shape.clearance,
      );
      const gateLight = project(x, z, 1.3);
      NeonGraphics.light(ctx, gateLight.x, gateLight.y, width * 0.29 * p.scale, 36 * p.scale, 1);
      line(
        project(x - 0.46, z - 0.02, 1.3),
        project(x + 0.46, z - 0.02, 1.3),
        '#ffa9dd',
        Math.max(1, p.scale * 4),
      );
      for (const offset of [-0.22, 0, 0.22]) {
        const at = project(x + offset, z - 0.03, 1.7);
        ctx.strokeStyle = '#ffe0ed';
        ctx.lineWidth = Math.max(1, p.scale * 2);
        ctx.beginPath();
        ctx.moveTo(at.x - p.scale * 5, at.y - p.scale * 2);
        ctx.lineTo(at.x, at.y + p.scale * 3);
        ctx.lineTo(at.x + p.scale * 5, at.y - p.scale * 2);
        ctx.stroke();
      }
    }
  }
  function runner() {
    const p = project(viewLane - 1, geometry.runner.z);
    const unitHeight = height * 0.19 * p.scale;
    const scale = (unitHeight * geometry.runner.height) / geometry.runner.artHeight;
    const jumping = viewJump * unitHeight;
    ctx.fillStyle = '#070d1a65';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 4, 30 * scale * (1 - viewJump * 0.16), 8 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(p.x, p.y - jumping);
    ctx.scale(scale, scale);
    const motion = runnerMotion.sample(game, ambient, reducedMotion);
    const active = motion.started;
    NeonCharacter.draw(ctx, {
      color: palettes[runnerColor].color,
      cycle: motion.phase,
      jump: viewJump,
      crouch: game.slidePose,
      landing: game.landing / 0.16,
      lean:
        Math.max(-0.22, Math.min(0.22, game.laneVelocity * 0.018)) +
        (game.state === 'over' ? Math.max(0, 0.3 - endDelay) * 0.8 : 0),
      active,
      shield: game.shieldTime > 0,
      magnet: game.magnetTime > 0,
      time: motion.clock,
    });
    ctx.restore();
  }
  const demoObjects = [
    { lane: 0, z: 68, type: 'train' },
    { lane: 2, z: 105, type: 'train' },
    { lane: 2, z: 38, type: 'barrier' },
    ...Array.from({ length: 9 }, (_, i) => ({ lane: 1, z: 23 + i * 8, type: 'coin' })),
  ].sort((a, b) => b.z - a.z);
  function render() {
    projectionCursor = 0;
    if (renderer3D?.active) {
      renderer3D.render(
        game,
        game.state === 'ready' ? demoObjects : game.objects,
        viewLane,
        viewJump,
        ambient,
        palettes[runnerColor].color,
        districtIndex,
        impact,
        reducedMotion,
      );
      ctx.clearRect(0, 0, width, height);
      NeonEffects.draw(ctx);
      if (impact > 0) {
        ctx.fillStyle = `rgba(255,210,190,${impact * 0.4})`;
        ctx.fillRect(0, 0, width, height);
      }
      return;
    }
    ctx.save();
    if (!reducedMotion && impact > 0)
      ctx.translate(Math.sin(ambient * 95) * impact * 10, Math.cos(ambient * 70) * impact * 6);
    background();
    const objects = game.state === 'ready' ? demoObjects : game.objects;
    let playerDrawn = false;
    for (const object of objects) {
      if (!playerDrawn && object.z < geometry.runner.z) {
        runner();
        playerDrawn = true;
      }
      drawObject(object);
    }
    if (!playerDrawn) runner();
    NeonEffects.draw(ctx);
    ctx.restore();
    ctx.fillStyle = vignetteGradient;
    ctx.fillRect(0, 0, width, height);
    if (impact > 0) {
      ctx.fillStyle = `rgba(255,210,190,${impact * 0.5})`;
      ctx.fillRect(0, 0, width, height);
    }
  }
  function resize() {
    if (document.hidden) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    if (width !== rect.width || height !== rect.height) gesture.reset();
    width = rect.width;
    height = rect.height;
    // Bound raster work on high-density phones and large desktop displays.
    const dpr = Math.min(2, window.devicePixelRatio || 1, Math.sqrt(1800000 / (width * height)));
    const worldChanged = renderer3D?.resize(width, height) || false;
    // Match the forgiving torso core to its visible CSS size in either aspect ratio.
    game.runnerHalfWidth = renderer3D?.active
      ? geometry.runner.halfWidth
      : Math.max(
          0.08,
          Math.min(
            0.4,
            (geometry.runner.coreHalfWidth * height * 0.19 * geometry.runner.height) /
              (geometry.runner.artHeight * width * 0.27),
          ),
        );
    gameFrame.classList.toggle('has-3d', !!renderer3D?.active);
    graphicsQuality.disabled = !renderer3D?.active;
    $('graphics-note').textContent = renderer3D?.active
      ? 'Auto balances detail and smooth play.'
      : 'Classic graphics are available on this device.';

    // The transparent effect layer needs fewer pixels than the 3D scene.
    const overlayDpr = renderer3D?.active ? Math.min(1, dpr) : dpr;
    const pixelWidth = Math.round(width * overlayDpr),
      pixelHeight = Math.round(height * overlayDpr);
    if (
      canvas.width === pixelWidth &&
      canvas.height === pixelHeight &&
      !worldChanged &&
      (renderer3D?.active || (backdrop.width === pixelWidth && backdrop.height === pixelHeight))
    )
      return;
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    ctx.setTransform(overlayDpr, 0, 0, overlayDpr, 0, 0);
    NeonEffects.reset();
    particleCount = 0;
    impact = 0;
    cachedDpr = overlayDpr;
    cacheScenery(overlayDpr);
    render();
  }
  function releaseRendering() {
    // Keep simulation and scores; release pixel buffers that cannot be displayed.
    renderer3D?.release();
    backdrop.width = backdrop.height = 0;
    canvas.width = canvas.height = 1;
    fogGradient = vignetteGradient = null;
    NeonItems.release();
    NeonGraphics.release();
    NeonEffects.reset();
    particleCount = 0;
    impact = 0;
    clearTimeout(toastTimer);
    $('toast').classList.remove('show');
  }
  function restoreRendering() {
    if (document.hidden) return;
    resize();
    scheduleFrame();
  }
  let hudElapsed = 0,
    accumulator = 0,
    lastDraw = 0,
    drawnState,
    animationId;
  const tick = 1 / 120;
  function scheduleFrame() {
    if (!animationId && !document.hidden) animationId = requestAnimationFrame(frame);
  }
  function frame(timestamp) {
    animationId = 0;
    if (document.hidden) {
      lastTime = 0;
      animationId = 0;
      return;
    }
    const frameDuration = lastTime ? (timestamp - lastTime) / 1000 : 0;
    const dt = Math.min(0.1, frameDuration);
    lastTime = timestamp;
    renderer3D?.observeFrame(Math.min(0.25, frameDuration), game.state === 'running');
    if (game.state !== 'paused' && game.state !== 'over') ambient += dt;
    if (game.state === 'running') {
      accumulator = Math.min(0.1, accumulator + dt);
      while (accumulator >= tick && game.state === 'running') {
        previousPose.lane = game.visualLane;
        previousPose.jump = game.jumpHeight;
        game.update(tick);
        accumulator -= tick;
        for (const event of game.events) if (event === 'coin' || event === 'crash') sound(event);
        for (const effect of game.effects) feedback(effect);
      }
      const alpha = game.state === 'over' ? 1 : Math.min(1, accumulator / tick);
      viewLane = previousPose.lane + (game.visualLane - previousPose.lane) * alpha;
      viewJump = previousPose.jump + (game.jumpHeight - previousPose.jump) * alpha;
      if (Math.floor(game.distance / 750) % districts.length !== districtIndex)
        setDistrict(Math.floor(game.distance / 750), true);
      if (!reducedMotion && game.distance - dustDistance > (game.slideTime > 0 ? 3 : 8)) {
        dustDistance = game.distance;
        if (!game.jumpTime) {
          const p = project(viewLane - 1, 8.5);
          NeonEffects.emit('land', p.x, p.y, '#9cb6ca');
        }
      }
      hudElapsed += dt;
      if (hudElapsed >= 0.1 || game.state === 'over') {
        updateHUD();
        hudElapsed = 0;
      }
    }
    let animationDirty = false;
    if (game.state !== 'paused') {
      animationDirty = particleCount > 0 || impact > 0;
      particleCount = NeonEffects.step(dt);
      impact = Math.max(0, impact - dt);
      if (game.state === 'over' && !finishShown) {
        endDelay = Math.max(0, endDelay - dt);
        if (!endDelay) finishRun();
      }
    }
    if (
      game.state === 'running' ||
      drawnState !== game.state ||
      animationDirty ||
      (game.state === 'over' && !finishShown) ||
      (game.state === 'ready' && timestamp - lastDraw >= 1000 / 30)
    ) {
      render();
      lastDraw = timestamp;
      drawnState = game.state;
    }
    const needsAnimation =
      game.state === 'running' ||
      (game.state === 'ready' && !reducedMotion) ||
      (game.state !== 'paused' &&
        (particleCount > 0 || impact > 0 || (game.state === 'over' && !finishShown)));
    if (needsAnimation) scheduleFrame();
    else lastTime = 0;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animationId);
      animationId = 0;
      lastTime = 0;
      releaseRendering();
    } else {
      lastTime = 0;
      restoreRendering();
    }
  });
  window.addEventListener('pagehide', () => {
    if (game.state === 'running') togglePause();
    cancelAnimationFrame(animationId);
    animationId = 0;
    lastTime = 0;
    releaseRendering();
  });
  window.addEventListener('pageshow', restoreRendering);
  function updateMotionPreference(event) {
    reducedMotion = event.matches;
    NeonEffects.reset();
    particleCount = 0;
    impact = 0;
    drawnState = undefined;
    scheduleFrame();
  }
  if (motionPreference.addEventListener)
    motionPreference.addEventListener('change', updateMotionPreference);
  else motionPreference.addListener(updateMotionPreference);
  function graphicsChanged() {
    if (game.state === 'running') togglePause();
    drawnState = undefined;
    resize();
    scheduleFrame();
  }
  if (renderer3D) renderer3D.onChange = graphicsChanged;
  graphicsQuality.addEventListener('change', () => renderer3D?.setQuality(graphicsQuality.value));
  graphicsChanged();
  $('header-best').textContent = format(best);
  setColor(runnerColor);
  updateSoundButton();
  $('start-hint').textContent = isTouch()
    ? 'Swipe to move · up to jump · down to slide'
    : 'or press SPACE to start';
  NeonAudio.setEnabled(soundEnabled);
  window.addEventListener('resize', resize);
  new ResizeObserver(resize).observe(canvas);
  resize();
  scheduleFrame();
})();
