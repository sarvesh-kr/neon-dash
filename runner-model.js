/* Original articulated toy runner. All joints and frames are reused, with no render timers. */
(() => {
  'use strict';
  const C = {
    ink: 0x15263d,
    navy: 0x263e61,
    denim: 0x29486e,
    stitch: 0x8ea8bf,
    white: 0xf9f7ec,
    sole: 0xdee7e6,
    skin: 0xffcf4e,
    skinShade: 0xe9a62f,
    silver: 0xc5d4dd,
    cyan: 0x75dceb,
    rubber: 0x344659,
  };
  const SIDES = [-1, 1];
  class Frame {
    constructor() {
      this.matrix = new Float64Array(9);
      this.x = this.y = this.z = this.qx = this.qy = this.qz = 0;
      this.qw = 1;
    }
    set(x, y, z, pitch = 0, yaw = 0, roll = 0, parent = null) {
      const sx = Math.sin(pitch / 2),
        cx = Math.cos(pitch / 2),
        sy = Math.sin(yaw / 2),
        cy = Math.cos(yaw / 2),
        sz = Math.sin(roll / 2),
        cz = Math.cos(roll / 2);
      const qx = sx * cy * cz - cx * sy * sz,
        qy = cx * sy * cz + sx * cy * sz,
        qz = cx * cy * sz - sx * sy * cz,
        qw = cx * cy * cz + sx * sy * sz;
      if (parent) {
        const m = parent.matrix;
        this.x = parent.x + m[0] * x + m[3] * y + m[6] * z;
        this.y = parent.y + m[1] * x + m[4] * y + m[7] * z;
        this.z = parent.z + m[2] * x + m[5] * y + m[8] * z;
        this.qx = parent.qw * qx + parent.qx * qw + parent.qy * qz - parent.qz * qy;
        this.qy = parent.qw * qy - parent.qx * qz + parent.qy * qw + parent.qz * qx;
        this.qz = parent.qw * qz + parent.qx * qy - parent.qy * qx + parent.qz * qw;
        this.qw = parent.qw * qw - parent.qx * qx - parent.qy * qy - parent.qz * qz;
      } else {
        this.x = x;
        this.y = y;
        this.z = z;
        this.qx = qx;
        this.qy = qy;
        this.qz = qz;
        this.qw = qw;
      }
      const a = this.qx,
        b = this.qy,
        c = this.qz,
        d = this.qw,
        m = this.matrix;
      m[0] = 1 - 2 * (b * b + c * c);
      m[1] = 2 * (a * b + c * d);
      m[2] = 2 * (a * c - b * d);
      m[3] = 2 * (a * b - c * d);
      m[4] = 1 - 2 * (a * a + c * c);
      m[5] = 2 * (b * c + a * d);
      m[6] = 2 * (a * c + b * d);
      m[7] = 2 * (b * c - a * d);
      m[8] = 1 - 2 * (a * a + b * b);
      return this;
    }
    point(x, y, z, out) {
      const m = this.matrix;
      out[0] = this.x + m[0] * x + m[3] * y + m[6] * z;
      out[1] = this.y + m[1] * x + m[4] * y + m[7] * z;
      out[2] = this.z + m[2] * x + m[5] * y + m[8] * z;
      return out;
    }
  }
  class Runner {
    constructor(renderer) {
      this.renderer = renderer;
      this.motion = window.NeonMotion.create();
      this.body = new Frame();
      this.head = new Frame();
      this.bag = new Frame();
      this.detail = new Frame();
      this.feet = [new Frame(), new Frame()];
      this.hands = [new Frame(), new Frame()];
      this.joints = Array.from({ length: 12 }, () => new Float64Array(3));
      this.pose = { phase: 0, turn: Math.PI, eyeOpen: 1, parts: 0 };
    }
    part(
      frame,
      kind,
      x,
      y,
      z,
      sx,
      sy,
      sz,
      color,
      gloss = 0.3,
      emission = 0,
      material = 0,
      pitch = 0,
      yaw = 0,
      roll = 0,
    ) {
      if (pitch === 0 && yaw === 0 && roll === 0) {
        const p = frame.point(x, y, z, this.joints[9]);
        this.renderer.add(
          kind,
          p[0],
          p[1],
          p[2],
          sx,
          sy,
          sz,
          color,
          frame.qx,
          frame.qy,
          frame.qz,
          frame.qw,
          gloss,
          emission,
          material,
        );
      } else {
        const f = this.detail.set(x, y, z, pitch, yaw, roll, frame);
        this.renderer.add(
          kind,
          f.x,
          f.y,
          f.z,
          sx,
          sy,
          sz,
          color,
          f.qx,
          f.qy,
          f.qz,
          f.qw,
          gloss,
          emission,
          material,
        );
      }
      this.pose.parts++;
    }
    seam(frame, x1, y1, z1, x2, y2, z2, width, color) {
      const a = frame.point(x1, y1, z1, this.joints[10]),
        b = frame.point(x2, y2, z2, this.joints[11]);
      this.renderer.limb(a[0], a[1], a[2], b[0], b[1], b[2], width, color);
      this.pose.parts++;
    }
    limb(a, b, width, color) {
      this.renderer.limb(a[0], a[1], a[2], b[0], b[1], b[2], width, color);
      this.pose.parts++;
    }
    draw(game, lane, jump, reducedMotion, impact) {
      const r = this.renderer,
        m = this.motion,
        color = r.color;
      const crouch = game.slidePose,
        landing = Math.max(0, Math.min(1, game.landing / 0.16));
      const phase = m.phase,
        tuck = Math.min(1, jump / 1.2),
        ground = (1 - tuck) * (1 - crouch);
      const lean = Math.max(-0.19, Math.min(0.19, -game.laneVelocity * 0.018));
      const running = m.started,
        cosmetic = reducedMotion ? 0 : 1;
      const stride = running ? Math.sin(phase) * ground : 0;
      const bob = running
        ? 0.014 * (1 - Math.cos(phase * 2)) * ground * cosmetic
        : Math.sin(m.clock * 2.2) * 0.005 * cosmetic;
      const baseY = jump + bob - landing * 0.043,
        hip = 0.65 - crouch * 0.25;
      const pitch =
        0.06 * ground - crouch * 0.3 + tuck * 0.08 + (game.state === 'over' ? impact * 0.13 : 0);
      const yaw = m.turn + Math.sin(phase) * 0.045 * ground + lean * 0.36;
      const roll = lean + Math.sin(phase) * 0.016 * ground * cosmetic;
      const b = this.body.set(lane - 1, baseY + hip, r.geometry.runner.z, pitch, yaw, roll);
      const chest = 1.015 - crouch * 0.395 - hip,
        headY = 1.4 - crouch * 0.57 - hip;
      this.pose.phase = phase;
      this.pose.turn = m.turn;
      this.pose.eyeOpen = m.eyeOpen;
      this.pose.parts = 0;
      r.pose.lane = lane;
      r.pose.jump = jump;
      r.pose.crouch = crouch;
      r.pose.height =
        r.geometry.runner.height -
        crouch * (r.geometry.runner.height - r.geometry.runner.crouchHeight);
      // Grounded contact shadow follows the shared world position, rather than the swinging body.
      r.add(
        2,
        lane - 1,
        0.014,
        r.geometry.runner.z,
        0.63 * (1 - jump * 0.12),
        0.018,
        0.55,
        0x354957,
        0,
        0,
        0,
        1,
        0,
      );
      // Pelvis, belt, jeans pockets and stitched outside seams.
      this.part(b, 3, 0, 0, 0, 0.33, 0.19, 0.29, C.denim, 0.2, 0, 8);
      this.part(b, 3, 0, 0.055, -0.154, 0.29, 0.036, 0.024, C.ink, 0.15);
      this.part(b, 0, 0.09, 0.055, -0.174, 0.04, 0.036, 0.014, C.silver, 0.9);
      for (let i = 0; i < 2; i++) {
        const side = SIDES[i],
          angle = phase + (i ? Math.PI : 0),
          lift = running ? Math.max(0, Math.sin(angle)) * ground : 0;
        const footZ = running ? Math.cos(angle) * 0.25 * ground : 0;
        const a = b.point(side * 0.1, 0, 0, this.joints[0]);
        const knee = b.point(
          side * (0.1 + crouch * 0.04),
          0.35 - crouch * 0.075 + tuck * 0.1 - hip,
          footZ * 0.46 + 0.055 + crouch * 0.23 + tuck * 0.17,
          this.joints[1],
        );
        const ankle = b.point(
          side * (0.105 + crouch * 0.05),
          0.092 + lift * 0.16 + tuck * 0.25 - hip,
          footZ + crouch * (i ? 0.36 : 0.5) - tuck * (i ? 0.1 : 0.18),
          this.joints[2],
        );
        if (!jump && crouch < 0.05 && lift === 0) ankle[1] = 0.092;
        if (!jump) ankle[1] = crouch >= 0.05 ? 0.092 + lift * 0.16 : Math.max(0.092, ankle[1]);
        this.limb(a, knee, 0.147, C.denim);
        this.limb(knee, ankle, 0.129, C.denim);
        this.part(b, 3, side * 0.15, 0.025, -0.157, 0.09, 0.1, 0.018, C.navy, 0.1, 0, 8);
        const seamA = this.joints[3],
          seamB = this.joints[4];
        seamA[0] = a[0] + side * 0.064;
        seamA[1] = a[1] - 0.035;
        seamA[2] = a[2];
        seamB[0] = knee[0] + side * 0.055;
        seamB[1] = knee[1];
        seamB[2] = knee[2];
        this.limb(seamA, seamB, 0.009, C.stitch);
        const shoe = this.feet[i].set(
          ankle[0],
          ankle[1],
          ankle[2] + 0.025,
          lift * 0.23 - tuck * 0.2,
          m.turn + lean * 0.2,
          0,
        );
        this.shoe(shoe, color, side);
        // Arms counter the legs; elbows and wrist joints remain attached through every pose.
        const swing = -stride * side,
          shoulder = b.point(side * 0.205, chest + 0.105, 0, this.joints[5]);
        const elbow = b.point(
          side * (0.275 + crouch * 0.025),
          0.865 - crouch * 0.36 - hip + tuck * 0.11,
          swing * 0.14 + crouch * 0.12 - tuck * 0.08,
          this.joints[6],
        );
        const hand = b.point(
          side * (0.265 + crouch * 0.05),
          0.78 - crouch * 0.27 - hip + tuck * 0.17,
          swing * 0.24 + crouch * 0.29 + tuck * 0.14,
          this.joints[7],
        );
        this.limb(shoulder, elbow, 0.143, color);
        this.limb(elbow, hand, 0.122, color);
        const cuff = this.hands[i].set(
          hand[0],
          hand[1] + 0.012,
          hand[2],
          0,
          m.turn + lean * 0.2,
          side * 0.12,
        );
        this.part(cuff, 3, 0, 0.01, 0, 0.129, 0.052, 0.129, C.ink, 0.15, 0, 8);
        this.part(cuff, 5, 0, -0.025, 0, 0.082, 0.04, 0.082, C.skin, 0.6);
        this.part(
          cuff,
          6,
          0,
          -0.09,
          0.014,
          0.175,
          0.175,
          0.17,
          C.skin,
          0.65,
          0,
          0,
          0,
          -Math.PI / 2,
          side * 0.14,
        );
        this.part(cuff, 0, side * 0.067, 0.016, 0, 0.023, 0.02, 0.13, color, 0.15);
        if (i === 0) {
          this.part(cuff, 3, -0.075, 0.035, 0, 0.026, 0.067, 0.065, C.ink, 0.6);
          this.part(cuff, 0, -0.09, 0.035, 0, 0.013, 0.042, 0.044, C.cyan, 0.5, 0.08);
        }
      }
      // Sculpted hoodie: two-tone lower band, hood, zipper, drawcords and pouch pockets.
      this.part(b, 3, 0, chest, 0, 0.425, 0.425, 0.305, color, 0.38, 0, 8);
      this.part(b, 3, 0, chest - 0.19, 0, 0.4, 0.055, 0.307, C.ink, 0.2, 0, 8);
      this.part(b, 3, 0, chest + 0.155, 0.012, 0.35, 0.06, 0.32, C.navy, 0.3, 0, 8);
      this.part(b, 4, 0, chest + 0.21, -0.082, 0.35, 0.17, 0.3, color, 0.35, 0, 8);
      this.part(b, 0, 0, chest - 0.012, 0.158, 0.016, 0.34, 0.018, C.ink, 0.3);
      this.part(b, 0, 0, chest + 0.05, 0.173, 0.013, 0.04, 0.01, C.silver, 0.9);
      for (const side of SIDES) {
        this.part(b, 3, side * 0.105, chest - 0.08, 0.155, 0.13, 0.09, 0.024, color, 0.18, 0, 8);
        this.seam(
          b,
          side * 0.07,
          chest - 0.11,
          0.172,
          side * 0.13,
          chest - 0.065,
          0.172,
          0.009,
          C.white,
        );
        const sway = Math.sin(phase * 2 - side) * 0.011 * ground * cosmetic;
        this.seam(
          b,
          side * 0.063,
          chest + 0.17,
          0.17,
          side * 0.061 + sway,
          chest + 0.015,
          0.177,
          0.012,
          C.white,
        );
        this.part(
          b,
          5,
          side * 0.061 + sway,
          chest + 0.01,
          0.177,
          0.017,
          0.035,
          0.017,
          C.silver,
          0.9,
        );
        this.seam(
          b,
          side * 0.18,
          chest + 0.14,
          -0.11,
          side * 0.15,
          chest - 0.17,
          -0.18,
          0.033,
          C.ink,
        );
        this.seam(
          b,
          side * 0.181,
          chest + 0.13,
          -0.13,
          side * 0.152,
          chest - 0.12,
          -0.199,
          0.012,
          C.stitch,
        );
      }
      // A layered technical backpack is the main visible surface during the run.
      const lag = Math.sin(phase * 2 - 0.65) * 0.008 * ground * cosmetic;
      const bag = this.bag.set(0, chest + lag, -0.225, -0.035 * stride * cosmetic, 0, 0, b);
      this.part(bag, 3, 0, 0, 0, 0.305, 0.36, 0.16, C.ink, 0.25, 0, 8);
      this.part(bag, 3, 0, 0.005, -0.083, 0.268, 0.315, 0.024, C.silver, 0.45);
      this.part(bag, 3, 0, 0.005, -0.099, 0.25, 0.298, 0.024, color, 0.35, 0, 8);
      this.part(bag, 3, 0, -0.089, -0.126, 0.227, 0.092, 0.036, C.navy, 0.22, 0, 8);
      this.part(bag, 0, 0, -0.054, -0.148, 0.215, 0.012, 0.012, C.silver, 0.8);
      this.part(bag, 0, 0.082, -0.064, -0.155, 0.015, 0.026, 0.012, C.silver, 0.85);
      this.part(bag, 0, 0, 0.055, -0.122, 0.126, 0.105, 0.023, C.ink, 0.4, 0, 106);
      this.part(bag, 0, 0, 0.055, -0.136, 0.1, 0.085, 0.012, C.cyan, 0.2, 0.08, 206);
      this.part(bag, 4, 0, 0.188, 0.01, 0.115, 0.064, 0.09, C.ink, 0.3);
      for (const side of SIDES) {
        this.part(bag, 3, side * 0.157, -0.045, 0.005, 0.037, 0.15, 0.1, C.navy, 0.2, 0, 8);
        this.part(bag, 0, side * 0.159, -0.053, -0.055, 0.035, 0.015, 0.012, color, 0.2);
        this.seam(bag, side * 0.118, 0.125, -0.115, side * 0.118, -0.035, -0.115, 0.007, C.stitch);
        this.seam(
          bag,
          side * 0.124,
          -0.163,
          -0.02,
          side * (0.129 + lag),
          -0.195,
          -0.035,
          0.014,
          C.ink,
        );
        this.part(bag, 0, side * 0.115, -0.139, -0.128, 0.02, 0.025, 0.013, C.silver, 0.8);
      }
      // Beveled toy head, neck stud, sculpted cap, ear cushions and expressive face.
      this.part(b, 5, 0, headY - 0.187, 0, 0.13, 0.12, 0.13, C.skin, 0.6);
      const glance = running ? lean * 0.55 : Math.sin(m.clock * 0.65) * 0.13 * cosmetic;
      const h = this.head.set(0, headY, 0, -tuck * 0.09, glance, -roll * 0.22, b);
      this.part(h, 5, 0, 0, 0, 0.432, 0.31, 0.432, C.skin, 0.65);
      this.part(h, 5, 0, 0.168, 0, 0.122, 0.075, 0.122, C.skin, 0.55);
      for (const side of SIDES) {
        this.part(h, 2, side * 0.078, 0.019, 0.205, 0.039, 0.056 * m.eyeOpen, 0.02, C.ink, 0.6);
        if (m.eyeOpen > 0.3)
          this.part(h, 2, side * 0.074, 0.028, 0.216, 0.01, 0.012 * m.eyeOpen, 0.006, C.white, 0.7);
        this.seam(
          h,
          side * 0.047,
          0.07 + tuck * 0.015,
          0.201,
          side * 0.107,
          0.066 + tuck * 0.011,
          0.19,
          0.016,
          C.ink,
        );
        this.part(h, 2, side * 0.119, -0.042, 0.176, 0.061, 0.021, 0.009, C.skinShade, 0.3);
        this.part(
          h,
          5,
          side * 0.221,
          0.01,
          0,
          0.19,
          0.07,
          0.19,
          C.ink,
          0.35,
          0,
          9,
          0,
          0,
          Math.PI / 2,
        );
        this.part(
          h,
          5,
          side * 0.26,
          0.01,
          0,
          0.156,
          0.028,
          0.156,
          C.silver,
          0.85,
          0,
          0,
          0,
          0,
          Math.PI / 2,
        );
        this.part(
          h,
          5,
          side * 0.279,
          0.01,
          0,
          0.123,
          0.018,
          0.123,
          color,
          0.45,
          0.1,
          0,
          0,
          0,
          Math.PI / 2,
        );
        this.part(h, 0, side * 0.29, 0.01, 0, 0.012, 0.046, 0.014, C.white, 0.5);
      }
      this.part(h, 2, 0, -0.014, 0.245, 0.031, 0.025, 0.029, C.skinShade, 0.5);
      this.part(h, 4, 0, -0.047, 0.226, 0.113, 0.061, 0.05, C.ink, 0.3);
      this.part(h, 3, 0, -0.016, 0.237, 0.126, 0.056, 0.02, C.skin, 0.55);
      this.part(h, 0, 0, -0.07, 0.238, 0.043, 0.012, 0.009, C.white, 0.6);
      this.part(h, 2, 0, 0.164, 0, 0.466, 0.155, 0.466, C.navy, 0.4);
      this.part(h, 3, 0, 0.143, 0.138, 0.457, 0.048, 0.36, C.ink, 0.35);
      this.part(h, 3, 0, 0.148, 0.236, 0.413, 0.033, 0.177, C.navy, 0.4);
      this.part(h, 0, 0, 0.201, 0.221, 0.119, 0.071, 0.025, color, 0.3, 0, 106);
      this.part(h, 5, 0, 0.243, 0, 0.042, 0.02, 0.042, color, 0.35);
      for (const side of SIDES) {
        this.seam(h, side * 0.07, 0.229, 0.036, side * 0.14, 0.2, 0.158, 0.008, C.stitch);
        this.part(h, 0, side * 0.07, 0.168, -0.217, 0.018, 0.039, 0.021, C.stitch, 0.35);
        this.part(h, 2, side * 0.166, 0.19, -0.06, 0.018, 0.018, 0.018, C.ink, 0.15);
      }
      this.part(h, 3, 0, 0.153, -0.209, 0.148, 0.054, 0.025, C.ink, 0.25);
      this.part(h, 0, 0, 0.153, -0.226, 0.075, 0.023, 0.012, color, 0.3);
      this.part(h, 4, 0, 0.06, -0.004, 0.46, 0.31, 0.21, C.silver, 0.75);
      this.part(h, 3, 0, 0.2, -0.004, 0.19, 0.036, 0.11, C.ink, 0.3);
      if (game.shieldTime > 0)
        for (let i = 0; i < 16; i++) {
          const a = (i * Math.PI) / 8 + (reducedMotion ? 0 : m.clock * 0.45);
          r.add(
            2,
            lane - 1 + Math.cos(a) * 0.47,
            baseY + 0.81 + Math.sin(a) * 0.8,
            r.geometry.runner.z - 0.12,
            0.04,
            0.062,
            0.04,
            0x80f0c7,
            0,
            0,
            0,
            1,
            0.2,
            0.6,
          );
        }
      if (game.magnetTime > 0)
        for (const side of SIDES) {
          const pulse = reducedMotion ? 1 : 0.9 + 0.1 * Math.sin(m.clock * 2.7);
          r.box(
            lane - 1 + side * 0.43,
            baseY + 0.83,
            r.geometry.runner.z,
            0.04,
            0.23,
            0.04,
            C.cyan,
            pulse * 0.5,
          );
        }
    }
    shoe(f, color, side) {
      this.part(f, 3, 0, 0, 0.025, 0.203, 0.106, 0.325, C.white, 0.22);
      this.part(f, 3, 0, -0.047, 0.025, 0.211, 0.03, 0.333, C.sole, 0.1, 0, 9);
      this.part(f, 3, 0, -0.064, 0.025, 0.212, 0.013, 0.333, C.rubber, 0.07, 0, 9);
      this.part(f, 3, 0, 0.003, -0.096, 0.194, 0.073, 0.075, C.navy, 0.25, 0, 8);
      this.part(f, 3, 0, 0.05, -0.013, 0.096, 0.023, 0.152, C.navy, 0.15, 0, 8);
      this.part(f, 0, side * 0.103, 0.004, 0.035, 0.013, 0.025, 0.143, color, 0.3);
      this.part(f, 0, 0, -0.041, -0.146, 0.17, 0.024, 0.014, color, 0.25);
      for (let lace = 0; lace < 4; lace++)
        this.part(f, 0, 0, 0.064, -0.058 + lace * 0.035, 0.09, 0.01, 0.013, C.white, 0.2);
      for (let tread = 0; tread < 4; tread++)
        this.part(f, 0, 0, -0.072, -0.079 + tread * 0.065, 0.15, 0.008, 0.019, C.rubber, 0.05);
      this.seam(f, -0.043, 0.067, -0.085, 0, 0.076, -0.068, 0.009, C.white);
      this.seam(f, 0, 0.076, -0.068, 0.043, 0.067, -0.085, 0.009, C.white);
    }
  }
  window.NeonRunnerModel = { create: (renderer) => new Runner(renderer) };
})();
