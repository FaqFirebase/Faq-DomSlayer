importScripts('utils/constants.js');

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.sync.get(STORAGE_KEY);
  if (!data[STORAGE_KEY]) {
    await chrome.storage.sync.set({ [STORAGE_KEY]: DEFAULT_SETTINGS });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === MESSAGES.GET_STATS) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: MESSAGES.GET_STATS }, (response) => {
          sendResponse(response);
        });
      }
    });
    return true;
  }

  if (message.type === MESSAGES.FORCE_CLEANUP) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: MESSAGES.FORCE_CLEANUP }, (response) => {
          sendResponse(response);
        });
      }
    });
    return true;
  }

  if (message.type === MESSAGES.RESTORE_ALL) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: MESSAGES.RESTORE_ALL }, (response) => {
          sendResponse(response);
        });
      }
    });
    return true;
  }
});
