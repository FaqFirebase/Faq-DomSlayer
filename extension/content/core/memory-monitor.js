class MemoryMonitor {
  constructor(debug) {
    this.debug = debug || { log: () => {}, warn: () => {}, error: () => {}, info: () => {} };
    this.isActive = false;
    this.monitorInterval = null;
    this.lastStats = null;
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.debug.info('MemoryMonitor starting');
    this.monitorInterval = setInterval(() => this.collectStats(), MEMORY_MONITOR_INTERVAL_MS);
    this.collectStats();
  }

  stop() {
    this.isActive = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.debug.info('MemoryMonitor stopped');
  }

  collectStats() {
    const stats = {
      domNodes: document.getElementsByTagName('*').length
    };

    if (performance.memory) {
      stats.heapUsed = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
      stats.heapTotal = Math.round(performance.memory.totalJSHeapSize / (1024 * 1024));
    }

    this.lastStats = stats;
    this.debug.log('Memory stats', stats);
    return stats;
  }

  getStats() {
    return this.lastStats || this.collectStats();
  }

  updateSettings(settings) {
    if (settings.enableMemoryMonitor && !this.isActive) {
      this.start();
    } else if (!settings.enableMemoryMonitor && this.isActive) {
      this.stop();
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MemoryMonitor };
}
