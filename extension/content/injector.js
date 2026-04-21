function detectSite() {
  return detectSiteFromHostname(window.location.hostname);
}

function createAdapter(siteId) {
  switch (siteId) {
    case SITE_IDS.CHATGPT:
      return new ChatGPTAdapter();
    case SITE_IDS.GEMINI:
      return new GeminiAdapter();
    case SITE_IDS.CLAUDE:
      return new ClaudeAdapter();
    case SITE_IDS.PERPLEXITY:
      return new PerplexityAdapter();
    case SITE_IDS.COPILOT:
      return new CopilotAdapter();
    default:
      return null;
  }
}

async function getSettings() {
  const data = await chrome.storage.sync.get(STORAGE_KEY);
  return normalizeSettings(data[STORAGE_KEY]);
}

function createDebugLogger(siteId, enabled) {
  const prefix = `[AICO:${SITE_NAMES[siteId] || siteId}]`;
  const state = { enabled: !!enabled };
  return {
    setEnabled: (nextEnabled) => { state.enabled = !!nextEnabled; },
    log: (...args) => { if (state.enabled) console.log(prefix, ...args); },
    warn: (...args) => { if (state.enabled) console.warn(prefix, ...args); },
    error: (...args) => { if (state.enabled) console.error(prefix, ...args); },
    info: (...args) => { if (state.enabled) console.info(prefix, ...args); }
  };
}

async function init() {
  const siteId = detectSite();
  if (!siteId) return;

  const adapter = createAdapter(siteId);
  if (!adapter) return;

  let settings = getSiteSettings(await getSettings(), siteId);
  const debug = createDebugLogger(siteId, settings.debugMode);

  debug.info('Initializing on', window.location.hostname);

  const trimmer = new DomTrimmer(adapter, settings, debug);
  const observerCleaner = new ObserverCleaner(settings, debug);
  const memoryMonitor = new MemoryMonitor(debug);

  if (settings.enabled) {
    const waitForContainer = () => {
      const container = adapter.getChatContainer();
      if (container) {
        debug.log('Container found, starting observation');
        trimmer.startObserving();
        trimmer.performTrim();
      } else {
        debug.log('Container not found, retrying...');
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(waitForContainer, { timeout: 2000 });
        } else {
          setTimeout(waitForContainer, 500);
        }
      }
    };
    waitForContainer();
  } else {
    debug.info('Extension disabled for this site');
  }

  if (settings.enableObserverCleanup) {
    observerCleaner.start();
  }

  if (settings.enableMemoryMonitor) {
    memoryMonitor.start();
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case MESSAGES.SETTINGS_UPDATED: {
        settings = getSiteSettings(message.settings, siteId);
        debug.setEnabled(settings.debugMode);
        debug.log('Settings updated', settings);
        trimmer.updateSettings(settings);
        observerCleaner.updateSettings(settings);
        memoryMonitor.updateSettings(settings);
        sendResponse({ success: true });
        break;
      }
      case MESSAGES.GET_STATS: {
        const stats = trimmer.getStats();
        const memStats = memoryMonitor.getStats();
        const response = {
          ...stats,
          ...memStats,
          observerStats: observerCleaner.getStats()
        };
        debug.log('Stats requested', response);
        sendResponse(response);
        break;
      }
      case MESSAGES.FORCE_CLEANUP: {
        debug.info('Force cleanup requested');
        trimmer.forceCleanup();
        observerCleaner.cleanStaleTimers();
        sendResponse({ success: true, ...trimmer.getStats() });
        break;
      }
      case MESSAGES.RESTORE_ALL: {
        debug.info('Restore all requested');
        trimmer.restoreAll();
        sendResponse({ success: true });
        break;
      }
    }
    return true;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes[STORAGE_KEY]) {
      const newSettings = changes[STORAGE_KEY].newValue;
      settings = getSiteSettings(newSettings, siteId);
      debug.setEnabled(settings.debugMode);
      debug.log('Storage changed, updating settings');
      trimmer.updateSettings(settings);
      observerCleaner.updateSettings(settings);
      memoryMonitor.updateSettings(settings);
    }
  });

  window.__aico = { trimmer, observerCleaner, memoryMonitor, debug };
}

init();
