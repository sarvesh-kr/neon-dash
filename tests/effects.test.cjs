const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
test('particles copy projection targets and stay bounded through repeated emission/reset', () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync(require.resolve('../effects.js'), 'utf8'), { window });
  const effects = window.NeonEffects,
    target = { x: 100, y: 100 };
  effects.emit('coin', 0, 0, '#fff', target);
  target.x = target.y = 99999;
  effects.step(0.05);
  const positions = [];
  effects.draw({
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {},
    ellipse() {},
    stroke() {},
    set globalAlpha(value) {},
    set fillStyle(value) {},
    fillRect(x, y) {
      positions.push([x, y]);
    },
  });
  assert.ok(positions.length > 0 && positions.every(([x, y]) => x < 100 && y < 100));
  for (let i = 0; i < 10000; i++) effects.emit('coin', 0, 0, '#fff', target);
  assert.equal(effects.capacity, 64);
  effects.reset();
  assert.equal(effects.step(0.05), 0);
});
