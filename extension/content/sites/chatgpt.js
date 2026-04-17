class ChatGPTAdapter {
  constructor() {
    this.SITE_ID = 'chatgpt';
  }

  getChatContainer() {
    return document.querySelector('main') ||
           document.querySelector('[role="main"]') ||
           document.querySelector('.flex-1.overflow-hidden');
  }

  getMessageContainers() {
    const selectors = [
      '[data-testid^="conversation-turn"]',
      'article[data-testid]',
      '.text-base.gap-6',
      '[data-message-author-role]',
      '.group\\/conversation-turn'
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

    const candidates = main.querySelectorAll('div[class*="group"]');
    return Array.from(candidates).filter(el => {
      const text = el.textContent || '';
      return text.length > 10 && text.length < 100000 &&
             (el.querySelector('pre') || el.querySelector('p') || el.querySelector('code'));
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
                node.querySelector?.('[data-testid^="conversation-turn"]')) {
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
