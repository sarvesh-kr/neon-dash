/* One deliberate direction per contact, in CSS pixels, independent of frame rate. */
(function (root) {
  'use strict';
  class NeonSwipe {
    constructor() {
      this.reset();
    }
    reset() {
      this.id = null;
      this.handled = false;
    }
    begin(id, x, y, width) {
      if (this.id !== null || !Number.isFinite(x) || !Number.isFinite(y)) return false;
      this.id = id;
      this.x = x;
      this.y = y;
      this.threshold = Math.max(14, Math.min(24, width * 0.04 || 14));
      this.handled = false;
      return true;
    }
    move(id, x, y, released = false) {
      if (id !== this.id || this.handled || !Number.isFinite(x) || !Number.isFinite(y)) return null;
      const dx = x - this.x,
        dy = y - this.y;
      const horizontal = Math.abs(dx),
        vertical = Math.abs(dy);
      if (Math.max(horizontal, vertical) < this.threshold) return null;
      // Defer ambiguous diagonals until direction is clear or the finger lifts.
      if (!released && Math.max(horizontal, vertical) < Math.min(horizontal, vertical) * 1.2)
        return null;
      this.handled = true;
      return horizontal > vertical ? (dx > 0 ? 'right' : 'left') : dy < 0 ? 'jump' : 'slide';
    }
    end(id, x, y) {
      if (id !== this.id) return null;
      const direction = this.move(id, x, y, true);
      this.reset();
      return direction;
    }
    cancel(id) {
      if (id === this.id) this.reset();
    }
  }
  root.NeonSwipe = NeonSwipe;
  if (typeof module !== 'undefined' && module.exports) module.exports = { NeonSwipe };
})(typeof window !== 'undefined' ? window : globalThis);
