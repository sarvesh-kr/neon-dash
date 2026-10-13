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
      const p = pool[cursor],
        angle = random() * Math.PI * 2;
      cursor = (cursor + 1) % pool.length;
      const speed = (type === 'coin' ? 25 : 65) * (0.4 + random());
      Object.assign(p, {
        x,
        y,
        previousX: x,
        previousY: y,
        glint: type === 'coin',
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 18,
        life: type === 'crash' ? 0.45 : 0.3,
        total: type === 'crash' ? 0.45 : 0.3,
        size: type === 'land' ? 3 : 2 + random() * 2,
        color,
        attracted: !!target,
        targetX: target?.x ?? 0,
        targetY: target?.y ?? 0,
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
      p.previousX = p.x;
      p.previousY = p.y;
      if (p.attracted) {
        const factor = 1 - Math.exp(-dt * 12);
        p.x += (p.targetX - p.x) * factor;
        p.y += (p.targetY - p.y) * factor;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += dt * (p.dust ? 25 : 100);
        const drag = Math.exp(-dt * (p.dust ? 3 : 1.3));
        p.vx *= drag;
        p.vy *= drag;
      }
      active++;
    }
    return active;
  }
  function draw(ctx) {
    for (const p of pool) {
      if (p.life <= 0) continue;
      const ratio = Math.max(0, p.life / p.total),
        progress = 1 - ratio;
      ctx.globalAlpha = ratio * ratio * (p.dust ? 0.32 : 0.92);
      ctx.fillStyle = p.color;
      if (p.dust) {
        ctx.beginPath();
        ctx.ellipse(
          p.x,
          p.y,
          p.size * (1 + progress * 1.5),
          p.size * (0.5 + progress * 0.4),
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      } else if (p.glint) {
        const angle = progress * Math.PI,
          c = Math.cos(angle) * p.size,
          s = Math.sin(angle) * p.size;
        ctx.beginPath();
        ctx.moveTo(p.x + c, p.y + s);
        ctx.lineTo(p.x - s, p.y + c);
        ctx.lineTo(p.x - c, p.y - s);
        ctx.lineTo(p.x + s, p.y - c);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fff7db';
        ctx.fillRect(p.x - 0.5, p.y - 0.5, 1, 1);
      } else {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.size * 0.7);
        ctx.beginPath();
        ctx.moveTo(p.previousX, p.previousY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
  window.NeonEffects = {
    emit,
    step,
    draw,
    reset() {
      for (const p of pool) {
        p.life = 0;
        p.attracted = false;
        p.targetX = p.targetY = 0;
      }
    },
    get capacity() {
      return pool.length;
    },
  };
})();
