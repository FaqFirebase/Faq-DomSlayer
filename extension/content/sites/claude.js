class ClaudeAdapter {
  constructor() {
    this.SITE_ID = 'claude';
  }

  getChatContainer() {
    return document.querySelector('[class*="chat-messages"]') ||
           document.querySelector('[class*="conversation"]') ||
           document.querySelector('main') ||
           document.querySelector('[role="main"]') ||
           document.querySelector('.flex-1.overflow-y-auto') ||
           document.querySelector('[class*="scrollable"]');
  }

  getMessageContainers() {
    const root = this.getChatContainer() || document;
    const selectors = [
      '[data-testid="chat-message"]',
      '[class*="font-user-message"]',
      '[class*="font-claude-message"]',
      '.message-content',
      '[class*="message-wrapper"]',
      'div[class*="group"][data-testid]',
      '[class*="chat-message"]'
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
      return text.length > 10 && text.length < 100000;
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
            const testId = node.getAttribute?.('data-testid') || '';
            if (testId.includes('chat-message') ||
                node.querySelector?.('[data-testid="chat-message"]') ||
                node.matches?.('[class*="font-user-message"]') ||
                node.matches?.('[class*="font-claude-message"]')) {
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
  module.exports = { ClaudeAdapter };
}
