/* Original procedural soundtrack. Audio starts after a browser-approved gesture. */
(() => {
  'use strict';
  let context, master, timer, nextNote = 0, step = 0;
  let enabled = true, playing = true;
  const musicSources = new Set();
  const melody = [76, 0, 79, 83, 0, 79, 74, 0, 76, 0, 79, 86, 83, 0, 79, 74];
  const bass = [40, 40, 43, 43, 36, 36, 38, 38];
  const frequency = note => 440 * 2 ** ((note - 69) / 12);

  function tone(from, to, at, duration, volume, type = 'sine', music = false) {
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, at);
    if (to !== from) oscillator.frequency.exponentialRampToValueAtTime(to, at + duration);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain); gain.connect(master);
    if (music) musicSources.add(oscillator);
    oscillator.onended = () => { musicSources.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(at); oscillator.stop(at + duration + 0.025);
  }

  function schedule() {
    if (!enabled || !playing || document.hidden || context?.state !== 'running') return;
    const now = context.currentTime;
    // Do not play a backlog after an OS suspension or a delayed timer.
    if (nextNote < now) nextNote = now + 0.02;
    while (nextNote < now + 0.16) {
      const index = step % 16;
      if (index % 4 === 0) tone(125, 42, nextNote, 0.18, 0.25, 'sine', true);
      if (index % 4 === 2) tone(650, 120, nextNote, 0.07, 0.045, 'triangle', true);
      if (index % 2 === 0) {
        const note = frequency(bass[Math.floor(step / 4) % bass.length]);
        tone(note, note, nextNote, 0.20, 0.11, 'triangle', true);
      }
      if (melody[index]) {
        const note = frequency(melody[index]);
        tone(note, note, nextNote, 0.13, 0.065, 'triangle', true);
      }
      nextNote += 60 / 122 / 4; step++;
    }
  }

  function stopMusic() {
    clearInterval(timer); timer = null;
    for (const source of musicSources) { try { source.stop(); } catch (_) {} }
    musicSources.clear();
  }
  function sync() {
    if (!context) return;
    master.gain.setTargetAtTime(enabled && !document.hidden ? 0.85 : 0, context.currentTime, 0.015);
    if (!enabled || !playing || document.hidden || context.state !== 'running') { stopMusic(); return; }
    if (!timer) { nextNote = context.currentTime + 0.025; schedule(); timer = setInterval(schedule, 80); }
  }
  function unlock() {
    if (!enabled) return;
    try {
      if (!context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        context = new Audio({ latencyHint: 'interactive' });
        master = context.createGain();
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -12; compressor.knee.value = 12;
        compressor.ratio.value = 4; compressor.attack.value = 0.003; compressor.release.value = 0.12;
        master.connect(compressor); compressor.connect(context.destination);
        context.addEventListener('statechange', sync);
      }
      if (context.state === 'suspended' || context.state === 'interrupted') context.resume().then(sync).catch(() => {});
      else sync();
    } catch (_) { /* The game remains playable if audio is unavailable. */ }
  }
  function effect(type) {
    if (!enabled || !context || context.state !== 'running') return;
    const tones = { coin: [880, 1320, 0.10], jump: [240, 500, 0.13], slide: [180, 80, 0.15], crash: [120, 30, 0.35], goal: [660, 1320, 0.3], start: [330, 660, 0.18] };
    const [from, to, duration] = tones[type] || tones.coin;
    tone(from, to, context.currentTime, duration, 0.18, type === 'crash' ? 'sawtooth' : 'sine');
  }
  window.NeonAudio = {
    unlock, effect,
    setEnabled(value) { enabled = value; sync(); },
    setPlaying(value) { playing = value; sync(); }
  };
  document.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  document.addEventListener('keydown', event => { if (!event.ctrlKey && !event.metaKey && !event.altKey) unlock(); }, true);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', stopMusic);
  window.addEventListener('pageshow', sync);
})();
