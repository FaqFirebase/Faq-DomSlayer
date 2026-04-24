importScripts('utils/constants.js');

const CONTENT_SCRIPT_FILES = chrome.runtime.getManifest().content_scripts[0].js;

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.sync.get(STORAGE_KEY);
  const settings = normalizeSettings(data[STORAGE_KEY]);
  if (!data[STORAGE_KEY] || JSON.stringify(data[STORAGE_KEY]) !== JSON.stringify(settings)) {
    await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
  }
});

function isSupportedTab(tab) {
  if (!tab?.id || !tab.url) return false;

  try {
    return !!detectSiteFromHostname(new URL(tab.url).hostname);
  } catch {
    return false;
  }
}

function sendMessageToTab(tabId, message, callback) {
  chrome.tabs.sendMessage(tabId, message, (response) => {
    if (chrome.runtime.lastError) {
      callback(chrome.runtime.lastError.message, null);
      return;
    }

    callback(null, response);
  });
}

function getContentScriptStatus(tabId, callback) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: () => !!window.__aico
  }, (results) => {
    if (chrome.runtime.lastError) {
      callback(chrome.runtime.lastError.message, false);
      return;
    }

    callback(null, !!results?.[0]?.result);
  });
}

function injectContentScripts(tabId, callback) {
  chrome.scripting.executeScript({
    target: { tabId },
    files: CONTENT_SCRIPT_FILES
  }, () => {
    if (chrome.runtime.lastError) {
      callback(chrome.runtime.lastError.message);
      return;
    }

    callback(null);
  });
}

function ensureContentScript(tab, callback) {
  if (!isSupportedTab(tab)) {
    callback('Active tab is not a supported AI chat site');
    return;
  }

  getContentScriptStatus(tab.id, (statusError, isReady) => {
    if (statusError) {
      callback(statusError);
      return;
    }

    if (isReady) {
      callback(null);
      return;
    }

    injectContentScripts(tab.id, callback);
  });
}

function forwardToActiveTab(message, sendResponse) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
      return;
    }

    if (!tabs[0]?.id) {
      sendResponse({ success: false, error: 'No active tab found' });
      return;
    }

    const tab = tabs[0];
    sendMessageToTab(tab.id, message, (messageError, response) => {
      if (!messageError) {
        sendResponse(response || { success: false, error: 'No response from content script' });
        return;
      }

      ensureContentScript(tab, (injectError) => {
        if (injectError) {
          sendResponse({ success: false, error: injectError });
          return;
        }

        sendMessageToTab(tab.id, message, (retryError, retryResponse) => {
          if (retryError) {
            sendResponse({ success: false, error: retryError });
            return;
          }

          sendResponse(retryResponse || { success: false, error: 'No response from content script after injection' });
        });
      });
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const messageType = message?.type;

  if (messageType === MESSAGES.GET_STATS) {
    forwardToActiveTab({ type: MESSAGES.GET_STATS }, sendResponse);
    return true;
  }

  if (messageType === MESSAGES.FORCE_CLEANUP) {
    forwardToActiveTab({ type: MESSAGES.FORCE_CLEANUP }, sendResponse);
    return true;
  }

  if (messageType === MESSAGES.RESTORE_ALL) {
    forwardToActiveTab({ type: MESSAGES.RESTORE_ALL }, sendResponse);
    return true;
  }

  if (messageType === MESSAGES.SETTINGS_UPDATED) {
    forwardToActiveTab({
      type: MESSAGES.SETTINGS_UPDATED,
      settings: normalizeSettings(message.settings)
    }, sendResponse);
    return true;
  }

  sendResponse({ success: false, error: `Unsupported message type: ${messageType}` });
  return false;
});
