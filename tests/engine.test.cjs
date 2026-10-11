const test = require('node:test');
const assert = require('node:assert/strict');
const { RunnerEngine, MODES, GEOMETRY } = require('../engine.js');

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
    game.update(0.03);
    assert.ok(game[property] <= duration && game[property] >= duration - 0.03);
    assert.ok(game.events.includes(type));
    const remaining = game[property];
    game.pause();
    game.update(0.05);
    assert.equal(game[property], remaining);
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

test('each solid obstacle uses its own lateral edge, without hitting decorative glow', () => {
  for (const type of ['train', 'barrier', 'crate']) {
    const edge = GEOMETRY[type].halfWidth + GEOMETRY.runner.halfWidth;
    for (const [offset, expected] of [
      [edge - 0.001, 'over'],
      [edge, 'running'],
      [edge + 0.001, 'running'],
    ]) {
      const game = running();
      game.lane = game.visualLane = 1 + offset;
      game.addObject(type, 1, 8.5);
      game.update(1 / 120);
      assert.equal(game.state, expected, `${type}, offset ${offset}`);
    }
  }
});
test('fast diagonal travel cannot tunnel through a thin obstacle between ticks', () => {
  const game = running();
  game.start('rush');
  game.clearObjects();
  game.time = 10000;
  game.visualLane = 0;
  game.lane = 2;
  game.addObject('barrier', 1, 9.3);
  game.update(0.05);
  assert.equal(game.state, 'over');
});
test('crossing a lane before an obstacle reaches the runner is not a collision', () => {
  const game = running();
  game.start('rush');
  game.clearObjects();
  game.time = 10000;
  game.visualLane = 0;
  game.lane = 2;
  game.addObject('barrier', 0, 10.9);
  game.update(0.05);
  assert.equal(game.state, 'running');
});
test('jump clearance follows the visible barrier and crate heights', () => {
  for (const [type, elevation, expected] of [
    ['barrier', 0.8, 'running'],
    ['crate', 0.88, 'over'],
    ['crate', 1.05, 'running'],
  ]) {
    const game = running();
    game.jumpHeight = elevation;
    game.jumpTime = 0.46 * (1 + Math.sqrt(1 - elevation / 1.7));
    game.addObject(type, 1, 8.5);
    game.update(1 / 120);
    assert.equal(game.state, expected, type);
  }
});
test('sliding clears a gate opening but cannot pass through its solid posts', () => {
  for (const [offset, expected] of [
    [0, 'running'],
    [-GEOMETRY.gate.postOffset, 'over'],
    [GEOMETRY.gate.postOffset, 'over'],
  ]) {
    const game = running();
    game.lane = game.visualLane = 1 + offset;
    game.action('slide');
    game.addObject('gate', 1, 8.5);
    game.update(1 / 120);
    assert.equal(game.state, expected);
  }
});
test('a train remains solid at the highest jump point', () => {
  const game = running();
  game.jumpTime = 0.46;
  game.jumpHeight = 1.7;
  game.addObject('train', 1, 8.5);
  game.update(1 / 120);
  assert.equal(game.state, 'over');
});
test('passed obstacle tails do not create invisible collisions', () => {
  for (const type of ['train', 'barrier', 'crate', 'gate']) {
    const game = running();
    game.addObject(
      type,
      1,
      GEOMETRY.runner.z - GEOMETRY.runner.halfDepth - GEOMETRY[type].length - 0.01,
    );
    game.update(1 / 120);
    assert.equal(game.state, 'running', type);
  }
});
test('pickups require physical contact, including jump height and lateral distance', () => {
  for (const [z, offset, jumping, expected] of [
    [10, 0, false, 0],
    [8.5, 0.5, false, 0],
    [8.5, 0, true, 0],
    [8.5, 0, false, 1],
  ]) {
    const game = running();
    game.lane = game.visualLane = 1 + offset;
    if (jumping) {
      game.jumpTime = 0.46;
      game.jumpHeight = 1.7;
    }
    game.addObject('coin', 1, z);
    game.update(1 / 120);
    assert.equal(game.coins, expected);
  }
});
test('fast travel collects a pickup crossed completely within a tick', () => {
  const game = running();
  game.start('rush');
  game.clearObjects();
  game.time = 10000;
  game.addObject('coin', 1, 9.5);
  game.update(0.05);
  assert.equal(game.coins, 1);
  assert.equal(game.objects.length, 0);
});
test('a shield reached before a hazard protects the runner regardless of drawing order', () => {
  for (const reverse of [false, true]) {
    const game = running();
    game.start('rush');
    game.clearObjects();
    game.time = 10000;
    game.addObject('shield', 1, 9.5);
    game.addObject('train', 1, 10);
    if (reverse) game.objects.reverse();
    game.update(0.05);
    assert.equal(game.state, 'running');
    assert.deepEqual(game.events, ['shield', 'shield-break']);
  }
});
test('a fatal collision cannot award a pickup that would arrive later in the tick', () => {
  for (const type of ['shield', 'coin']) {
    const game = running();
    game.start('rush');
    game.clearObjects();
    game.time = 10000;
    game.addObject(type, 1, 9.5);
    game.addObject('train', 1, 8.5);
    game.update(0.05);
    assert.equal(game.state, 'over');
    assert.equal(game.shieldTime, 0);
    assert.equal(game.coins, 0);
    assert.deepEqual(game.events, ['crash']);
    assert.equal(game.contacts.length, 0);
  }
});

test('a wider portrait core can still slide through the gate and clear an adjacent lane', () => {
  const game = running();
  game.runnerHalfWidth = 0.4;
  game.action('slide');
  game.addObject('gate', 1, 8.5);
  game.addObject('train', 0, 8.5);
  game.update(1 / 120);
  assert.equal(game.state, 'running');
});

test('a crash freezes travel at the actual contact instead of the end of the tick', () => {
  const game = running();
  game.start('rush');
  game.clearObjects();
  game.time = 10000;
  game.addObject('train', 1, 10);
  game.update(0.05);
  assert.equal(game.state, 'over');
  assert.ok(Math.abs(game.distance - (10 - GEOMETRY.runner.z - GEOMETRY.runner.halfDepth)) < 1e-5);
  assert.ok(Math.abs(game.objects[0].z - GEOMETRY.runner.z - GEOMETRY.runner.halfDepth) < 1e-5);
});
test('shield expiry is evaluated at contact, rather than at the end of the tick', () => {
  for (const [z, expected] of [
    [8.5, 'running'],
    [10, 'over'],
  ]) {
    const game = running();
    game.start('rush');
    game.clearObjects();
    game.time = 10000;
    game.shieldTime = 0.01;
    game.addObject('train', 1, z);
    game.update(0.05);
    assert.equal(game.state, expected);
  }
});
test('immunity expiring inside an obstacle does not postpone contact until the next tick', () => {
  const game = running();
  game.invulnerable = 0.01;
  game.addObject('train', 1, 8.5);
  game.update(0.05);
  assert.equal(game.state, 'over');
  assert.ok(Math.abs(game.time - 0.01) < 1e-9);
});

test('train tails remain available until their entire body passes the render clipping plane', () => {
  const game = running();
  game.addObject('train', 0, -18);
  game.update(1 / 120);
  assert.equal(game.objects.length, 1);
  step(game, 0.15);
  assert.equal(game.objects.length, 0);
  assert.equal(game.freeObjects.length, 128);
});
