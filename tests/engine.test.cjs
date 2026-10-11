const test = require('node:test');
const assert = require('node:assert/strict');
const { RunnerEngine, MODES } = require('../engine.js');

function running() {
  const game = new RunnerEngine(() => 0.1);
  game.start();
  game.clearObjects();
  return game;
}
function obstacle(game, type, lane = 1) {
  game.objects = [{ type, lane, z: 9.5, checked: false }];
}
function step(game, seconds) {
  for (let t = 0; t < seconds; t += 0.01) game.update(0.01);
}

test('a train ends the run, but changing lanes avoids it', () => {
  const hit = running();
  obstacle(hit, 'train');
  hit.update(0.05);
  assert.equal(hit.state, 'over');
  const dodge = running();
  dodge.action('left');
  step(dodge, 0.25);
  obstacle(dodge, 'train');
  dodge.update(0.05);
  assert.equal(dodge.state, 'running');
});
test('entering a train lane while its body passes still causes a collision', () => {
  const game = running();
  game.lane = 0;
  game.visualLane = 0;
  game.objects = [{ type: 'train', lane: 1, z: 0 }];
  game.action('right');
  step(game, 0.1);
  assert.equal(game.state, 'over');
});
test('jump clears a low barrier; running into it ends the run', () => {
  const hit = running();
  obstacle(hit, 'barrier');
  hit.update(0.05);
  assert.equal(hit.state, 'over');
  const jump = running();
  jump.action('jump');
  step(jump, 0.25);
  obstacle(jump, 'barrier');
  jump.update(0.05);
  assert.equal(jump.state, 'running');
  step(jump, 1);
  assert.equal(jump.jumpHeight, 0);
});
test('slide clears an overhead gate; jumping cannot clear it', () => {
  const slide = running();
  slide.action('slide');
  obstacle(slide, 'gate');
  slide.update(0.05);
  assert.equal(slide.state, 'running');
  const hit = running();
  hit.action('jump');
  obstacle(hit, 'gate');
  hit.update(0.05);
  assert.equal(hit.state, 'over');
});
test('coins are collected once and contribute 20 points each', () => {
  const game = running();
  game.objects = [{ type: 'coin', lane: 1, z: 12 }];
  game.update(0.05);
  game.update(0.05);
  assert.equal(game.coins, 1);
  assert.equal(game.score, Math.floor(game.distance) + 20);
});
test('pause freezes the simulation and resume continues it', () => {
  const game = running();
  game.pause();
  game.update(0.05);
  game.action('left');
  assert.equal(game.distance, 0);
  assert.equal(game.lane, 1);
  game.resume();
  game.update(0.05);
  assert.ok(game.distance > 0);
});
test('lane input stays bounded and jump cannot repeat in midair', () => {
  const game = running();
  for (let i = 0; i < 10; i++) game.action('left');
  assert.equal(game.lane, 0);
  for (let i = 0; i < 10; i++) game.action('right');
  assert.equal(game.lane, 2);
  game.action('jump');
  game.update(0.05);
  const remaining = game.jumpTime;
  game.action('jump');
  assert.equal(game.jumpTime, remaining);
});
test('each difficulty increases speed up to its own cap', () => {
  for (const [mode, config] of Object.entries(MODES)) {
    const game = running();
    game.start(mode);
    game.time = 10000;
    game.clearObjects();
    game.update(0.05);
    assert.equal(game.speed, config.max);
    assert.ok(game.speed > config.start);
  }
});
test('obstacle generation always leaves a lane clear and places coins there', () => {
  let seed = 42;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const game = new RunnerEngine(random);
  game.distance = 2000;
  for (let i = 0; i < 100; i++) {
    game.clearObjects();
    game.spawnRow();
    const obstacles = game.objects.filter((o) =>
      ['train', 'barrier', 'gate', 'crate'].includes(o.type),
    );
    const coins = game.objects.filter((o) => o.type === 'coin');
    assert.ok(new Set(obstacles.map((o) => o.lane)).size <= 2);
    assert.ok(coins.every((coin) => obstacles.every((o) => o.lane !== coin.lane)));
  }
});

