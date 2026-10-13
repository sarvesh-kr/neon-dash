const test = require('node:test');
const assert = require('node:assert/strict');
const Motion = require('../motion.js');
const makeGame = () => ({ state: 'running', time: 0, speed: 29 });
test('animation cadence is independent of render frequency', () => {
  const a = new Motion(),
    b = new Motion(),
    game = makeGame();
  for (let i = 1; i <= 120; i++) {
    game.time = i / 120;
    a.sample(game, game.time);
  }
  for (let i = 1; i <= 30; i++) {
    game.time = i / 30;
    b.sample(game, game.time);
  }
  assert.ok(Math.abs(a.phase - b.phase) < 1e-10);
  assert.ok(Math.abs(a.clock - b.clock) < 1e-10);
});
test('pause and crash freeze gait, blink and secondary animation clocks', () => {
  const m = new Motion(),
    game = makeGame();
  game.time = 1;
  m.sample(game, 1);
  const values = [m.phase, m.clock, m.eyeOpen, m.turn];
  game.state = 'paused';
  for (let i = 0; i < 300; i++) m.sample(game, 100 + i);
  assert.deepEqual([m.phase, m.clock, m.eyeOpen, m.turn], values);
  game.state = 'over';
  m.sample(game, 999);
  assert.deepEqual([m.phase, m.clock, m.eyeOpen, m.turn], values);
});
test('resume and color redraws cannot count paused time or advance a pose twice', () => {
  const m = new Motion(),
    game = makeGame();
  game.time = 1;
  m.sample(game, 1);
  const phase = m.phase;
  game.state = 'paused';
  m.sample(game, 900);
  game.state = 'running';
  m.sample(game, 901);
  assert.equal(m.phase, phase);
  game.time += 1 / 120;
  m.sample(game, 902);
  const after = m.phase;
  m.sample(game, 902);
  assert.equal(m.phase, after);
  assert.notEqual(after, phase);
});
test('restart clears the previous run gait without replacing the animation object', () => {
  const m = new Motion(),
    game = makeGame();
  game.time = 20;
  m.sample(game, 20);
  game.time = 0;
  m.sample(game, 100);
  assert.equal(m.phase, 0);
  assert.equal(m.clock, 0);
  assert.equal(m.turn, Math.PI);
  game.time = 0.5;
  m.sample(game, 100.5);
  assert.equal(m.turn, 0);
});
test('speed changes cadence while animation clocks remain bounded over long play', () => {
  const slow = new Motion(),
    fast = new Motion(),
    a = makeGame(),
    b = makeGame();
  a.speed = 22;
  b.speed = 62;
  a.time = b.time = 0.04;
  slow.sample(a, 0);
  fast.sample(b, 0);
  assert.ok(fast.phase > slow.phase);
  for (let i = 1; i <= 20000; i++) {
    b.time = i * 3;
    fast.sample(b, b.time);
  }
  assert.ok(fast.phase >= 0 && fast.phase < Math.PI * 2);
  assert.ok(fast.clock >= 0 && fast.clock < Math.PI * 40);
  assert.ok(Number.isFinite(fast.eyeOpen));
});
test('reduced motion leaves the welcome still and preserves essential running feedback', () => {
  const m = new Motion(),
    game = { state: 'ready', time: 0, speed: 29 };
  m.sample(game, 0, true);
  m.sample(game, 100, true);
  assert.equal(m.clock, 0);
  assert.equal(m.eyeOpen, 1);
  game.state = 'running';
  game.time = 1;
  m.sample(game, 101, true);
  assert.ok(m.phase > 0);
  assert.equal(m.eyeOpen, 1);
});
test('invalid animation inputs cannot corrupt the next valid pose', () => {
  const m = new Motion(),
    game = makeGame();
  m.sample(game, NaN);
  game.time = Infinity;
  game.speed = NaN;
  m.sample(game, Infinity);
  assert.equal(m.phase, 0);
  assert.equal(m.clock, 0);
  game.time = 0.1;
  m.sample(game, 0.1);
  assert.ok(Number.isFinite(m.phase) && m.phase > 0);
});
