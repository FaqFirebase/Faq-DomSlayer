function detectSite() {
  const hostname = window.location.hostname;
  if (SITE_URL_MAP[hostname]) {
    return SITE_URL_MAP[hostname];
  }

  if (hostname.endsWith('.chatgpt.com')) {
    return SITE_IDS.CHATGPT;
  }

  if (hostname.endsWith('.claude.ai')) {
    return SITE_IDS.CLAUDE;
  }

  if (hostname.endsWith('.perplexity.ai')) {
    return SITE_IDS.PERPLEXITY;
  }

  return null;
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
  return data[STORAGE_KEY] || DEFAULT_SETTINGS;
}

function getSiteSettings(settings, siteId) {
  const overrides = settings.siteOverrides[siteId] || {};
  return { ...settings, ...overrides };
}

async function init() {
  const siteId = detectSite();
  if (!siteId) return;

  const adapter = createAdapter(siteId);
  if (!adapter) return;

  let settings = getSiteSettings(await getSettings(), siteId);

  const trimmer = new DomTrimmer(adapter, settings);
  const observerCleaner = new ObserverCleaner(settings);
  const memoryMonitor = new MemoryMonitor();

  if (settings.enabled) {
    const waitForContainer = () => {
      const container = adapter.getChatContainer();
      if (container) {
        trimmer.startObserving();
        trimmer.performTrim();
      } else {
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(waitForContainer, { timeout: 2000 });
        } else {
          setTimeout(waitForContainer, 500);
        }
      }
    };
    waitForContainer();
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
        trimmer.updateSettings(settings);
        observerCleaner.updateSettings(settings);
        memoryMonitor.updateSettings(settings);
        sendResponse({ success: true });
        break;
      }
      case MESSAGES.GET_STATS: {
        const stats = trimmer.getStats();
        const memStats = memoryMonitor.getStats();
        sendResponse({
          ...stats,
          ...memStats,
          observerStats: observerCleaner.getStats()
        });
        break;
      }
      case MESSAGES.FORCE_CLEANUP: {
        trimmer.forceCleanup();
        observerCleaner.cleanStaleTimers();
        sendResponse({ success: true, ...trimmer.getStats() });
        break;
      }
      case MESSAGES.RESTORE_ALL: {
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
      trimmer.updateSettings(settings);
      observerCleaner.updateSettings(settings);
      memoryMonitor.updateSettings(settings);
    }
  });

  window.__aico = { trimmer, observerCleaner, memoryMonitor };
}

init();
