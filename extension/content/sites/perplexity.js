class PerplexityAdapter {
  constructor() {
    this.SITE_ID = 'perplexity';
  }

  getChatContainer() {
    return document.querySelector('[class*="thread-container"]') ||
           document.querySelector('main') ||
           document.querySelector('[role="main"]') ||
           document.querySelector('.scrollable-container');
  }

  getMessageContainers() {
    const selectors = [
      '[class*="QueryBox"]',
      '[class*="result-container"]',
      '[class*="prose"]',
      '.markdown-content',
      '[class*="thread-item"]',
      'div[class*="answer"]'
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

    const candidates = main.querySelectorAll('div[class*="query"], div[class*="answer"], div[class*="response"]');
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
            const className = (node.className || '').toLowerCase();
            if (className.includes('query') ||
                className.includes('result') ||
                className.includes('answer') ||
                node.querySelector?.('[class*="QueryBox"], [class*="result"]')) {
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
  module.exports = { PerplexityAdapter };
}
