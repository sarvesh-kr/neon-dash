/* Pre-render collectible artwork so glowing coins do not blur or draw text per frame. */
(() => {
  'use strict';
  const atlas = document.createElement('canvas');
  const spriteCount = 10;
  function sprite(type, spin = 1) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.translate(64, 64);
    const color = type === 'coin' ? '#ffd67b' : type === 'shield' ? '#a7f7cf' : '#88caff';
    const glow = ctx.createRadialGradient(0, 0, 12, 0, 0, 58);
    glow.addColorStop(0, color + '65');
    glow.addColorStop(1, color + '00');
    ctx.fillStyle = glow;
    ctx.fillRect(-64, -64, 128, 128);
    ctx.save();
    if (type === 'coin') ctx.scale(spin, 1);
    const fill = ctx.createLinearGradient(-25, -30, 25, 30);
    fill.addColorStop(0, type === 'coin' ? '#fff1bd' : '#284662');
    fill.addColorStop(1, type === 'coin' ? '#e6a338' : '#112237');
    ctx.fillStyle = fill;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.strokeStyle = type === 'coin' ? '#a96a2680' : color + '60';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (type === 'coin') {
      ctx.fillStyle = '#b37a2e';
      ctx.beginPath();
      ctx.moveTo(6, -20);
      ctx.lineTo(-12, 3);
      ctx.lineTo(0, 3);
      ctx.lineTo(-5, 21);
      ctx.lineTo(14, -5);
      ctx.lineTo(2, -5);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'shield') {
      ctx.fillStyle = '#a7f7cf20';
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -19);
      ctx.lineTo(17, -12);
      ctx.lineTo(15, 5);
      ctx.quadraticCurveTo(12, 15, 0, 21);
      ctx.quadraticCurveTo(-12, 15, -15, 5);
      ctx.lineTo(-17, -12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.lineTo(-1, 6);
      ctx.lineTo(9, -7);
      ctx.stroke();
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = 8;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(-13, -15);
      ctx.lineTo(-13, 3);
      ctx.arc(0, 3, 13, Math.PI, 0, true);
      ctx.lineTo(13, -15);
      ctx.stroke();
      ctx.strokeStyle = '#f2f8ff';
      ctx.lineWidth = 5;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * 13, -15);
        ctx.lineTo(side * 13, -7);
        ctx.stroke();
      }
    }
    ctx.restore();
    return canvas;
  }
  function ensure() {
    if (atlas.width === 640 && atlas.height === 256) return;
    atlas.width = 640;
    atlas.height = 256;
    const ctx = atlas.getContext('2d');
    for (let i = 0; i < spriteCount; i++) {
      const image =
        i < 8
          ? sprite('coin', 0.3 + Math.abs(Math.cos((i / 8) * Math.PI)) * 0.7)
          : sprite(i === 8 ? 'shield' : 'magnet');
      ctx.drawImage(image, (i % 5) * 128, Math.floor(i / 5) * 128);
      image.width = image.height = 0;
    }
  }
  window.NeonItems = {
    ensure,
    release() {
      atlas.width = atlas.height = 0;
    },
    draw(ctx, type, x, y, radius, phase = 0) {
      ensure();
      const index = type === 'coin' ? Math.floor(phase) % 8 : type === 'shield' ? 8 : 9;
      ctx.drawImage(
        atlas,
        (index % 5) * 128,
        Math.floor(index / 5) * 128,
        128,
        128,
        x - radius * 2,
        y - radius * 2,
        radius * 4,
        radius * 4,
      );
    },
  };
})();
