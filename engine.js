/* Pure game simulation. No DOM, libraries, or network required. */
(function (root) {
  'use strict';
  const MODES = {
    chill: { start: 22, max: 35, acceleration: 0.075, spacing: 47 },
    classic: { start: 29, max: 49, acceleration: 0.105, spacing: 40 },
    rush: { start: 39, max: 62, acceleration: 0.14, spacing: 37 }
  };
  class RunnerEngine {
    constructor(random = Math.random) { this.random = random; this.reset('classic'); }
    reset(mode) {
      this.mode = MODES[mode] ? mode : 'classic'; this.config = MODES[this.mode];
      this.state = 'ready'; this.lane = 1; this.visualLane = 1; this.distance = 0;
      this.coins = 0; this.speed = this.config.start; this.time = 0;
      this.jumpTime = 0; this.slideTime = 0; this.jumpHeight = 0;
      this.jumpQueued = 0;
      this.objects = []; this.spawnDistance = 0; this.events = [];
    }
    start(mode = this.mode) { this.reset(mode); this.state = 'running'; this.spawnRow(120); }
    action(action) {
      if (this.state !== 'running') return false;
      if (action === 'left' || action === 'right') {
        const next = Math.max(0, Math.min(2, this.lane + (action === 'left' ? -1 : 1)));
        if (next === this.lane) return false;
        this.lane = next; return true;
      }
      if (action === 'jump' && this.jumpTime === 0) {
        this.jumpTime = 0.92; this.slideTime = 0; this.events.push('jump'); return true;
      }
      if (action === 'jump' && this.jumpTime <= 0.14) { this.jumpQueued = 0.14; return true; }
      // Swiping down while airborne lands immediately and ducks under a gate.
      if (action === 'slide') {
        this.jumpTime = 0; this.jumpHeight = 0; this.jumpQueued = 0;
        this.slideTime = 0.85; this.events.push('slide'); return true;
      }
      return false;
    }
    pause() { if (this.state === 'running') this.state = 'paused'; }
    resume() { if (this.state === 'paused') this.state = 'running'; }
    spawnRow(z = 205) {
      const safe = Math.floor(this.random() * 3);
      const blocked = (safe + 1 + Math.floor(this.random() * 2)) % 3;
      const kinds = ['train', 'barrier', 'gate'];
      const type = kinds[Math.floor(this.random() * kinds.length)];
      this.objects.push({ lane: blocked, z, type, checked: false });
      if (this.distance > 280 && this.random() < (this.mode === 'chill' ? 0.2 : 0.45)) {
        this.objects.push({ lane: 3 - safe - blocked, z, type: kinds[Math.floor(this.random() * 3)], checked: false });
      }
      for (let i = 0; i < 6; i++) this.objects.push({ lane: safe, z: z + 4 + i * 4.6, type: 'coin', collected: false });
      // Every object travels equally, so depth order only changes on spawn.
      this.objects.sort((a, b) => b.z - a.z);
    }
    update(dt) {
      this.events.length = 0;
      if (this.state !== 'running') return;
      dt = Math.min(0.05, Math.max(0, dt));
      this.time += dt; this.speed = Math.min(this.config.max, this.config.start + this.time * this.config.acceleration);
      const travel = this.speed * dt; this.distance += travel; this.spawnDistance += travel;
      this.visualLane += (this.lane - this.visualLane) * (1 - Math.exp(-dt * 24));
      this.jumpTime = Math.max(0, this.jumpTime - dt);
      this.slideTime = Math.max(0, this.slideTime - dt);
      if (this.jumpQueued > 0 && this.jumpTime === 0) { this.jumpQueued = 0; this.action('jump'); }
      else this.jumpQueued = Math.max(0, this.jumpQueued - dt);
      this.jumpHeight = this.jumpTime ? Math.sin((1 - this.jumpTime / 0.92) * Math.PI) * 1.7 : 0;
      if (this.spawnDistance >= this.config.spacing) { this.spawnDistance -= this.config.spacing; this.spawnRow(); }
      for (const object of this.objects) {
        object.z -= travel;
        const sameLane = Math.abs(object.lane - this.visualLane) < 0.48;
        if (object.type === 'coin') {
          if (!object.collected && sameLane && object.z <= 11 && object.z >= 5) {
            object.collected = true; this.coins++; this.events.push('coin');
          }
          continue;
        }
        if (object.type === 'train') {
          if (sameLane && object.z <= 9 && object.z + 17 >= 6) this.crash();
        } else if (!object.checked && object.z <= 9) {
          object.checked = true;
          if (sameLane && ((object.type === 'barrier' && this.jumpHeight < 0.85) || (object.type === 'gate' && this.slideTime <= 0))) this.crash();
          else if (sameLane) this.events.push('dodge');
        }
        if (this.state === 'over') break;
      }
      let retained = 0;
      for (const object of this.objects) {
        if (!object.collected && (object.type === 'train' ? object.z > -18 : object.z > -5)) this.objects[retained++] = object;
      }
      this.objects.length = retained;
    }
    crash() { if (this.state === 'running') { this.state = 'over'; this.events.push('crash'); } }
    get score() { return Math.floor(this.distance) + this.coins * 20; }
  }
  root.RunnerEngine = RunnerEngine;
  if (typeof module !== 'undefined' && module.exports) module.exports = { RunnerEngine, MODES };
})(typeof window !== 'undefined' ? window : globalThis);
