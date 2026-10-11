/* A fixed 256 KiB light atlas replaces per-frame blur filters. */
(() => {
  'use strict';
  const atlas = document.createElement('canvas');
  const colors = ['#ffe8b1', '#ff9ddd', '#e2baff', '#a1ddff'];
  function ensure() {
    if (atlas.width === 512 && atlas.height === 128) return;
    atlas.width = 512;
    atlas.height = 128;
    const ctx = atlas.getContext('2d');
    for (let i = 0; i < colors.length; i++) {
      const x = i * 128 + 64,
        color = colors[i];
      const glow = ctx.createRadialGradient(x, 64, 0, x, 64, 58);
      glow.addColorStop(0, color + 'b0');
      glow.addColorStop(0.18, color + '68');
      glow.addColorStop(0.55, color + '20');
      glow.addColorStop(1, color + '00');
      ctx.fillStyle = glow;
      ctx.fillRect(i * 128, 0, 128, 128);
    }
  }
  function light(ctx, x, y, width, height, color = 1) {
    if (width < 4 || height < 3) return; // Subpixel halos add work without visible detail.
    ensure();
    ctx.drawImage(atlas, color * 128, 0, 128, 128, x - width / 2, y - height / 2, width, height);
  }
  window.NeonGraphics = {
    light,
    ensure,
    release() {
      atlas.width = atlas.height = 0;
    },
  };
})();
