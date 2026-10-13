const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { GEOMETRY } = require('../engine.js');
const source = fs.readFileSync(require.resolve('../renderer3d.js'), 'utf8');

function harness(options = {}) {
  const live = new Map();
  let next = 0,
    lost = false;
  const gl = {
    getExtension: () => ({
      loseContext() {
        lost = true;
      },
    }),
  };
  for (const [index, name] of [
    'VERTEX_SHADER',
    'FRAGMENT_SHADER',
    'COMPILE_STATUS',
    'LINK_STATUS',
    'ARRAY_BUFFER',
    'STATIC_DRAW',
    'DYNAMIC_DRAW',
    'FLOAT',
    'CULL_FACE',
    'BLEND',
    'DEPTH_TEST',
    'TRIANGLES',
    'DEPTH_BUFFER_BIT',
    'LEQUAL',
  ].entries())
    gl[name] = index + 1;
  for (const name of ['Program', 'Shader', 'Buffer', 'VertexArray']) {
    gl[`create${name}`] = () => {
      const resource = { id: ++next, name };
      live.set(resource.id, resource);
      return resource;
    };
    gl[`delete${name}`] = (resource) => {
      if (resource) live.delete(resource.id);
    };
  }
  for (const name of [
    'shaderSource',
    'compileShader',
    'attachShader',
    'linkProgram',
    'bindVertexArray',
    'bindBuffer',
    'bufferData',
    'enableVertexAttribArray',
    'vertexAttribPointer',
    'vertexAttribDivisor',
    'disable',
    'enable',
    'viewport',
    'depthMask',
    'useProgram',
    'uniform1f',
    'uniform2f',
    'uniform3fv',
    'uniform4f',
    'drawArrays',
    'drawArraysInstanced',
    'depthFunc',
    'clear',
  ])
    gl[name] = () => {};
  gl.bufferSubData = (_, offset, data, first, length) => {
    assert.equal(offset, 0);
    assert.equal(first, 0);
    assert.ok(length <= data.length, 'Upload exceeded its reusable CPU buffer');
    for (let i = 0; i < length; i++) assert.ok(Number.isFinite(data[i]), 'Nonfinite scene data');
  };
  gl.getShaderParameter = () => !options.shaderFailure;
  gl.getProgramParameter = () => true;
  gl.getUniformLocation = (_, name) => name;
  const canvas = {
    width: 300,
    height: 150,
    hidden: false,
    events: {},
    getContext: () => (options.unsupported ? null : gl),
    setAttribute() {},
    addEventListener(name, handler) {
      this.events[name] = handler;
    },
  };
  const document = { hidden: !!options.hidden, createElement: () => canvas };
  const window = { devicePixelRatio: 3 };
  let inserted = 0;
  vm.runInNewContext(source, { window, document });
  const renderer = window.Neon3D.create(
    {
      before() {
        inserted++;
      },
    },
    GEOMETRY,
  );
  return {
    renderer,
    gl,
    live,
    canvas,
    document,
    inserted,
    get lost() {
      return lost;
    },
  };
}

test('unsupported WebGL leaves the original play surface available', () => {
  const h = harness({ unsupported: true });
  assert.equal(h.renderer, null);
  assert.equal(h.inserted, 0);
  assert.equal(h.live.size, 0);
});
test('failed shader initialization deletes every partial GPU resource', () => {
  const h = harness({ shaderFailure: true });
  assert.equal(h.renderer, null);
  assert.equal(h.live.size, 0);
  assert.equal(h.inserted, 0);
  assert.ok(h.lost);
});
test('resize, quality changes, and repeated hide/restore reuse fixed instance buffers', () => {
  const h = harness(),
    r = h.renderer,
    buffers = r.batches.map((batch) => batch.data);
  assert.ok(r.active);
  assert.equal(h.live.size, 19);
  for (let i = 0; i < 100; i++) {
    r.resize(i % 2 ? 390 : 1440, i % 2 ? 844 : 900);
    assert.ok(r.stats.pixels <= 1200000);
    r.release();
    assert.equal(h.live.size, 0);
    assert.equal(r.stats.pixels, 1);
    r.resize(390, 844);
    assert.equal(h.live.size, 19);
  }
  for (let i = 0; i < buffers.length; i++) assert.equal(r.batches[i].data, buffers[i]);
  r.setQuality('detailed');
  assert.ok(r.stats.pixels <= 1800000);
  r.setQuality('smooth');
  assert.ok(r.stats.pixels <= 600000);
  r.setQuality('__proto__');
  assert.equal(r.quality, 'smooth');
});
test('instance saturation drops excess geometry without growing memory', () => {
  const r = harness().renderer,
    buffer = r.batches[0].data;
  for (let i = 0; i < 10000; i++) r.box(0, 1, 10, 1, 1, 1, 0xffffff);
  assert.equal(r.batches[0].count, 4096);
  assert.equal(r.batches[0].data, buffer);
  assert.equal(r.stats.overflow, 10000 - 4096);
});
test('adaptive quality responds only to sustained slow active gameplay', () => {
  const r = harness().renderer;
  r.resize(390, 844);
  for (let i = 0; i < 180; i++) r.observeFrame(0.04, false);
  assert.equal(r.scale, 1);
  for (let i = 0; i < 63; i++) r.observeFrame(0.04, true);
  assert.equal(r.scale, 0.75);
  assert.ok(r.stats.pixels <= 900000);
  for (let i = 0; i < 1000; i++) r.observeFrame(0.04, true);
  assert.equal(r.scale, 0.55);
  assert.ok(r.stats.pixels <= 660000);
  r.setQuality('detailed');
  for (let i = 0; i < 180; i++) r.observeFrame(0.04, true);
  assert.equal(r.scale, 1);
});
test('projection preserves lane order and uses world elevation for jump feedback', () => {
  const r = harness().renderer;
  r.resize(390, 844);
  const left = r.project(-1, GEOMETRY.runner.z).x;
  const center = r.project(0, GEOMETRY.runner.z).x;
  const right = r.project(1, GEOMETRY.runner.z).x;
  const feet = r.project(0, GEOMETRY.runner.z).y;
  const airborne = r.project(0, GEOMETRY.runner.z, 1.7).y;
  assert.ok(left < center && center < right);
  assert.equal(center, 195);
  assert.ok(airborne < feet);
});
test('context recovery while hidden postpones GPU allocations until visible', () => {
  const h = harness(),
    r = h.renderer;
  r.resize(390, 844);
  h.canvas.events.webglcontextlost({ preventDefault() {} });
  h.live.clear();
  assert.equal(r.active, false);
  assert.equal(h.canvas.hidden, true);
  h.document.hidden = true;
  h.canvas.events.webglcontextrestored();
  assert.equal(h.live.size, 0);
  assert.equal(r.released, true);
  h.document.hidden = false;
  r.resize(390, 844);
  assert.equal(h.live.size, 19);
  assert.equal(r.active, true);
  assert.equal(h.canvas.hidden, false);
});

test('a background launch waits for visibility before allocating GPU resources', () => {
  const h = harness({ hidden: true });
  assert.ok(h.renderer.active);
  assert.equal(h.live.size, 0);
  assert.equal(h.renderer.stats.pixels, 1);
  h.document.hidden = false;
  h.renderer.resize(390, 844);
  assert.equal(h.live.size, 19);
});
