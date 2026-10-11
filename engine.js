/* Pure game simulation. No DOM, libraries, or network required. */
(function (root) {
  'use strict';
  const MODES = {
    chill: { start: 22, max: 35, acceleration: 0.075, spacing: 47 },
    classic: { start: 29, max: 49, acceleration: 0.105, spacing: 40 },
    rush: { start: 39, max: 62, acceleration: 0.14, spacing: 37 },
  };
  // World dimensions are shared with the renderer. Decorative glow is not solid.
  const GEOMETRY = Object.freeze({
    nearClip: -3,
    runner: Object.freeze({
      z: 8.5,
      halfDepth: 0.65,
      halfWidth: 0.18,
      height: 1.65,
      crouchHeight: 1.0875,
      artHeight: 132,
      coreHalfWidth: 18,
    }),
    train: Object.freeze({ halfWidth: 0.43, length: 17, height: 2.25 }),
    barrier: Object.freeze({ halfWidth: 0.45, length: 1, height: 0.78 }),
    crate: Object.freeze({ halfWidth: 0.42, length: 2.1, height: 0.96 }),
    gate: Object.freeze({
      halfWidth: 0.565,
      length: 1.2,
      height: 2.1,
      clearance: 1.25,
      beamHalfWidth: 0.56,
      beamTop: 2.08,
      postOffset: 0.52,
      postHalfWidth: 0.045,
    }),
    coin: Object.freeze({ halfWidth: 0.16, length: 0.4, bottom: 0.52, top: 0.88 }),
    shield: Object.freeze({ halfWidth: 0.21, length: 0.6, bottom: 0.62, top: 1.28 }),
    magnet: Object.freeze({ halfWidth: 0.21, length: 0.6, bottom: 0.62, top: 1.28 }),
  });
  const CONTACT_EPSILON = 1e-7;
  function clip(range, start, end, low, high) {
    const delta = end - start;
    if (Math.abs(delta) < 1e-12) return start >= low && start <= high;
    const first = (low - start) / delta,
      last = (high - start) / delta;
    range.enter = Math.max(range.enter, Math.min(first, last));
    range.exit = Math.min(range.exit, Math.max(first, last));
    return range.enter <= range.exit;
  }
  const KINDS = ['train', 'barrier', 'gate', 'crate'];
  const contactOrder = (a, b) =>
    a.contactTime - b.contactTime || Number(b.type === 'shield') - Number(a.type === 'shield');
  class RunnerEngine {
    constructor(random = Math.random) {
      this.random = random;
      this.runnerHalfWidth = GEOMETRY.runner.halfWidth;
      this.objects = [];
      this.events = [];
      this.effects = [];
      this.contacts = [];
      this.contactRange = { enter: 0, exit: 1 };
      this.motion = {
        lane: 1,
        jump: 0,
        height: GEOMETRY.runner.height,
        travel: 0,
        dt: 0,
        shield: 0,
        invulnerable: 0,
        magnet: 0,
      };
      this.objectSlots = Array.from({ length: 128 }, (_, index) => ({
        poolIndex: index,
        active: false,
        type: 'coin',
        lane: 0,
        z: 0,
        collected: false,
        checked: false,
        cleared: false,
        destroyed: false,
        contactTime: Infinity,
      }));
      this.freeObjects = [];
      this.reset('classic');
    }
    reset(mode) {
      this.mode = Object.hasOwn(MODES, mode) ? mode : 'classic';
      this.config = MODES[this.mode];
      this.state = 'ready';
      this.lane = 1;
      this.visualLane = 1;
      this.distance = 0;
      this.coins = 0;
      this.speed = this.config.start;
      this.time = 0;
      this.jumpTime = 0;
      this.slideTime = 0;
      this.jumpHeight = 0;
      this.jumpQueued = 0;
      this.laneVelocity = 0;
      this.landing = 0;
      this.slidePose = 0;
      this.magnetTime = 0;
      this.shieldTime = 0;
      this.invulnerable = 0;
      this.nextBoost = 180;
      this.boostCount = 0;
      this.dodges = 0;
      this.effects.length = 0;
      this.contacts.length = 0;
      this.crashReason = '';
      this.clearObjects();
      this.spawnDistance = 0;
      this.events.length = 0;
    }
    clearObjects() {
      this.objects.length = 0;
      this.freeObjects.length = 0;
      for (const object of this.objectSlots) {
        object.active = false;
        this.freeObjects.push(object);
      }
    }
    addObject(type, lane, z) {
      const object = this.freeObjects.pop();
      if (!object) return; // Capacity is ample for every supported mode; never grow the pool.
      object.active = true;
      object.type = type;
      object.lane = lane;
      object.z = z;
      object.collected = false;
      object.checked = false;
      object.cleared = false;
      object.destroyed = false;
      object.contactTime = Infinity;
      this.objects.push(object);
    }
    releaseObject(object) {
      if (object.active && this.objectSlots[object.poolIndex] === object) {
        object.active = false;
        this.freeObjects.push(object);
      }
    }
    start(mode = this.mode) {
      this.reset(mode);
      this.state = 'running';
      this.spawnRow(120);
      // A readable opening trail and early shield let players find their rhythm.
      this.addObject('shield', 1, 70);
      for (let i = 0; i < 6; i++) this.addObject('coin', 1, 25 + i * 6);
      this.objects.sort((a, b) => b.z - a.z);
    }
    action(action) {
      if (this.state !== 'running') return false;
      if (action === 'left' || action === 'right') {
        const next = Math.max(0, Math.min(2, this.lane + (action === 'left' ? -1 : 1)));
        if (next === this.lane) return false;
        this.lane = next;
        return true;
      }
      if (action === 'jump' && this.jumpTime === 0) {
        this.jumpTime = 0.92;
        this.slideTime = 0;
        this.slidePose = 0;
        this.events.push('jump');
        return true;
      }
      if (action === 'jump' && this.jumpTime <= 0.14) {
        this.jumpQueued = 0.14;
        return true;
      }
      // Swiping down while airborne lands immediately and ducks under a gate.
      if (action === 'slide') {
        this.jumpTime = 0;
        this.jumpHeight = 0;
        this.jumpQueued = 0;
        this.slideTime = 0.85;
        this.slidePose = 1;
        this.events.push('slide');
        return true;
      }
      return false;
    }
    pause() {
      if (this.state === 'running') this.state = 'paused';
    }
    resume() {
      if (this.state === 'paused') this.state = 'running';
    }
    spawnRow(z = 205) {
      const safe = Math.floor(this.random() * 3);
      const blocked = (safe + 1 + Math.floor(this.random() * 2)) % 3;
      const type = KINDS[Math.floor(this.random() * KINDS.length)];
      this.addObject(type, blocked, z);
      if (this.distance > 280 && this.random() < (this.mode === 'chill' ? 0.2 : 0.45)) {
        this.addObject(KINDS[Math.floor(this.random() * KINDS.length)], 3 - safe - blocked, z);
      }
      for (let i = 0; i < 6; i++) this.addObject('coin', safe, z + 4 + i * 4.6);
      if (this.distance >= this.nextBoost) {
        this.addObject(this.boostCount++ % 2 ? 'shield' : 'magnet', safe, z - 12);
        this.nextBoost = this.distance + 240;
      }
      // Every object travels equally, so depth order only changes on spawn.
      this.objects.sort((a, b) => b.z - a.z);
    }
    update(dt) {
      this.events.length = 0;
      this.effects.length = 0;
      if (this.state !== 'running' || !Number.isFinite(dt) || dt <= 0) return;
      dt = Math.min(0.05, dt);
      this.time += dt;
      this.speed = Math.min(
        this.config.max,
        this.config.start + this.time * this.config.acceleration,
      );
      const travel = this.speed * dt;
      this.distance += travel;
      this.spawnDistance += travel;
      const previousLane = this.visualLane;
      this.motion.lane = previousLane;
      this.motion.jump = this.jumpHeight;
      this.motion.height = this.bodyHeight;
      this.motion.travel = travel;
      this.motion.dt = dt;
      this.motion.shield = this.shieldTime;
      this.motion.invulnerable = this.invulnerable;
      this.motion.magnet = this.magnetTime;
      this.visualLane += (this.lane - this.visualLane) * (1 - Math.exp(-dt * 24));
      this.laneVelocity = dt ? (this.visualLane - previousLane) / dt : 0;
      const wasJumping = this.jumpTime > 0;
      this.jumpTime = Math.max(0, this.jumpTime - dt);
      this.slideTime = Math.max(0, this.slideTime - dt);
      this.slidePose += ((this.slideTime > 0 ? 1 : 0) - this.slidePose) * (1 - Math.exp(-dt * 26));
      this.landing = Math.max(0, this.landing - dt);
      this.magnetTime = Math.max(0, this.magnetTime - dt);
      this.shieldTime = Math.max(0, this.shieldTime - dt);
      this.invulnerable = Math.max(0, this.invulnerable - dt);
      if (this.jumpQueued > 0 && this.jumpTime === 0) {
        this.jumpQueued = 0;
        this.action('jump');
      } else this.jumpQueued = Math.max(0, this.jumpQueued - dt);
      const jumpProgress = 1 - this.jumpTime / 0.92;
      this.jumpHeight = this.jumpTime ? 4 * jumpProgress * (1 - jumpProgress) * 1.7 : 0;
      if (wasJumping && this.jumpTime === 0) {
        this.landing = 0.16;
        this.effects.push({ type: 'land', lane: this.visualLane });
      }
      if (this.spawnDistance >= this.config.spacing) {
        this.spawnDistance -= this.config.spacing;
        this.spawnRow();
      }
      this.contacts.length = 0;
      for (const object of this.objects) {
        object.z -= travel;
        const shape = GEOMETRY[object.type];
        if (!shape) continue;
        const pickup =
          object.type === 'coin' || object.type === 'shield' || object.type === 'magnet';
        const attracting = object.type === 'coin' && this.motion.magnet > 0;
        const depthOffset = pickup ? shape.length / 2 : 0;
        const farEdge = attracting
          ? 32
          : GEOMETRY.runner.z + GEOMETRY.runner.halfDepth + depthOffset;
        const nearEdge = attracting ? 5 : GEOMETRY.runner.z - GEOMETRY.runner.halfDepth;
        if (object.z > farEdge || object.z + travel + shape.length - depthOffset < nearEdge)
          continue;
        let contact = Infinity;
        if (pickup) {
          if (object.collected) continue;
          // Magnet attraction deliberately reaches beyond the physical body.
          contact = this.sweep(
            object,
            shape.halfWidth,
            shape.bottom,
            shape.top,
            shape.length,
            0,
            true,
          );
          if (attracting) {
            const range = this.contactRange;
            range.enter = 0;
            range.exit = Math.min(1, this.motion.magnet / dt);
            if (clip(range, object.z + travel, object.z, 5, 32))
              contact = Math.min(contact, range.enter);
          }
        } else {
          const envelope = this.sweep(
            object,
            shape.halfWidth,
            -Infinity,
            Infinity,
            shape.length,
            0,
          );
          if (envelope !== Infinity) {
            if (object.type === 'gate') {
              contact = Math.min(
                this.sweep(
                  object,
                  shape.beamHalfWidth,
                  shape.clearance,
                  shape.beamTop,
                  shape.length,
                  0,
                ),
                this.sweep(
                  object,
                  shape.postHalfWidth,
                  0,
                  shape.height,
                  shape.length,
                  -shape.postOffset,
                ),
                this.sweep(
                  object,
                  shape.postHalfWidth,
                  0,
                  shape.height,
                  shape.length,
                  shape.postOffset,
                ),
              );
            } else contact = this.sweep(object, shape.halfWidth, 0, shape.height, shape.length, 0);
            if (contact === Infinity && this.motion.invulnerable === 0) object.cleared = true;
          }
        }
        if (contact !== Infinity && !object.destroyed) {
          object.contactTime = contact;
          this.contacts.push(object);
        }
      }
      // Resolve the first physical contact first, independently of drawing order.
      if (this.contacts.length > 1) this.contacts.sort(contactOrder);
      let elapsed = dt;
      for (const object of this.contacts) {
        const at = object.contactTime * dt;
        if (object.type === 'coin') {
          object.collected = true;
          this.coins++;
          this.events.push('coin');
          this.effects.push({
            type: 'coin',
            lane: object.lane,
            z: object.z + travel * (1 - object.contactTime),
          });
        } else if (object.type === 'shield' || object.type === 'magnet') {
          object.collected = true;
          if (object.type === 'shield') this.motion.shield = at + 12;
          else this.motion.magnet = at + 10;
          this.events.push(object.type);
          this.effects.push({ type: object.type, lane: this.visualLane });
        } else this.hit(object, at);
        if (this.state === 'over') {
          elapsed = at;
          const remaining = 1 - object.contactTime;
          for (const item of this.objects) item.z += travel * remaining;
          this.distance -= travel * remaining;
          this.time -= dt * remaining;
          this.visualLane =
            this.motion.lane + (this.visualLane - this.motion.lane) * object.contactTime;
          this.jumpHeight =
            this.motion.jump + (this.jumpHeight - this.motion.jump) * object.contactTime;
          const height =
            this.motion.height + (this.bodyHeight - this.motion.height) * object.contactTime;
          this.slidePose =
            (height - GEOMETRY.runner.height) /
            (GEOMETRY.runner.crouchHeight - GEOMETRY.runner.height);
          this.effects[this.effects.length - 1].lane = this.visualLane;
          break;
        }
      }
      this.contacts.length = 0;
      this.shieldTime = Math.max(0, this.motion.shield - elapsed);
      this.invulnerable = Math.max(0, this.motion.invulnerable - elapsed);
      this.magnetTime = Math.max(0, this.motion.magnet - elapsed);
      let retained = 0;
      for (const object of this.objects) {
        const shape = GEOMETRY[object.type];
        if (
          shape &&
          !Object.hasOwn(shape, 'bottom') &&
          !object.checked &&
          object.z + shape.length < GEOMETRY.runner.z - GEOMETRY.runner.halfDepth
        ) {
          object.checked = true;
          if (object.cleared && !object.destroyed && this.state === 'running') {
            this.dodges++;
            this.events.push('dodge');
            this.effects.push({ type: 'dodge', lane: this.visualLane });
          }
        }
        if (
          !object.collected &&
          !object.destroyed &&
          (object.type === 'train'
            ? object.z + GEOMETRY.train.length > GEOMETRY.nearClip
            : object.z > -5)
        )
          this.objects[retained++] = object;
        else this.releaseObject(object);
      }
      this.objects.length = retained;
    }
    get bodyHeight() {
      const shape = GEOMETRY.runner;
      return shape.height + (shape.crouchHeight - shape.height) * this.slidePose;
    }
    sweep(object, halfWidth, bottom, top, length, offset = 0, centered = false) {
      const range = this.contactRange,
        player = GEOMETRY.runner,
        motion = this.motion;
      const z = object.z - (centered ? length / 2 : 0);
      range.enter =
        !centered && bottom !== -Infinity ? this.motion.invulnerable / this.motion.dt : 0;
      range.exit = 1;
      if (range.enter > 1) return Infinity;
      const reach = halfWidth + this.runnerHalfWidth - CONTACT_EPSILON;
      if (
        !clip(
          range,
          motion.lane - object.lane - offset,
          this.visualLane - object.lane - offset,
          -reach,
          reach,
        ) ||
        !clip(
          range,
          z + motion.travel,
          z,
          player.z - player.halfDepth - length + CONTACT_EPSILON,
          player.z + player.halfDepth - CONTACT_EPSILON,
        ) ||
        !clip(range, motion.jump, this.jumpHeight, -Infinity, top - CONTACT_EPSILON) ||
        !clip(
          range,
          motion.jump + motion.height,
          this.jumpHeight + this.bodyHeight,
          bottom + CONTACT_EPSILON,
          Infinity,
        )
      )
        return Infinity;
      return range.enter;
    }
    hit(object, elapsed) {
      if (this.motion.invulnerable > elapsed) return;
      if (this.motion.shield > elapsed) {
        this.motion.shield = 0;
        this.motion.invulnerable = elapsed + 0.8;
        object.destroyed = true;
        this.events.push('shield-break');
        this.effects.push({ type: 'shield-break', lane: this.visualLane });
      } else this.crash(object.type);
    }
    crash(type = 'train') {
      if (this.state === 'running') {
        this.state = 'over';
        this.crashReason = type;
        this.events.push('crash');
        this.effects.push({ type: 'crash', lane: this.visualLane });
      }
    }
    get score() {
      return Math.floor(this.distance) + this.coins * 20;
    }
  }
  root.NeonGeometry = GEOMETRY;
  root.RunnerEngine = RunnerEngine;
  if (typeof module !== 'undefined' && module.exports)
    module.exports = { RunnerEngine, MODES, GEOMETRY };
})(typeof window !== 'undefined' ? window : globalThis);
