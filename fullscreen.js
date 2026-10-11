(() => {
  'use strict';
  const frame = document.querySelector('.game-frame');
  const button = document.getElementById('fullscreen-button');
  const canvas = document.getElementById('game');
  let busy = false, active = false, nativeActive = false, wanted = false, orientationLocked = false, savedScroll = 0;
  const nativeElement = () => document.fullscreenElement || document.webkitFullscreenElement;

  async function lockOrientation() {
    if (!screen.orientation?.lock) return;
    const phone = navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) <= 768;
    try {
      await screen.orientation.lock(phone ? 'portrait' : 'landscape');
      if (nativeElement() === frame) orientationLocked = true;
      else screen.orientation.unlock();
    } catch (_) { /* Orientation locking is optional and varies by browser. */ }
  }

  function sync() {
    const native = nativeElement() === frame;
    if (native && !wanted) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) Promise.resolve(exit.call(document)).catch(() => {});
    }
    if (native) frame.classList.remove('expanded');
    frame.classList.toggle('native-fullscreen', native);
    const expanded = native || frame.classList.contains('expanded');
    document.body.classList.toggle('game-view-expanded', expanded);
    button.setAttribute('aria-pressed', String(expanded));
    button.setAttribute('aria-label', expanded ? 'Exit fullscreen' : 'Enter fullscreen');
    button.title = expanded ? 'Exit fullscreen (F or Escape)' : 'Fullscreen (F)';
    if (native && !nativeActive && wanted) void lockOrientation();
    if (!expanded && active) {
      if (orientationLocked) { screen.orientation?.unlock?.(); orientationLocked = false; }
      window.scrollTo({ top: savedScroll, behavior: 'instant' });
      wanted = false;
    }
    active = expanded; nativeActive = native;
    // ResizeObserver handles the canvas resolution after native or CSS resizing.
  }

  async function toggle() {
    if (busy) return;
    busy = true;
    try {
      if (nativeElement() === frame) {
        wanted = false;
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) await exit.call(document);
      } else if (frame.classList.contains('expanded')) {
        wanted = false;
        frame.classList.remove('expanded');
      } else {
        wanted = true;
        savedScroll = window.scrollY;
        const request = frame.requestFullscreen || frame.webkitRequestFullscreen;
        if (request) {
          let timeout;
          try {
            const attempt = frame.requestFullscreen ? request.call(frame, { navigationUI: 'hide' }) : request.call(frame);
            await Promise.race([attempt, new Promise((_, reject) => {
              timeout = setTimeout(() => reject(new Error('Fullscreen did not respond')), 2000);
            })]);
          } catch (_) {
            if (wanted && nativeElement() !== frame) frame.classList.add('expanded');
          } finally { clearTimeout(timeout); }
        } else frame.classList.add('expanded');
      }
    } catch (_) { /* Keep the current view if a browser declines an exit. */ }
    finally {
      sync(); busy = false;
      canvas.focus({ preventScroll: true });
    }
  }

  button.addEventListener('click', toggle);
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  document.addEventListener('keydown', event => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (document.querySelector('dialog[open]') || event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (event.key.toLowerCase() === 'f') { event.preventDefault(); void toggle(); }
    else if (event.key === 'Escape' && frame.classList.contains('expanded')) {
      event.preventDefault(); event.stopImmediatePropagation(); void toggle();
    } else if (event.key === 'Escape' && busy && wanted && !nativeElement()) {
      event.preventDefault(); event.stopImmediatePropagation(); wanted = false;
    }
  }, true);

  // Home Screen apps already have their browser controls removed by the OS.
  // Fill that app window immediately; requesting native fullscreen on load
  // would fail because it requires a user gesture.
  const appLaunch = navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches;
  if (appLaunch) {
    document.body.classList.add('home-screen-app');
    frame.classList.add('expanded');
    sync();
  }
})();