test('lane movement takes the same time at different simulation rates', () => {
  const slow = running(),
    fast = running();
  slow.action('right');
  fast.action('right');
  for (let i = 0; i < 2; i++) slow.update(0.05);
  for (let i = 0; i < 10; i++) fast.update(0.01);
  assert.ok(Math.abs(slow.visualLane - fast.visualLane) < 1e-9);
  assert.ok(fast.visualLane > 1.9);
});
test('a jump pressed just before landing starts after landing', () => {
  const game = running();
  game.action('jump');
  step(game, 0.84);
  assert.equal(game.action('jump'), true);
  step(game, 0.1);
  assert.ok(game.jumpTime > 0.8);
  assert.equal(game.jumpQueued, 0);
});
test('downward input lands an airborne runner and slides under a gate', () => {
  const game = running();
  game.action('jump');
  step(game, 0.3);
  assert.ok(game.jumpHeight > 0.85);
  game.action('slide');
  assert.equal(game.jumpHeight, 0);
  assert.equal(game.jumpTime, 0);
  obstacle(game, 'gate');
  game.update(0.01);
  assert.equal(game.state, 'running');
});
test('spawned objects keep depth order and collected coins stop rendering', () => {
  const game = running();
  const objects = game.objects;
  game.spawnRow(120);
  game.spawnRow(205);
  assert.ok(
    game.objects.every((object, index) => index === 0 || game.objects[index - 1].z >= object.z),
  );
  game.objects.push({ type: 'coin', lane: 1, z: 9 });
  game.update(0.01);
  assert.equal(game.coins, 1);
  assert.equal(game.objects, objects);
  assert.ok(game.objects.every((object) => !object.collected));
});

test('a shield absorbs one train hit without dying on its next frame', () => {
  const game = running();
  game.shieldTime = 12;
  obstacle(game, 'train');
  game.update(0.05);
  assert.equal(game.state, 'running');
  assert.equal(game.shieldTime, 0);
  assert.ok(game.events.includes('shield-break'));
  assert.equal(game.objects.length, 0);
  game.update(0.05);
  assert.equal(game.state, 'running');
  game.invulnerable = 0;
  obstacle(game, 'train');
  game.update(0.05);
  assert.equal(game.state, 'over');
});
test('a magnet attracts nearby coins across lanes, then expires', () => {
  const game = running();
  game.magnetTime = 0.07;
  game.objects = [
    { type: 'coin', lane: 0, z: 20 },
    { type: 'coin', lane: 2, z: 28 },
    { type: 'coin', lane: 2, z: 80 },
  ];
  game.update(0.01);
  assert.equal(game.coins, 2);
  step(game, 0.1);
  assert.equal(game.magnetTime, 0);
  assert.equal(game.coins, 2);
});
test('pickups activate on contact and pause freezes their timers', () => {
  for (const [type, property, duration] of [
    ['shield', 'shieldTime', 12],
    ['magnet', 'magnetTime', 10],
  ]) {
    const game = running();
    game.objects = [{ type, lane: 1, z: 10 }];
    game.update(0.01);
    assert.equal(game[property], duration);
    assert.ok(game.events.includes(type));
    game.pause();
    game.update(0.05);
    assert.equal(game[property], duration);
    game.start();
    assert.equal(game[property], 0);
  }
});
test('cargo crates can be jumped and identify the reason for a collision', () => {
  const hit = running();
  obstacle(hit, 'crate');
  hit.update(0.05);
  assert.equal(hit.state, 'over');
  assert.equal(hit.crashReason, 'crate');
  const jump = running();
  jump.action('jump');
  step(jump, 0.25);
  obstacle(jump, 'crate');
  jump.update(0.05);
  assert.equal(jump.state, 'running');
  assert.equal(jump.dodges, 0);
  step(jump, 0.2);
  assert.equal(jump.dodges, 1);
});
test('the opening provides a coin trail and shield before the first obstacle', () => {
  const game = new RunnerEngine(() => 0.1);
  game.start();
  const shield = game.objects.find((o) => o.type === 'shield');
  const hazard = game.objects.find((o) => o.type === 'train');
  assert.equal(shield.lane, 1);
  assert.ok(shield.z < hazard.z);
  assert.ok(game.objects.some((o) => o.type === 'coin' && o.z < shield.z));
});

