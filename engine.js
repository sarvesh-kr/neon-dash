/* Pure game simulation. No DOM, libraries, or network required. */
(function (root) {
  'use strict';
  const MODES = {
    chill: { start: 22, max: 35, acceleration: 0.075, spacing: 47 },
    classic: { start: 29, max: 49, acceleration: 0.105, spacing: 40 },
    rush: { start: 39, max: 62, acceleration: 0.14, spacing: 37 },
  };
  const OBSTACLE_LENGTH = { train: 17, barrier: 1, gate: 1.2, crate: 2.1 };
  const KINDS = ['train', 'barrier', 'gate', 'crate'];
  class RunnerEngine {
    constructor(random = Math.random) {
      this.random = random;
      this.objects = [];
      this.events = [];
      this.effects = [];
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
      for (const object of this.objects) {
        object.z -= travel;
        const sameLane = Math.abs(object.lane - this.visualLane) < 0.48;
        if (object.type === 'coin') {
          const attracted = this.magnetTime > 0 && object.z <= 32 && object.z >= 5;
          if (!object.collected && (attracted || (sameLane && object.z <= 11 && object.z >= 5))) {
            object.collected = true;
            this.coins++;
            this.events.push('coin');
            this.effects.push({ type: 'coin', lane: object.lane, z: object.z });
          }
          continue;
        }
        if (object.type === 'magnet' || object.type === 'shield') {
          if (!object.collected && sameLane && object.z <= 11 && object.z >= 5) {
            object.collected = true;
            if (object.type === 'magnet') this.magnetTime = 10;
            else this.shieldTime = 12;
            this.events.push(object.type);
            this.effects.push({ type: object.type, lane: this.visualLane });
          }
          continue;
        }
        const length = OBSTACLE_LENGTH[object.type];
        const overlaps = object.z <= 9 && object.z + length >= 6;
        if (sameLane && overlaps) {
          const cleared =
            (object.type === 'gate' && this.slideTime > 0) ||
            ((object.type === 'barrier' || object.type === 'crate') && this.jumpHeight >= 0.85);
          if (cleared) object.cleared = true;
          else this.hit(object);
        }
        // Check the whole body, including lane changes or a slide ending inside it.
        // Award a clear once the hazard has passed, never for a shield collision.
        if (!object.checked && object.z + length < 6) {
          object.checked = true;
          if (object.cleared && !object.destroyed) {
            this.dodges++;
            this.events.push('dodge');
            this.effects.push({ type: 'dodge', lane: this.visualLane });
          }
        }
        if (this.state === 'over') break;
      }
      let retained = 0;
      for (const object of this.objects) {
        if (
          !object.collected &&
          !object.destroyed &&
          (object.type === 'train' ? object.z > -18 : object.z > -5)
        )
          this.objects[retained++] = object;
        else this.releaseObject(object);
      }
      this.objects.length = retained;
    }
    hit(object) {
      if (this.invulnerable > 0) return;
      if (this.shieldTime > 0) {
        this.shieldTime = 0;
        this.invulnerable = 0.8;
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
  root.RunnerEngine = RunnerEngine;
  if (typeof module !== 'undefined' && module.exports) module.exports = { RunnerEngine, MODES };
})(typeof window !== 'undefined' ? window : globalThis);
