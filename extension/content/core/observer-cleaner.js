class ObserverCleaner {
  constructor(settings) {
    this.settings = settings;
    this.originalSetInterval = window.setInterval;
    this.originalSetTimeout = window.setTimeout;
    this.originalClearInterval = window.clearInterval;
    this.originalClearTimeout = window.clearTimeout;
    this.originalRAF = window.requestAnimationFrame;
    this.originalCancelRAF = window.cancelAnimationFrame;
    this.trackedTimers = new Map();
    this.cleanupInterval = null;
    this.isActive = false;
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.interceptTimers();
    this.scheduleCleanup();
  }

  stop() {
    this.isActive = false;
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    window.setInterval = this.originalSetInterval;
    window.setTimeout = this.originalSetTimeout;
    window.clearInterval = this.originalClearInterval;
    window.clearTimeout = this.originalClearTimeout;
    window.requestAnimationFrame = this.originalRAF;
    window.cancelAnimationFrame = this.originalCancelRAF;
    this.trackedTimers.clear();
  }

  interceptTimers() {
    const self = this;

    window.setInterval = function (fn, delay, ...args) {
      const id = self.originalSetInterval.call(window, fn, delay, ...args);
      self.trackedTimers.set(id, {
        type: 'interval',
        created: Date.now(),
        delay: typeof delay === 'number' ? delay : 0,
        isObserverBound: self.isObserverBound(fn),
        fn
      });
      return id;
    };

    window.setTimeout = function (fn, delay, ...args) {
      if (typeof fn !== 'function') {
        const id = self.originalSetTimeout.call(window, fn, delay, ...args);
        self.trackedTimers.set(id, {
          type: 'timeout',
          created: Date.now(),
          delay: typeof delay === 'number' ? delay : 0
        });
        return id;
      }

      const wrappedFn = (...callbackArgs) => {
        self.trackedTimers.delete(id);
        return fn(...callbackArgs);
      };
      const id = self.originalSetTimeout.call(window, wrappedFn, delay, ...args);
      self.trackedTimers.set(id, {
        type: 'timeout',
        created: Date.now(),
        delay: typeof delay === 'number' ? delay : 0
      });
      return id;
    };

    window.clearInterval = function (id) {
      self.trackedTimers.delete(id);
      return self.originalClearInterval.call(window, id);
    };

    window.clearTimeout = function (id) {
      self.trackedTimers.delete(id);
      return self.originalClearTimeout.call(window, id);
    };

    window.requestAnimationFrame = function (fn) {
      const wrappedFn = (timestamp) => {
        self.trackedTimers.delete(id);
        return fn(timestamp);
      };
      const id = self.originalRAF.call(window, wrappedFn);
      self.trackedTimers.set(id, {
        type: 'raf',
        created: Date.now(),
        fn
      });
      return id;
    };

    window.cancelAnimationFrame = function (id) {
      self.trackedTimers.delete(id);
      return self.originalCancelRAF.call(window, id);
    };
  }

  isObserverBound(fn) {
    if (typeof fn !== 'function') {
      return false;
    }

    try {
      return /\.observe\(/.test(fn.toString());
    } catch {
      return false;
    }
  }

  scheduleCleanup() {
    const interval = this.settings.cleanupIntervalMs || 30000;
    this.cleanupInterval = this.originalSetInterval.call(
      window,
      () => this.cleanStaleTimers(),
      interval
    );
  }

  cleanStaleTimers() {
    const now = Date.now();
    const maxTimerAge = 120000;

    for (const [id, info] of this.trackedTimers) {
      if (info.type === 'timeout' && now - info.created > maxTimerAge) {
        this.originalClearTimeout.call(window, id);
        this.trackedTimers.delete(id);
        continue;
      }

      if (info.type === 'raf' && now - info.created > maxTimerAge) {
        this.originalCancelRAF.call(window, id);
        this.trackedTimers.delete(id);
        continue;
      }

      if (info.type === 'interval') {
        if (info.isObserverBound && now - info.created > maxTimerAge) {
          this.originalClearInterval.call(window, id);
          this.trackedTimers.delete(id);
        }
      }
    }

    if (typeof window.performance !== 'undefined' && window.performance.memory) {
      if (window.performance.memory.usedJSHeapSize > 500 * 1024 * 1024) {
        if (window.gc) {
          window.gc();
        }
      }
    }
  }

  getStats() {
    const counts = { interval: 0, timeout: 0, raf: 0 };
    for (const [, info] of this.trackedTimers) {
      counts[info.type]++;
    }
    return {
      total: this.trackedTimers.size,
      intervals: counts.interval,
      timeouts: counts.timeout,
      animationFrames: counts.raf
    };
  }

  updateSettings(settings) {
    this.settings = settings;
    if (settings.enableObserverCleanup && !this.isActive) {
      this.start();
    } else if (!settings.enableObserverCleanup && this.isActive) {
      this.stop();
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ObserverCleaner };
}
