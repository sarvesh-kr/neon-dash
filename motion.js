/* One reusable animation clock; simulation state owns pause, restart, and cadence. */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  class Motion {
    constructor() {
      this.phase = this.clock = this.lastTime = this.lastAmbient = 0;
      this.started = false;
      this.lastState = 'ready';
      this.reduced = false;
    }
    sample(game, ambient, reducedMotion = false) {
      const time = Number.isFinite(game.time) ? Math.max(0, game.time) : this.lastTime;
      const skyTime = Number.isFinite(ambient) ? Math.max(0, ambient) : this.lastAmbient;
      this.reduced = !!reducedMotion;
      if (game.state === 'ready' || time < this.lastTime) {
        this.phase = 0;
        this.started = false;
        if (game.state !== this.lastState || time < this.lastTime) this.clock = 0;
      }
      if (game.state === 'running') {
        const dt = Math.max(0, time - (time < this.lastTime ? 0 : this.lastTime));
        const speed = Number.isFinite(game.speed) ? Math.max(1, Math.min(80, game.speed)) : 29;
        this.phase = (this.phase + dt * TAU * 2.25 * Math.sqrt(speed / 29)) % TAU;
        this.clock = (this.clock + dt) % (TAU * 20);
        this.started = true;
      } else if (game.state === 'ready' && !this.reduced) {
        this.clock = (this.clock + Math.max(0, skyTime - this.lastAmbient)) % (TAU * 20);
      }
      this.lastTime = time;
      this.lastAmbient = skyTime;
      this.lastState = game.state;
      return this;
    }
    get turn() {
      if (!this.started) return Math.PI;
      const t = Math.min(1, this.lastTime / 0.42);
      return Math.PI * (1 - t * t * (3 - 2 * t));
    }
    get eyeOpen() {
      if (this.reduced) return 1;
      const period = TAU / 1.2,
        blink = this.clock % period;
      return blink > period - 0.16 ? Math.max(0.08, Math.abs((blink - (period - 0.08)) / 0.08)) : 1;
    }
  }
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.NeonMotion = { create: () => new Motion() };
  if (typeof module !== 'undefined' && module.exports) module.exports = Motion;
})();
