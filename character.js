/* Original vector runner with articulated run, jump, crouch and landing poses. */
(() => {
  'use strict';
  function draw(ctx, pose) {
    const { color, cycle, jump, crouch, landing, lean, active, shield, magnet, time } = pose;
    const stride = active && !jump ? Math.sin(cycle) : 0;
    const tuck = Math.min(1, jump / 1.2);
    const bob = active && !jump ? Math.abs(Math.cos(cycle)) * 3 : Math.sin(time * 2) * 1.2;
    const hipY = -49 + crouch * 21;
    ctx.save();
    ctx.rotate(lean);
    ctx.translate(0, bob + landing * 5);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (shield) {
      ctx.strokeStyle = '#a7f7cf';
      ctx.fillStyle = '#a7f7cf0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, -65, 43 + Math.sin(time * 5), 78, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (magnet) {
      ctx.strokeStyle = '#88caff80';
      ctx.lineWidth = 2;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(0, -58, 48, side < 0 ? 2.6 : -0.5, side < 0 ? 3.7 : 0.5);
        ctx.stroke();
      }
    }

    // Each leg has its own thigh, knee, calf and shoe, rather than rotating the body.
    for (const side of [-1, 1]) {
      const swing = stride * side;
      const kneeX = side * 12 + swing * 6 + crouch * side * 11;
      const kneeY = -26 - Math.max(0, swing) * 9 - tuck * 19 + crouch * 13;
      const ankleX = side * 13 - swing * 7 + crouch * side * 16;
      const ankleY = -7 - Math.max(0, -swing) * 13 - tuck * (side < 0 ? 22 : 14);
      ctx.strokeStyle = '#151e36';
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.moveTo(side * 9, hipY);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(ankleX, ankleY);
      ctx.stroke();
      ctx.strokeStyle = '#657593';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(side * 12, hipY + 5);
      ctx.lineTo(kneeX + side * 3, kneeY);
      ctx.stroke();
      ctx.fillStyle = '#e9edf6';
      ctx.beginPath();
      ctx.roundRect(ankleX - 7, ankleY - 4, 19, 9, 4);
      ctx.fill();
      ctx.fillStyle = '#18253e';
      ctx.fillRect(ankleX - 6, ankleY - 2, 7, 3);
      ctx.fillStyle = color;
      ctx.fillRect(ankleX - 7, ankleY + 3, 19, 3);
    }

    const shoulderY = -89 + crouch * 33,
      headY = -126 + crouch * 45;
    // Sleeves, hands and elbows swing in opposition to the legs.
    for (const side of [-1, 1]) {
      const swing = stride * side;
      const elbowX = side * (25 + tuck * 3),
        elbowY = -68 + swing * 9 + crouch * 27 - tuck * 8;
      const handX = side * (19 + crouch * 14),
        handY = -52 + swing * 11 + crouch * 29 - tuck * 16;
      ctx.strokeStyle = '#244054';
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.moveTo(side * 17, shoulderY);
      ctx.lineTo(elbowX, elbowY);
      ctx.lineTo(handX, handY);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(side * 17, shoulderY);
      ctx.lineTo(elbowX, elbowY);
      ctx.stroke();
      ctx.fillStyle = '#cb9b83';
      ctx.beginPath();
      ctx.ellipse(handX, handY, 5, 6, -side * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Layered bomber jacket, collar, stitching and compact backpack.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-20, shoulderY - 7, 40, 48 - crouch * 11, [13, 13, 7, 7]);
    ctx.fill();
    ctx.fillStyle = '#12333e40';
    ctx.beginPath();
    ctx.roundRect(9, shoulderY - 3, 9, 39 - crouch * 10, 3);
    ctx.fill();
    ctx.fillStyle = '#14263d';
    ctx.fillRect(-16, shoulderY + 35 - crouch * 11, 32, 6);
    ctx.strokeStyle = '#dffffb80';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-17, shoulderY + 29 - crouch * 10);
    ctx.lineTo(17, shoulderY + 29 - crouch * 10);
    ctx.stroke();
    ctx.strokeStyle = '#17394c';
    ctx.lineWidth = 5;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 10, shoulderY - 2);
      ctx.lineTo(side * 12, shoulderY + 30 - crouch * 8);
      ctx.stroke();
    }
    ctx.fillStyle = '#202b43';
    ctx.beginPath();
    ctx.roundRect(-12, shoulderY + 2, 24, 31 - crouch * 7, 7);
    ctx.fill();
    ctx.strokeStyle = '#8197b8';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#374965';
    ctx.beginPath();
    ctx.roundRect(-9, shoulderY + 15, 18, 12 - crouch * 3, 3);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillRect(-3, shoulderY + 9, 6, 3);

    // Neck, sculpted hair, cap and headphones give the silhouette a clear identity.
    ctx.fillStyle = '#ba8875';
    ctx.fillRect(-6, headY + 24, 12, 9);
    ctx.fillStyle = '#d3a089';
    ctx.beginPath();
    ctx.roundRect(-13, headY + 5, 26, 26, 9);
    ctx.fill();
    ctx.fillStyle = '#18243a';
    ctx.beginPath();
    ctx.roundRect(-15, headY, 30, 23, [13, 13, 5, 5]);
    ctx.fill();
    ctx.fillStyle = '#273b57';
    ctx.beginPath();
    ctx.moveTo(-15, headY + 8);
    ctx.quadraticCurveTo(-2, headY - 9, 14, headY + 5);
    ctx.lineTo(15, headY + 13);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#405273';
    ctx.beginPath();
    ctx.roundRect(-15, headY + 15, 30, 5, 2);
    ctx.fill();
    ctx.strokeStyle = '#b1bdd4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, headY + 17, 16, Math.PI, Math.PI * 2);
    ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#16243b';
      ctx.beginPath();
      ctx.roundRect(side * 15 - 4, headY + 13, 8, 13, 3);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.fillRect(side * 15 - 1, headY + 16, 2, 7);
    }
    ctx.restore();
  }
  window.NeonCharacter = { draw };
})();
