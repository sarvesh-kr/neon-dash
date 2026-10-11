const test = require('node:test');
const assert = require('node:assert/strict');
const { NeonSwipe } = require('../input.js');

test('four directions respond before release and only once per contact', () => {
  for (const [x, y, direction] of [
    [150, 200, 'left'],
    [250, 200, 'right'],
    [200, 150, 'jump'],
    [200, 250, 'slide'],
  ]) {
    const swipe = new NeonSwipe();
    assert.equal(swipe.begin(1, 200, 200, 390), true);
    assert.equal(swipe.move(1, x, y), direction);
    assert.equal(swipe.move(1, x * 2, y * 2), null);
    assert.equal(swipe.end(1, x, y), null);
    assert.equal(swipe.id, null);
  }
});
test('tap and stationary hold jitter never move the runner', () => {
  const swipe = new NeonSwipe();
  swipe.begin(1, 200, 200, 390);
  for (let i = 0; i < 1000; i++) assert.equal(swipe.move(1, 205, 203), null);
  assert.equal(swipe.end(1, 205, 203), null);
});
test('touch slop uses CSS width and stays usable on small and large screens', () => {
  for (const [width, threshold] of [
    [200, 14],
    [390, 15.6],
    [1440, 24],
  ]) {
    const swipe = new NeonSwipe();
    swipe.begin(1, 0, 0, width);
    assert.equal(swipe.move(1, threshold - 0.01, 0), null);
    assert.equal(swipe.move(1, threshold, 0), 'right');
  }
});
test('ambiguous diagonal movement waits for a deliberate axis', () => {
  const swipe = new NeonSwipe();
  swipe.begin(1, 200, 200, 390);
  assert.equal(swipe.move(1, 220, 221), null);
  assert.equal(swipe.move(1, 250, 222), 'right');
});
test('a completed diagonal resolves once at release using the dominant axis', () => {
  const swipe = new NeonSwipe();
  swipe.begin(1, 200, 200, 390);
  assert.equal(swipe.move(1, 220, 221), null);
  assert.equal(swipe.end(1, 220, 221), 'slide');
  assert.equal(swipe.end(1, 220, 221), null);
});
test('extra fingers cannot replace or finish the primary contact', () => {
  const swipe = new NeonSwipe();
  swipe.begin(1, 200, 200, 390);
  assert.equal(swipe.begin(2, 200, 200, 390), false);
  assert.equal(swipe.move(2, 250, 200), null);
  assert.equal(swipe.end(2, 250, 200), null);
  swipe.cancel(2);
  assert.equal(swipe.id, 1);
  assert.equal(swipe.move(1, 250, 200), 'right');
  assert.equal(swipe.begin(2, 200, 200, 390), false);
  swipe.end(1, 250, 200);
  assert.equal(swipe.begin(2, 200, 200, 390), true);
});
test('cancellation and viewport/state resets discard stale gesture coordinates', () => {
  const swipe = new NeonSwipe();
  swipe.begin(1, 200, 200, 390);
  swipe.cancel(1);
  assert.equal(swipe.move(1, 250, 200), null);
  swipe.begin(2, 200, 200, 390);
  swipe.reset();
  assert.equal(swipe.end(2, 250, 200), null);
  assert.equal(swipe.begin(3, 200, 200, 390), true);
  assert.equal(swipe.move(3, 150, 200), 'left');
});
test('invalid coordinates cannot consume a gesture or create an action', () => {
  const swipe = new NeonSwipe();
  assert.equal(swipe.begin(1, NaN, 200, 390), false);
  swipe.begin(1, 200, 200, 390);
  assert.equal(swipe.move(1, Infinity, 200), null);
  assert.equal(swipe.move(1, 250, NaN), null);
  assert.equal(swipe.end(1, 250, 200), 'right');
});
