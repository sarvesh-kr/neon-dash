const test = require('node:test');
const assert = require('node:assert/strict');
const { NeonPreferences } = require('../storage.js');
function store(entries = []) {
  const data = new Map(entries);
  let writes = 0;
  return {
    data,
    get writes() {
      return writes;
    },
    getItem(key) {
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      writes++;
      data.set(key, String(value));
    },
  };
}
test('only three fixed keys can be written, regardless of how many runs are saved', () => {
  const storage = store([['another-app', 'keep']]);
  const preferences = new NeonPreferences(storage);
  for (let i = 1; i <= 10000; i++) {
    preferences.set('best', i);
    preferences.set('color', i % 2 ? 'blue' : 'pink');
    preferences.set('sound', i % 2 === 0);
    preferences.set('run-' + i, 'discard');
  }
  preferences.write('unexpected');
  assert.equal(storage.data.size, 4);
  assert.equal(storage.data.get('another-app'), 'keep');
  const bytes = [...storage.data]
    .filter(([k]) => k.startsWith('neon-dash-'))
    .reduce((n, [k, v]) => n + (k.length + v.length) * 2, 0);
  assert.ok(bytes < 160);
});
test('unchanged preferences do not perform synchronous storage writes', () => {
  const storage = store();
  const preferences = new NeonPreferences(storage);
  preferences.set('color', 'blue');
  for (let i = 0; i < 10000; i++) preferences.set('color', 'blue');
  assert.equal(storage.writes, 1);
});
test('valid saved scores and mute/color preferences survive loading', () => {
  const storage = store([
    ['neon-dash-best', '45678'],
    ['neon-dash-color', 'pink'],
    ['neon-dash-sound', 'false'],
  ]);
  const preferences = new NeonPreferences(storage);
  assert.equal(preferences.get('best'), 45678);
  assert.equal(preferences.get('color'), 'pink');
  assert.equal(preferences.get('sound'), false);
  assert.equal(storage.writes, 0);
});
test('corrupt and oversized owned values are repaired without clearing unrelated data', () => {
  const storage = store([
    ['neon-dash-best', 'Infinity'],
    ['neon-dash-color', 'x'.repeat(100000)],
    ['neon-dash-sound', 'garbage'],
    ['unrelated', 'stay'],
  ]);
  const preferences = new NeonPreferences(storage);
  assert.equal(preferences.get('best'), 0);
  assert.equal(preferences.get('color'), 'mint');
  assert.equal(preferences.get('sound'), true);
  assert.equal(storage.data.get('unrelated'), 'stay');
  assert.equal(storage.data.get('neon-dash-color'), 'mint');
  assert.equal(storage.writes, 3);
});
test('invalid names and values cannot extend the preference schema', () => {
  const storage = store();
  const preferences = new NeonPreferences(storage);
  for (const [name, value] of [
    ['__proto__', 'blue'],
    ['constructor', 1],
    ['best', NaN],
    ['best', -1],
    ['best', Number.MAX_SAFE_INTEGER + 1],
    ['color', 'constructor'],
    ['sound', 'false'],
  ]) {
    assert.equal(preferences.set(name, value), false);
  }
  assert.equal(storage.writes, 0);
  assert.equal(preferences.get('best'), 0);
});
test('blocked reads and quota failures keep preferences working in memory', () => {
  const preferences = new NeonPreferences({
    getItem() {
      throw Error('blocked');
    },
    setItem() {
      throw Error('quota');
    },
  });
  assert.equal(preferences.get('color'), 'mint');
  assert.equal(preferences.set('color', 'blue'), true);
  assert.equal(preferences.get('color'), 'blue');
  assert.equal(preferences.set('best', 42), true);
  assert.equal(preferences.get('best'), 42);
});
