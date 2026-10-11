const test = require('node:test');
const assert = require('node:assert/strict');
const { RunnerEngine, MODES } = require('../engine.js');

function running() { const game = new RunnerEngine(() => 0.1); game.start(); game.objects = []; return game; }
function obstacle(game, type, lane = 1) { game.objects = [{ type, lane, z: 9.5, checked: false }]; }
function step(game, seconds) { for (let t = 0; t < seconds; t += 0.01) game.update(0.01); }

test('a train ends the run, but changing lanes avoids it', () => {
  const hit = running(); obstacle(hit, 'train'); hit.update(0.05); assert.equal(hit.state, 'over');
  const dodge = running(); dodge.action('left'); step(dodge, 0.25); obstacle(dodge, 'train'); dodge.update(0.05); assert.equal(dodge.state, 'running');
});
test('entering a train lane while its body passes still causes a collision', () => {
  const game = running(); game.lane = 0; game.visualLane = 0;
  game.objects = [{ type: 'train', lane: 1, z: 0 }]; game.action('right'); step(game, 0.1);
  assert.equal(game.state, 'over');
});
test('jump clears a low barrier; running into it ends the run', () => {
  const hit = running(); obstacle(hit, 'barrier'); hit.update(0.05); assert.equal(hit.state, 'over');
  const jump = running(); jump.action('jump'); step(jump, 0.25); obstacle(jump, 'barrier'); jump.update(0.05); assert.equal(jump.state, 'running');
  step(jump, 1); assert.equal(jump.jumpHeight, 0);
});
test('slide clears an overhead gate; jumping cannot clear it', () => {
  const slide = running(); slide.action('slide'); obstacle(slide, 'gate'); slide.update(0.05); assert.equal(slide.state, 'running');
  const hit = running(); hit.action('jump'); obstacle(hit, 'gate'); hit.update(0.05); assert.equal(hit.state, 'over');
});
test('coins are collected once and contribute 20 points each', () => {
  const game = running(); game.objects = [{ type: 'coin', lane: 1, z: 12 }]; game.update(0.05); game.update(0.05);
  assert.equal(game.coins, 1); assert.equal(game.score, Math.floor(game.distance) + 20);
});
test('pause freezes the simulation and resume continues it', () => {
  const game = running(); game.pause(); game.update(0.05); game.action('left');
  assert.equal(game.distance, 0); assert.equal(game.lane, 1);
  game.resume(); game.update(0.05); assert.ok(game.distance > 0);
});
test('lane input stays bounded and jump cannot repeat in midair', () => {
  const game = running(); for (let i = 0; i < 10; i++) game.action('left'); assert.equal(game.lane, 0);
  for (let i = 0; i < 10; i++) game.action('right'); assert.equal(game.lane, 2);
  game.action('jump'); game.update(0.05); const remaining = game.jumpTime; game.action('jump'); assert.equal(game.jumpTime, remaining);
});
test('each difficulty increases speed up to its own cap', () => {
  for (const [mode, config] of Object.entries(MODES)) {
    const game = running(); game.start(mode); game.time = 10000; game.objects = []; game.update(0.05);
    assert.equal(game.speed, config.max); assert.ok(game.speed > config.start);
  }
});
test('obstacle generation always leaves a lane clear and places coins there', () => {
  let seed = 42; const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const game = new RunnerEngine(random); game.distance = 2000;
  for (let i = 0; i < 100; i++) {
    game.objects = []; game.spawnRow(); const obstacles = game.objects.filter(o => o.type !== 'coin');
    const coins = game.objects.filter(o => o.type === 'coin');
    assert.ok(new Set(obstacles.map(o => o.lane)).size <= 2);
    assert.ok(coins.every(coin => obstacles.every(o => o.lane !== coin.lane)));
  }
});
