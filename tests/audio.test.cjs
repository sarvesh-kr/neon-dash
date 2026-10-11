const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../audio.js'), 'utf8');

function harness(options = {}) {
  const timers = new Map(),
    contexts = [],
    connected = new Set();
  let peak = 0,
    timerId = 0;
  const events = () => ({
    handlers: {},
    addEventListener(name, handler) {
      (this.handlers[name] ||= []).push(handler);
    },
    emit(name) {
      for (const handler of this.handlers[name] || []) handler({});
    },
  });
  const parameter = () => ({
    value: 0,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
  });
  class AudioContext {
    constructor() {
      Object.assign(this, events());
      this.state = 'running';
      this.currentTime = 0;
      this.destination = {};
      this.nodes = [];
      this.closed = 0;
      this.resumes = 0;
      contexts.push(this);
    }
    createGain() {
      if (options.failGain) throw new Error('Gain unavailable');
      return { gain: parameter(), connect() {}, disconnect() {} };
    }
    createDynamicsCompressor() {
      return Object.fromEntries(
        ['threshold', 'knee', 'ratio', 'attack', 'release']
          .map((name) => [name, parameter()])
          .concat([['connect', () => {}]]),
      );
    }
    createOscillator() {
      if (options.failOscillator) throw new Error('Device unavailable');
      const node = {
        frequency: parameter(),
        onended: null,
        connect() {
          connected.add(node);
          peak = Math.max(peak, connected.size);
        },
        disconnect() {
          connected.delete(node);
        },
        start() {},
        stop() {},
      };
      this.nodes.push(node);
      return node;
    }
    suspend() {
      if (options.delayedSuspend)
        return new Promise((resolve) => {
          this.finishSuspend = () => {
            this.state = 'suspended';
            this.emit('statechange');
            resolve();
          };
        });
      this.state = 'suspended';
      this.emit('statechange');
      return Promise.resolve();
    }
    resume() {
      this.resumes++;
      this.state = 'running';
      this.emit('statechange');
      return Promise.resolve();
    }
    close() {
      this.closed++;
      this.state = 'closed';
      return Promise.resolve();
    }
  }
  const document = { ...events(), hidden: false },
    window = { ...events() };
  if (!options.unsupported) window.AudioContext = AudioContext;
  vm.runInNewContext(source, {
    window,
    document,
    setInterval(fn) {
      const id = ++timerId;
      timers.set(id, fn);
      return id;
    },
    clearInterval(id) {
      timers.delete(id);
    },
  });
  return {
    audio: window.NeonAudio,
    document,
    window,
    options,
    contexts,
    timers,
    connected,
    get peak() {
      return peak;
    },
  };
}

test('unsupported audio does not prevent game state or effects calls', () => {
  const h = harness({ unsupported: true });
  assert.doesNotThrow(() => {
    h.audio.unlock();
    h.audio.setPlaying(true);
    h.audio.effect('coin');
    h.audio.setEnabled(false);
  });
  assert.equal(h.contexts.length, 0);
  assert.equal(h.timers.size, 0);
});
test('partial audio initialization closes the candidate and can retry after enabling sound', () => {
  const h = harness({ failGain: true });
  assert.doesNotThrow(() => {
    h.audio.unlock();
    h.audio.setPlaying(true);
    h.audio.effect('coin');
  });
  assert.equal(h.contexts[0].closed, 1);
  h.options.failGain = false;
  h.audio.setEnabled(true);
  h.audio.unlock();
  assert.equal(h.contexts.length, 2);
  assert.ok(h.audio.activeVoices > 0);
  assert.equal(h.timers.size, 1);
});
test('runtime audio device failure leaves no timer or connected voices and can recover', () => {
  const h = harness();
  h.audio.unlock();
  h.audio.setPlaying(true);
  h.options.failOscillator = true;
  assert.doesNotThrow(() => h.audio.effect('coin'));
  assert.equal(h.audio.activeVoices, 0);
  assert.equal(h.connected.size, 0);
  assert.equal(h.timers.size, 0);
  h.options.failOscillator = false;
  h.audio.setEnabled(true);
  h.audio.unlock();
  assert.ok(h.audio.activeVoices > 0);
  assert.equal(h.timers.size, 1);
});
test('effect bursts and prioritized music stay within the connected voice budget', () => {
  const h = harness();
  h.audio.unlock();
  h.audio.setPlaying(true);
  for (let i = 0; i < 1000; i++) h.audio.effect('coin');
  h.contexts[0].currentTime = 1;
  for (const schedule of h.timers.values()) schedule();
  assert.equal(h.audio.activeVoices, 32);
  assert.ok(h.peak <= 32);
  h.audio.setEnabled(false);
  assert.equal(h.connected.size, 0);
  assert.equal(h.timers.size, 0);
});
test('ended voices disconnect and paused music stops scheduling', () => {
  const h = harness();
  h.audio.unlock();
  h.audio.setPlaying(true);
  h.audio.effect('coin');
  h.audio.setPlaying(false);
  assert.equal(h.timers.size, 0);
  assert.equal(h.audio.activeVoices, 1);
  for (const node of h.contexts[0].nodes) node.onended?.();
  assert.equal(h.audio.activeVoices, 0);
  assert.equal(h.connected.size, 0);
});
test('hidden pages suspend all audio and resume after a fresh trusted gesture', async () => {
  const h = harness();
  h.audio.unlock();
  h.audio.setPlaying(true);
  h.document.hidden = true;
  h.document.emit('visibilitychange');
  assert.equal(h.audio.activeVoices, 0);
  assert.equal(h.timers.size, 0);
  await Promise.resolve();
  h.document.hidden = false;
  h.document.emit('visibilitychange');
  h.document.emit('pointerdown');
  assert.equal(h.contexts[0].state, 'running');
  assert.equal(h.timers.size, 1);
});
test('unmuting during a pending suspension still requests resume from the gesture', () => {
  const h = harness({ delayedSuspend: true });
  h.audio.unlock();
  h.audio.setPlaying(true);
  h.audio.setEnabled(false);
  assert.equal(h.contexts[0].state, 'running');
  h.audio.setEnabled(true);
  h.audio.unlock();
  assert.equal(h.contexts[0].resumes, 1);
});
test('unknown and inherited effect names cannot throw or extend the sound bank', () => {
  const h = harness();
  h.audio.unlock();
  for (const name of ['constructor', '__proto__', 'toString', '', null])
    assert.doesNotThrow(() => h.audio.effect(name));
  assert.equal(h.audio.activeVoices, 5);
});
