(() => {
  'use strict';
  const frame = document.querySelector('.game-frame');
  const button = document.getElementById('fullscreen-button');
  const canvas = document.getElementById('game');
  let busy = false,
    active = false,
    nativeActive = false,
    wanted = false,
    orientationLocked = false,
    savedScroll = 0;
  const nativeElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  async function exitNative() {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    try {
      if (exit) await exit.call(document);
    } catch (_) {
      /* A denied or interrupted native exit must not break the controls. */
    }
  }

  async function lockOrientation() {
    if (!screen.orientation?.lock) return;
    const phone = navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) <= 768;
    try {
      await screen.orientation.lock(phone ? 'portrait' : 'landscape');
      if (nativeElement() === frame) orientationLocked = true;
      else screen.orientation.unlock();
    } catch (_) {
      /* Orientation locking is optional and varies by browser. */
    }
  }

  function sync() {
    const native = nativeElement() === frame;
    if (native && !wanted) void exitNative();
    if (native) frame.classList.remove('expanded');
    frame.classList.toggle('native-fullscreen', native);
    const expanded = native || frame.classList.contains('expanded');
    document.body.classList.toggle('game-view-expanded', expanded);
    button.setAttribute('aria-pressed', String(expanded));
    button.setAttribute('aria-label', expanded ? 'Exit fullscreen' : 'Enter fullscreen');
    button.title = expanded ? 'Exit fullscreen (F or Escape)' : 'Fullscreen (F)';
    if (native && !nativeActive && wanted) void lockOrientation();
    if (!expanded && active) {
      if (orientationLocked) {
        screen.orientation?.unlock?.();
        orientationLocked = false;
      }
      window.scrollTo({ top: savedScroll, behavior: 'instant' });
      wanted = false;
    }
    active = expanded;
    nativeActive = native;
    // ResizeObserver handles the canvas resolution after native or CSS resizing.
  }

  async function enterNative() {
    if (nativeElement() === frame) return;
    if (!active) savedScroll = window.scrollY;
    frame.classList.add('expanded');
    sync();
    if (busy) {
      wanted = true;
      return;
    }
    const request = frame.requestFullscreen || frame.webkitRequestFullscreen;
    if (!request || document.body.classList.contains('home-screen-app')) return;
    wanted = true;
    busy = true;
    let timeout;
    try {
      const attempt = frame.requestFullscreen
        ? request.call(frame, { navigationUI: 'hide' })
        : request.call(frame);
      await Promise.race([
        attempt,
        new Promise((resolve) => {
          timeout = setTimeout(resolve, 2000);
        }),
      ]);
    } catch (_) {
      /* The expanded view is already visible if native fullscreen is denied. */
    } finally {
      clearTimeout(timeout);
      busy = false;
      sync();
    }
  }

  async function toggle() {
    if (active) {
      wanted = false;
      frame.classList.remove('expanded');
      if (nativeElement() === frame) await exitNative();
      sync();
    } else await enterNative();
    canvas.focus({ preventScroll: true });
  }

  button.addEventListener('click', toggle);
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (
        document.querySelector('dialog[open]') ||
        event.target.closest?.(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
        )
      )
        return;
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        void toggle();
      } else if (event.key === 'Escape' && frame.classList.contains('expanded')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        void toggle();
      } else if (event.key === 'Escape' && busy && wanted && !nativeElement()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        wanted = false;
      }
    },
    true,
  );

  // Fill the viewport immediately for every visit. Native device fullscreen
  // is requested from the Play gesture because browsers disallow it on load.
  const appLaunch =
    navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches;
  if (appLaunch) document.body.classList.add('home-screen-app');
  frame.classList.add('expanded');
  sync();
  window.NeonFullscreen = { enterNative };
})();
