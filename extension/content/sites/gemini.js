class GeminiAdapter {
  constructor() {
    this.SITE_ID = 'gemini';
  }

  getChatContainer() {
    return document.querySelector('main .conversation-container') ||
           document.querySelector('[class*="chat-history"]') ||
           document.querySelector('main') ||
           document.querySelector('[role="main"]') ||
           document.querySelector('.app-container main');
  }

  getMessageContainers() {
    const selectors = [
      'message-content',
      '[class*="message-container"]',
      '[class*="model-response"]',
      '[class*="user-query"]',
      '.conversation-turn',
      '[data-content-type]',
      'user-query, model-response'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) return elements;
    }

    return this.fallbackMessageDetection();
  }

  fallbackMessageDetection() {
    const main = this.getChatContainer();
    if (!main) return [];

    const candidates = main.querySelectorAll('div[class*="response"], div[class*="query"], div[class*="message"]');
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
