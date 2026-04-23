class CopilotAdapter {
  constructor() {
    this.SITE_ID = 'copilot';
    this._cachedContainer = null;
    this._cacheObserver = null;
  }

  _queryContainer() {
    return document.querySelector('[class*="chat-history"]') ||
           document.querySelector('[class*="conversation"]') ||
           document.querySelector('main') ||
           document.querySelector('[role="main"]') ||
           document.querySelector('.cib-serp-main') ||
           document.querySelector('cib-serp');
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
      '[class*="response-message-group"]',
      '[class*="user-message"]',
      'cib-message',
      '[class*="message-content"]',
      '[class*="turn"]',
      'cib-message-group',
      '[class*="message-group"]'
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

    const candidates = main.querySelectorAll('div[class*="message"], div[class*="response"], div[class*="turn"], cib-message');
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
            if (tag === 'cib-message' ||
                tag === 'cib-message-group' ||
                tag?.startsWith('cib-') ||
                node.querySelector?.('cib-message')) {
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
  module.exports = { CopilotAdapter };
}
