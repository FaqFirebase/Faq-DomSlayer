class CopilotAdapter {
  constructor() {
    this.SITE_ID = 'copilot';
  }

  getChatContainer() {
    return document.querySelector('[class*="chat-history"]') ||
           document.querySelector('[class*="conversation"]') ||
           document.querySelector('main') ||
           document.querySelector('[role="main"]') ||
           document.querySelector('.cib-serp-main');
  }

  getMessageContainers() {
    const selectors = [
      '[class*="response-message-group"]',
      '[class*="user-message"]',
      'cib-message',
      '[class*="message-content"]',
      '[class*="turn"]',
      '.ac-textBlock'
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

    const candidates = main.querySelectorAll('div[class*="message"], div[class*="response"], div[class*="turn"]');
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
