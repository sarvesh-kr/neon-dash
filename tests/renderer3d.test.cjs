const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { GEOMETRY, RunnerEngine } = require('../engine.js');
const source =
  fs.readFileSync(require.resolve('../motion.js'), 'utf8') +
  fs.readFileSync(require.resolve('../runner-model.js'), 'utf8') +
  fs.readFileSync(require.resolve('../render-pipeline.js'), 'utf8') +
  fs.readFileSync(require.resolve('../renderer3d.js'), 'utf8');

function harness(options = {}) {
  const live = new Map();
  let next = 0,
    lost = false;
  const gl = {
    getExtension: (name) =>
      name === 'EXT_color_buffer_float'
        ? options.ldr
          ? null
          : {}
        : {
            loseContext() {
              lost = true;
            },
          },
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
    'TEXTURE_2D',
    'TEXTURE_MIN_FILTER',
    'TEXTURE_MAG_FILTER',
    'TEXTURE_WRAP_S',
    'TEXTURE_WRAP_T',
    'NEAREST',
    'LINEAR',
    'CLAMP_TO_EDGE',
    'FRAMEBUFFER',
    'COLOR_ATTACHMENT0',
    'DEPTH_ATTACHMENT',
    'NONE',
    'RGBA16F',
    'RGBA8',
    'RGBA',
    'DEPTH_COMPONENT24',
    'DEPTH_COMPONENT',
    'UNSIGNED_INT',
    'HALF_FLOAT',
    'UNSIGNED_BYTE',
    'FRAMEBUFFER_COMPLETE',
    'POLYGON_OFFSET_FILL',
    'TEXTURE0',
    'TEXTURE1',
    'TEXTURE2',
    'UNPACK_FLIP_Y_WEBGL',
  ].entries())
    gl[name] = index + 1;
  for (const name of ['Program', 'Shader', 'Buffer', 'VertexArray', 'Texture', 'Framebuffer']) {
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
    'bindTexture',
    'texParameteri',
    'framebufferTexture2D',
    'bindFramebuffer',
    'drawBuffers',
    'readBuffer',
    'texImage2D',
    'polygonOffset',
    'uniformMatrix4fv',
    'activeTexture',
    'uniform1i',
    'pixelStorei',
  ])
    gl[name] = () => {};
  gl.bufferSubData = (_, offset, data, first, length) => {
    assert.equal(offset, 0);
    assert.equal(first, 0);
    assert.ok(length <= data.length, 'Upload exceeded its reusable CPU buffer');
    for (let i = 0; i < length; i++) assert.ok(Number.isFinite(data[i]), 'Nonfinite scene data');
  };
  let framebufferChecks = 0;
  gl.checkFramebufferStatus = () =>
    options.framebufferFailure || (options.rejectHDR && ++framebufferChecks === 1)
      ? 0
      : gl.FRAMEBUFFER_COMPLETE;
  gl.getShaderParameter = () => !options.shaderFailure;
  gl.getProgramParameter = () => true;
  gl.getUniformLocation = (_, name) => name;
  const canvas = {
    width: 300,
    height: 150,
    hidden: false,
    events: {},
    getContext: (type) =>
      type === '2d' ? { clearRect() {}, fillText() {} } : options.unsupported ? null : gl,
    setAttribute() {},
    addEventListener(name, handler) {
      this.events[name] = handler;
    },
  };
  const document = {
    hidden: !!options.hidden,
    createElement: () =>
      next === 0
        ? canvas
        : { width: 0, height: 0, getContext: () => ({ clearRect() {}, fillText() {} }) },
  };
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
  assert.equal(h.live.size, 53);
  for (let i = 0; i < 100; i++) {
    r.resize(i % 2 ? 390 : 1440, i % 2 ? 844 : 900);
    assert.ok(r.stats.pixels <= 1200000);
    r.release();
    assert.equal(h.live.size, 0);
    assert.equal(r.stats.pixels, 1);
    r.resize(390, 844);
    assert.equal(h.live.size, 53);
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
  assert.equal(h.live.size, 53);
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
  assert.equal(h.live.size, 53);
});

test('HDR targets and quality effects resize without growing the GPU handle pool', () => {
  const h = harness(),
    r = h.renderer;
  r.resize(390, 844);
  const handles = [...h.live.keys()];
  assert.equal(r.stats.hdr, true);
  assert.equal(r.stats.shadows, true);
  assert.equal(r.stats.bloom, true);
  assert.ok(r.stats.targetPixels <= r.stats.pixels * 2.125 + 768 * 768);
  r.setQuality('smooth');
  assert.equal(r.stats.shadows, false);
  assert.equal(r.stats.bloom, false);
  assert.equal(r.pipeline.shadowSize, 1);
  assert.equal(r.pipeline.bloomWidth, 1);
  assert.equal(r.stats.targetPixels, r.stats.pixels * 2 + 3);
  r.setQuality('detailed');
  assert.equal(r.pipeline.shadowSize, 1024);
  assert.deepEqual([...h.live.keys()], handles);
  r.release();
  assert.equal(h.live.size, 0);
  assert.equal(r.glyphCanvas.width, 0);
});
test('missing float render targets retain a complete LDR pipeline', () => {
  const h = harness({ ldr: true }),
    r = h.renderer;
  r.resize(390, 844);
  assert.ok(r.active);
  assert.equal(r.stats.hdr, false);
  assert.equal(r.stats.bloom, true);
  r.release();
  assert.equal(h.live.size, 0);
});
test('incomplete framebuffer releases every resource and selects fallback', () => {
  const h = harness({ framebufferFailure: true }),
    r = h.renderer;
  r.resize(390, 844);
  assert.equal(r.active, false);
  assert.equal(h.live.size, 0);
  assert.equal(r.canvas.hidden, true);
});