test('entering a low obstacle lane after its front passes still collides', () => {
  for (const type of ['barrier', 'gate', 'crate']) {
    const game = running();
    game.lane = game.visualLane = 0;
    game.objects = [{ type, lane: 1, z: 9.1 }];
    game.update(0.01);
    assert.equal(game.state, 'running');
    game.action('right');
    step(game, 0.04);
    assert.equal(game.state, 'over', type);
    assert.equal(game.crashReason, type);
  }
});
test('a slide ending while inside a gate is not counted as a clear', () => {
  const game = running();
  game.slideTime = 0.03;
  obstacle(game, 'gate');
  step(game, 0.08);
  assert.equal(game.state, 'over');
  assert.equal(game.dodges, 0);
});
test('a full clearance earns one clear, but a shield collision earns none', () => {
  const clear = running();
  clear.action('slide');
  obstacle(clear, 'gate');
  step(clear, 0.3);
  assert.equal(clear.state, 'running');
  assert.equal(clear.dodges, 1);
  step(clear, 0.3);
  assert.equal(clear.dodges, 1);
  const protectedRun = running();
  protectedRun.shieldTime = 12;
  obstacle(protectedRun, 'crate');
  step(protectedRun, 0.3);
  assert.equal(protectedRun.state, 'running');
  assert.equal(protectedRun.dodges, 0);
});
test('invalid difficulty values fall back without accepting inherited properties', () => {
  for (const mode of ['constructor', '__proto__', 'toString', '', null]) {
    const game = running();
    game.start(mode);
    assert.equal(game.mode, 'classic');
    assert.equal(game.speed, MODES.classic.start);
  }
});
test('invalid and nonpositive time steps cannot corrupt simulation state', () => {
  const game = running();
  obstacle(game, 'train');
  const before = JSON.stringify(game);
  for (const dt of [NaN, Infinity, -Infinity, -1, 0, undefined, '0.05']) game.update(dt);
  assert.equal(JSON.stringify(game), before);
  game.update(0.01);
  assert.ok(Number.isFinite(game.distance));
});
test('long runs remain bounded and keep the difficulty speed limit', () => {
  for (const mode of Object.keys(MODES)) {
    const game = new RunnerEngine(() => 0.1);
    game.start(mode);
    // This deterministic generator reserves lane zero as its safe route.
    game.lane = game.visualLane = 0;
    let maxObjects = 0;
    for (let i = 0; i < 36000; i++) {
      game.update(0.05);
      maxObjects = Math.max(maxObjects, game.objects.length);
    }
    assert.equal(game.state, 'running');
    assert.equal(game.speed, MODES[mode].max);
    assert.ok(maxObjects < 100, `${mode} retained ${maxObjects} objects`);
    assert.ok(game.objects.every((o) => Number.isFinite(o.z)));
  }
});

test('restarts reuse the same object, event, and effect buffers with fresh flags', () => {
  const game = new RunnerEngine(() => 0.1);
  const slots = game.objectSlots,
    objects = game.objects,
    events = game.events,
    effects = game.effects;
  for (let i = 0; i < 1000; i++) {
    game.start();
    assert.equal(game.objectSlots, slots);
    assert.equal(game.objects, objects);
    assert.equal(game.events, events);
    assert.equal(game.effects, effects);
    assert.ok(game.objects.every((o) => !o.collected && !o.checked && !o.cleared && !o.destroyed));
    assert.equal(game.objects.length + game.freeObjects.length, 128);
    assert.equal(new Set([...game.objects, ...game.freeObjects]).size, 128);
    for (const o of game.objects) {
      o.collected = true;
      o.checked = true;
      o.cleared = true;
      o.destroyed = true;
    }
  }
});
test('passed objects are returned to the pool and reused without retaining stale flags', () => {
  const game = running();
  game.addObject('coin', 1, 9);
  const coin = game.objects[0];
  game.update(0.01);
  assert.equal(game.objects.length, 0);
  assert.equal(game.freeObjects.length, 128);
  game.addObject('gate', 2, 200);
  assert.equal(game.objects[0], coin);
  assert.equal(coin.type, 'gate');
  assert.equal(coin.collected, false);
  assert.equal(coin.checked, false);
});
test('the pool never expands if extra objects are requested beyond its budget', () => {
  const game = running();
  for (let i = 0; i < 10000; i++) game.addObject('coin', 0, 200);
  assert.equal(game.objects.length, 128);
  assert.equal(game.freeObjects.length, 0);
  game.clearObjects();
  assert.equal(game.freeObjects.length, 128);
});
