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
  try {
    const siteId = detectSite();
    if (!siteId) return;

    const adapter = createAdapter(siteId);
    if (!adapter) return;

    let settings = getSiteSettings(await getSettings(), siteId);
    const debug = createDebugLogger(siteId, settings.debugMode);

    debug.info('Initializing on', window.location.hostname);

    const trimmer = new DomTrimmer(adapter, settings, debug);
    const memoryMonitor = new MemoryMonitor(debug);

    if (settings.enabled) {
      let retryCount = 0;
      const waitForContainer = () => {
        const container = adapter.getChatContainer();
        if (container) {
          debug.log('Container found, starting observation');
          trimmer.startObserving();
          trimmer.performTrim();
        } else {
          retryCount++;
          if (retryCount >= CONTAINER_MAX_RETRIES) {
            debug.warn(`Container not found after ${CONTAINER_MAX_RETRIES} retries, giving up`);
            return;
          }
          debug.log(`Container not found, retry ${retryCount}/${CONTAINER_MAX_RETRIES}...`);
          if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(waitForContainer, { timeout: CONTAINER_RETRY_IDLE_TIMEOUT_MS });
          } else {
            setTimeout(waitForContainer, CONTAINER_RETRY_DELAY_MS);
          }
        }
      };
      waitForContainer();
    } else {
      debug.info('Extension disabled for this site');
    }

    if (settings.enableMemoryMonitor) {
      memoryMonitor.start();
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const messageType = message?.type;

      try {
        switch (messageType) {
          case MESSAGES.SETTINGS_UPDATED: {
            settings = getSiteSettings(message.settings, siteId);
            debug.setEnabled(settings.debugMode);
            debug.log('Settings updated', settings);
            trimmer.updateSettings(settings);
            memoryMonitor.updateSettings(settings);
            sendResponse({ success: true });
            break;
          }
          case MESSAGES.GET_STATS: {
            const stats = trimmer.getStats();
            const memStats = memoryMonitor.getStats();
            const response = {
              success: true,
              ...stats,
              ...memStats
            };
            debug.log('Stats requested', response);
            sendResponse(response);
            break;
          }
          case MESSAGES.FORCE_CLEANUP: {
            debug.info('Force cleanup requested');
            trimmer.forceCleanup();
            sendResponse({ success: true, ...trimmer.getStats() });
            break;
          }
          case MESSAGES.RESTORE_ALL: {
            debug.info('Restore all requested');
            trimmer.restoreAll();
            sendResponse({ success: true });
            break;
          }
          default:
            sendResponse({ success: false, error: `Unsupported message type: ${messageType}` });
        }
      } catch (error) {
        debug.error('Message handling failed', messageType, error);
        sendResponse({ success: false, error: error.message || 'Message handling failed' });
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
        memoryMonitor.updateSettings(settings);
      }
    });

    window.__aico = { trimmer, memoryMonitor, debug };
  } catch (error) {
    console.error('[AICO] Initialization failed:', error);
  }
}

init();