test('a driver rejecting a float framebuffer retries with LDR and retains 3D', () => {
  const h = harness({ rejectHDR: true }),
    r = h.renderer;
  r.resize(390, 844);
  assert.ok(r.active);
  assert.equal(r.stats.hdr, false);
  assert.equal(h.live.size, 53);
  r.release();
  assert.equal(h.live.size, 0);
});

function geometryBounds(r) {
  let low = Infinity,
    high = -Infinity,
    left = Infinity,
    right = -Infinity;
  for (const batch of r.batches)
    for (let i = 0; i < batch.count; i++) {
      const d = batch.data,
        o = i * 16,
        qx = d[o + 6],
        qy = d[o + 7],
        qz = d[o + 8],
        qw = d[o + 9];
      for (let v = 0; v < batch.mesh.length; v += 6) {
        const x = batch.mesh[v] * d[o + 3],
          y = batch.mesh[v + 1] * d[o + 4],
          z = batch.mesh[v + 2] * d[o + 5];
        const tx = 2 * (qy * z - qz * y),
          ty = 2 * (qz * x - qx * z),
          tz = 2 * (qx * y - qy * x);
        const xx = d[o] + x + qw * tx + qy * tz - qz * ty,
          yy = d[o + 1] + y + qw * ty + qz * tx - qx * tz;
        low = Math.min(low, yy);
        high = Math.max(high, yy);
        left = Math.min(left, xx);
        right = Math.max(right, xx);
      }
    }
  return { low, high, left, right };
}
test('pause and restored graphics keep exactly the rendered runner and scenery pose', () => {
  const r = harness().renderer,
    g = new RunnerEngine(() => 0.4);
  r.resize(390, 844);
  g.start('classic');
  for (let i = 0; i < 70; i++) {
    g.invulnerable = 100;
    g.update(1 / 120);
  }
  r.render(g, g.objects, g.visualLane, g.jumpHeight, 1, '#72f3cb', 1, 0, false);
  const data = r.batches.map((b) => b.data.slice(0, b.count * 16)),
    phase = r.runner.motion.phase;
  g.pause();
  r.render(g, g.objects, g.visualLane, g.jumpHeight, 100, '#72f3cb', 1, 0, false);
  r.batches.forEach((b, i) => assert.deepEqual(b.data.slice(0, b.count * 16), data[i]));
  r.release();
  r.resize(390, 844);
  r.render(g, g.objects, g.visualLane, g.jumpHeight, 100, '#72f3cb', 1, 0, false);
  r.batches.forEach((b, i) => assert.deepEqual(b.data.slice(0, b.count * 16), data[i]));
  assert.equal(r.runner.motion.phase, phase);
});
test('detailed runner keeps grounded soles above the floor and slides below gate clearance', () => {
  const r = harness().renderer,
    g = new RunnerEngine();
  g.start('classic');
  for (const slide of [0, 0.25, 0.5, 0.75, 1])
    for (const phase of [0, 0.7, 1.5, 3, 4.5]) {
      g.time = 0.7;
      g.slidePose = slide;
      g.landing = 0;
      r.batches.forEach((b) => (b.count = 0));
      r.runner.motion.sample(g, 0);
      r.runner.motion.phase = phase;
      r.runner.draw(g, 1, 0, false, 0);
      const bounds = geometryBounds(r);
      assert.ok(
        bounds.low >= -0.001,
        'Geometry sinks through the ground: ' + JSON.stringify(bounds),
      );
      if (slide === 1)
        assert.ok(bounds.high < GEOMETRY.gate.clearance, 'Slide geometry exceeds the gate opening');
    }
});
test('bobbing and rotated pickup models remain within their shared vertical collection bounds', () => {
  const r = harness().renderer;
  r.motionReduced = false;
  for (const type of ['coin', 'shield', 'magnet'])
    for (let i = 0; i < 24; i++) {
      r.batches.forEach((b) => (b.count = 0));
      r.obstacle({ type, lane: 1, z: 20, poolIndex: 0 }, i / 3, {});
      const bounds = geometryBounds(r),
        shape = GEOMETRY[type];
      assert.ok(
        bounds.low >= shape.bottom - 1e-6 && bounds.high <= shape.top + 1e-6,
        type + ' exceeds pickup bounds',
      );
      assert.ok(
        bounds.left >= -shape.halfWidth - 1e-6 && bounds.right <= shape.halfWidth + 1e-6,
        type + ' exceeds pickup width',
      );
    }
});
test('animated districts and detailed models reuse all buffers without overflow', () => {
  const h = harness(),
    r = h.renderer,
    g = new RunnerEngine(() => 0.4),
    buffers = r.batches.map((b) => b.data);
  r.resize(390, 844);
  g.start('rush');
  for (let i = 0; i < 90; i++) {
    g.invulnerable = 100;
    g.update(0.05);
    if (i % 15 === 0) g.action(i % 30 ? 'slide' : 'jump');
    r.render(g, g.objects, g.visualLane, g.jumpHeight, g.time, '#72f3cb', i % 3, 0, false);
    assert.equal(r.stats.overflow, 0);
    assert.equal(r.stats.resources, 53);
    assert.ok(r.stats.drawCalls <= 21);
  }
  r.batches.forEach((b, i) => assert.equal(b.data, buffers[i]));
});
