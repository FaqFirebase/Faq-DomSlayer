importScripts('utils/constants.js');

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.sync.get(STORAGE_KEY);
  const settings = normalizeSettings(data[STORAGE_KEY]);
  if (!data[STORAGE_KEY] || JSON.stringify(data[STORAGE_KEY]) !== JSON.stringify(settings)) {
    await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
  }
});

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

    chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }

      sendResponse(response || { success: false, error: 'No response from content script' });
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === MESSAGES.GET_STATS) {
    forwardToActiveTab({ type: MESSAGES.GET_STATS }, sendResponse);
    return true;
  }

  if (message.type === MESSAGES.FORCE_CLEANUP) {
    forwardToActiveTab({ type: MESSAGES.FORCE_CLEANUP }, sendResponse);
    return true;
  }

  if (message.type === MESSAGES.RESTORE_ALL) {
    forwardToActiveTab({ type: MESSAGES.RESTORE_ALL }, sendResponse);
    return true;
  }
});
