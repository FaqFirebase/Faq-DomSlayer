class ChatGPTAdapter {
  constructor() {
    this.SITE_ID = 'chatgpt';
    this._cachedContainer = null;
    this._cacheObserver = null;
  }

  _queryContainer() {
    return document.querySelector('main') ||
           document.querySelector('[role="main"]') ||
           document.querySelector('.flex-1.overflow-hidden') ||
           document.querySelector('#__next main') ||
           document.querySelector('[class*="relative"][class*="flex-1"]');
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
      '[data-testid^="conversation-turn"]',
      'article[data-testid]',
      '.text-base.gap-6',
      '[data-message-author-role]',
      '.group\\/conversation-turn',
      'div[class*="group/conversation-turn"]'
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

    const candidates = main.querySelectorAll('div[class*="group"]');
    return Array.from(candidates).filter(el => {
      const text = el.textContent || '';
      return text.length > 10 && text.length < 100000 &&
             (el.querySelector('pre') || el.querySelector('p') || el.querySelector('code') || el.querySelector('article'));
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
            if (node.matches?.('[data-testid^="conversation-turn"]') ||
                node.matches?.('article') ||
                node.matches?.('[data-message-author-role]') ||
                node.querySelector?.('[data-testid^="conversation-turn"]') ||
                node.querySelector?.('[data-message-author-role]')) {
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
  module.exports = { ChatGPTAdapter };
}
