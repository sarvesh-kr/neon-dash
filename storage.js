/* Three bounded preferences; no per-run records, timers, or growing storage cache. */
(function (root) {
  'use strict';
  const fields = {
    best: { fallback: 0, valid: (value) => Number.isSafeInteger(value) && value >= 0 },
    color: { fallback: 'mint', valid: (value) => ['mint', 'pink', 'blue'].includes(value) },
    sound: { fallback: true, valid: (value) => typeof value === 'boolean' },
  };
  class NeonPreferences {
    constructor(storage) {
      if (arguments.length === 0) {
        try {
          storage = root.localStorage;
        } catch (_) {}
      }
      this.storage = storage;
      this.values = {};
      this.serialized = {};
      for (const [name, field] of Object.entries(fields)) {
        let raw = null;
        try {
          raw = storage?.getItem(`neon-dash-${name}`) ?? null;
        } catch (_) {}
        let value = field.fallback;
        if (typeof raw === 'string' && raw.length <= 32) {
          const decoded =
            name === 'best'
              ? Number(raw)
              : name === 'sound'
                ? raw === 'true'
                  ? true
                  : raw === 'false'
                    ? false
                    : null
                : raw;
          if (field.valid(decoded)) value = decoded;
        }
        this.values[name] = value;
        this.serialized[name] = String(value);
        // Repair only this game's existing keys, including oversized corrupt values.
        if (raw !== null && raw !== this.serialized[name]) this.write(name);
      }
    }
    get(name) {
      return Object.hasOwn(fields, name) ? this.values[name] : undefined;
    }
    set(name, value) {
      if (!Object.hasOwn(fields, name) || !fields[name].valid(value)) return false;
      if (this.values[name] === value) return false;
      this.values[name] = value;
      this.serialized[name] = String(value);
      this.write(name);
      return true;
    }
    write(name) {
      if (!Object.hasOwn(fields, name)) return;
      try {
        this.storage?.setItem(`neon-dash-${name}`, this.serialized[name]);
      } catch (_) {
        /* Quota or blocked storage never interrupts the run. */
      }
    }
  }
  root.NeonPreferences = NeonPreferences;
  if (typeof module !== 'undefined' && module.exports) module.exports = { NeonPreferences };
})(typeof window !== 'undefined' ? window : globalThis);
