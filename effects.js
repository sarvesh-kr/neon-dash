/* A fixed-size particle pool keeps feedback bounded on phones and long runs. */
(() => {
  'use strict';
  const pool = Array.from({ length: 64 }, () => ({ life: 0 }));
  let cursor = 0,
    seed = 521;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  function emit(type, x, y, color, target) {
    const count = type === 'coin' ? 5 : type === 'land' ? 6 : type === 'crash' ? 22 : 12;
    for (let i = 0; i < count; i++) {
      const p = pool[cursor++ % pool.length],
        angle = random() * Math.PI * 2;
      const speed = (type === 'coin' ? 25 : 65) * (0.4 + random());
      Object.assign(p, {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 18,
        life: type === 'crash' ? 0.45 : 0.3,
        total: type === 'crash' ? 0.45 : 0.3,
        size: type === 'land' ? 3 : 2 + random() * 2,
        color,
        target: target || null,
        dust: type === 'land',
      });
    }
  }
  function step(dt) {
    let active = 0;
    for (const p of pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) continue;
      if (p.target) {
        const factor = 1 - Math.exp(-dt * 12);
        p.x += (p.target.x - p.x) * factor;
        p.y += (p.target.y - p.y) * factor;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += dt * (p.dust ? 25 : 100);
      }
      active++;
    }
    return active;
  }
  function draw(ctx) {
    for (const p of pool) {
      if (p.life <= 0) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.total) * (p.dust ? 0.3 : 0.9);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
  window.NeonEffects = {
    emit,
    step,
    draw,
    reset() {
      for (const p of pool) p.life = 0;
    },
    get capacity() {
      return pool.length;
    },
  };
})();
