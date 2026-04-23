class GeminiAdapter {
  constructor() {
    this.SITE_ID = 'gemini';
    this._cachedContainer = null;
    this._cacheObserver = null;
  }

  _queryContainer() {
    return document.querySelector('main .conversation-container') ||
           document.querySelector('[class*="chat-history"]') ||
           document.querySelector('main') ||
           document.querySelector('[role="main"]') ||
           document.querySelector('.app-container main') ||
           document.querySelector('div[class*="history"]');
  }

  getChatContainer() {
    if (this._cachedContainer && this._cachedContainer.isConnected) {
      return this._cachedContainer;
    }
    this._invalidateContainerCache();
    const container = this._queryContainer();
    if (container) {
      this._cachedContainer = container;
      this._observeContainerRemoval(container);
    }
    return container;
  }

  _observeContainerRemoval(container) {
    if (this._cacheObserver) this._cacheObserver.disconnect();
    this._cacheObserver = new MutationObserver(() => {
      if (!container.isConnected) {
        this._invalidateContainerCache();
      }
    });
    this._cacheObserver.observe(container.parentNode || document.body, { childList: true });
  }

  _invalidateContainerCache() {
    this._cachedContainer = null;
    if (this._cacheObserver) {
      this._cacheObserver.disconnect();
      this._cacheObserver = null;
    }
  }

  getMessageContainers() {
    const root = this.getChatContainer() || document;
    const selectors = [
      'message-content',
      '[class*="message-container"]',
      '[class*="model-response"]',
      '[class*="user-query"]',
      '.conversation-turn',
      '[data-content-type]',
      'user-query, model-response',
      '[class*="turn"]'
    ];

    for (const selector of selectors) {
      try {
        const elements = root.querySelectorAll(selector);
        if (elements.length > 0) return elements;
      } catch {
        // Invalid selector, skip
      }
    }

    return this.fallbackMessageDetection();
  }

  fallbackMessageDetection() {
    const main = this.getChatContainer();
    if (!main) return [];

    const candidates = main.querySelectorAll('div[class*="response"], div[class*="query"], div[class*="message"], message-content');
    return Array.from(candidates).filter(el => {
      const text = el.textContent || '';
      return text.length > 10;
    });
  }

  observeNewMessages(callback) {
    const container = this.getChatContainer();
    if (!container) return null;

    const observer = new MutationObserver((mutations) => {
      let hasNewMessages = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = node.tagName?.toLowerCase();
            if (tag === 'message-content' ||
                tag === 'model-response' ||
                tag === 'user-query' ||
                node.querySelector?.('message-content, model-response, user-query')) {
              hasNewMessages = true;
              break;
            }
          }
        }
        if (hasNewMessages) break;
      }
      if (hasNewMessages) callback();
    });

    observer.observe(container, { childList: true, subtree: true });
    return observer;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GeminiAdapter };
}
