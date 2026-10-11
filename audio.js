/* Original procedural soundtrack. Audio starts after a browser-approved gesture. */
(() => {
  'use strict';
  let context,
    master,
    timer,
    nextNote = 0,
    step = 0;
  let enabled = true,
    playing = false,
    available = true,
    suspension = null;
  const voices = new Set();
  const voiceLimit = 32;
  const melody = [76, 0, 79, 83, 0, 79, 74, 0, 76, 0, 79, 86, 83, 0, 79, 74];
  const bass = [40, 40, 43, 43, 36, 36, 38, 38];
  const effects = {
    coin: [880, 1320, 0.1],
    jump: [240, 500, 0.13],
    slide: [180, 80, 0.15],
    crash: [120, 30, 0.35],
    goal: [660, 1320, 0.3],
    start: [330, 660, 0.18],
  };
  const frequency = (note) => 440 * 2 ** ((note - 69) / 12);

  function dispose(voice, stop = true) {
    voice.oscillator.onended = null;
    if (stop) {
      try {
        voice.oscillator.stop();
      } catch (_) {}
    }
    voice.oscillator.disconnect();
    voice.gain.disconnect();
    voices.delete(voice);
  }

  function tone(from, to, at, duration, volume, type = 'sine', music = false) {
    if (!available) return;
    if (voices.size >= voiceLimit) {
      if (!music) return;
      // Music takes priority over a burst of pickup/restart effects.
      let oldest = voices.values().next().value;
      for (const voice of voices)
        if (!voice.music) {
          oldest = voice;
          break;
        }
      dispose(oldest);
    }
    let oscillator, gain;
    try {
      oscillator = context.createOscillator();
      gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, at);
      if (to !== from) oscillator.frequency.exponentialRampToValueAtTime(to, at + duration);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(volume, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      oscillator.connect(gain);
      gain.connect(master);
      const voice = { oscillator, gain, music };
      voices.add(voice);
      oscillator.onended = () => {
        dispose(voice, false);
      };
      oscillator.start(at);
      oscillator.stop(at + duration + 0.025);
    } catch (_) {
      // Audio failures must never abort a simulation tick or leave connected nodes.
      available = false;
      if (oscillator) oscillator.onended = null;
      try {
        oscillator?.stop();
      } catch (_) {}
      try {
        oscillator?.disconnect();
      } catch (_) {}
      try {
        gain?.disconnect();
      } catch (_) {}
      suspend();
    }
  }

  function schedule() {
    if (!available || !enabled || !playing || document.hidden || context?.state !== 'running')
      return;
    const now = context.currentTime;
    // Do not play a backlog after an OS suspension or a delayed timer.
    if (nextNote < now) nextNote = now + 0.02;
    while (nextNote < now + 0.16) {
      const index = step % 16;
      if (index % 4 === 0) tone(125, 42, nextNote, 0.18, 0.25, 'sine', true);
      if (index % 4 === 2) tone(650, 120, nextNote, 0.07, 0.045, 'triangle', true);
      if (index % 2 === 0) {
        const note = frequency(bass[Math.floor(step / 4) % bass.length]);
        tone(note, note, nextNote, 0.2, 0.11, 'triangle', true);
      }
      if (melody[index]) {
        const note = frequency(melody[index]);
        tone(note, note, nextNote, 0.13, 0.065, 'triangle', true);
      }
      nextNote += 60 / 122 / 4;
      step = (step + 1) % 32;
    }
  }

  function stopMusic() {
    clearInterval(timer);
    timer = null;
    for (const voice of voices) if (voice.music) dispose(voice);
  }
  function stopAll() {
    stopMusic();
    for (const voice of voices) dispose(voice);
  }
  function suspend() {
    stopAll();
    if (context?.state === 'running' && !suspension) {
      try {
        const attempt = Promise.resolve(context.suspend());
        suspension = attempt;
        const settled = () => {
          if (suspension === attempt) suspension = null;
        };
        attempt.then(settled, settled);
      } catch (_) {}
    }
  }
  function sync() {
    if (!context) return;
    if (!available || context.state === 'closed') {
      stopAll();
      return;
    }
    master.gain.setTargetAtTime(enabled && !document.hidden ? 0.85 : 0, context.currentTime, 0.015);
    if (!enabled || document.hidden) {
      suspend();
      return;
    }
    if (context.state !== 'running') {
      stopAll();
      return;
    }
    if (!playing) {
      stopMusic();
      return;
    }
    if (!timer) {
      nextNote = context.currentTime + 0.025;
      schedule();
      if (available) timer = setInterval(schedule, 80);
    }
  }
  function unlock() {
    if (!enabled || !available) return;
    let candidate;
    try {
      if (context?.state === 'closed') {
        context = master = null;
        suspension = null;
      }
      if (!context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        candidate = new Audio({ latencyHint: 'interactive' });
        const output = candidate.createGain();
        const compressor = candidate.createDynamicsCompressor();
        compressor.threshold.value = -12;
        compressor.knee.value = 12;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.12;
        output.connect(compressor);
        compressor.connect(candidate.destination);
        candidate.addEventListener('statechange', sync);
        master = output;
        context = candidate;
      }
      if (suspension || context.state === 'suspended' || context.state === 'interrupted')
        context
          .resume()
          .then(sync)
          .catch(() => {});
      else sync();
    } catch (_) {
      available = false;
      suspend();
      if (candidate && context !== candidate) {
        try {
          Promise.resolve(candidate.close()).catch(() => {});
        } catch (_) {}
      }
      /* The game remains playable if audio is unavailable. */
    }
  }
  function effect(type) {
    if (!available || !enabled || !context || context.state !== 'running') return;
    const [from, to, duration] = Object.hasOwn(effects, type) ? effects[type] : effects.coin;
    tone(from, to, context.currentTime, duration, 0.18, type === 'crash' ? 'sawtooth' : 'sine');
  }
  window.NeonAudio = {
    unlock,
    effect,
    setEnabled(value) {
      enabled = value;
      if (enabled) available = true;
      sync();
    },
    setPlaying(value) {
      playing = value;
      sync();
    },
    get activeVoices() {
      return voices.size;
    },
    get capacity() {
      return voiceLimit;
    },
  };
  document.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  document.addEventListener(
    'keydown',
    (event) => {
      if (!event.ctrlKey && !event.metaKey && !event.altKey) unlock();
    },
    true,
  );
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', suspend);
  window.addEventListener('pageshow', sync);
})();
