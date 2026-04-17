class DomTrimmer {
  constructor(adapter, settings) {
    this.adapter = adapter;
    this.settings = settings;
    this.trimmedCount = 0;
    this.observer = null;
    this.isRestoring = false;
    this.trimTimeout = null;
  }

  updateSettings(settings) {
    this.settings = settings;
    if (settings.enabled) {
      this.startObserving();
      this.performTrim();
    } else {
      this.stopObserving();
      this.restoreAll();
    }
  }

  startObserving() {
    this.stopObserving();
    const container = this.adapter.getChatContainer();
    if (!container) return;

    this.observer = this.adapter.observeNewMessages(() => {
      if (!this.isRestoring) {
        this.scheduleTrim();
      }
    });
  }

  stopObserving() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  scheduleTrim() {
    if (this.trimTimeout) clearTimeout(this.trimTimeout);
    this.trimTimeout = setTimeout(() => this.performTrim(), 500);
  }

  performTrim() {
    if (!this.settings.enabled) return;

    const messages = this.adapter.getMessageContainers();
    if (!messages || messages.length === 0) return;

    const maxMessages = this.settings.maxMessages;
    const trimMode = this.settings.trimMode;

    if (messages.length <= maxMessages) return;

    const excess = messages.length - maxMessages;
    const toTrim = Array.from(messages).slice(0, excess);

    for (const el of toTrim) {
      if (el.hasAttribute(SELECTORS.PLACEHOLDER_ATTR)) continue;
      this.trimElement(el, trimMode);
    }
  }

  trimElement(el, mode) {
    switch (mode) {
      case TRIM_MODES.REMOVE:
        this.removeElement(el);
        break;
      case TRIM_MODES.COLLAPSE:
        this.collapseElement(el);
        break;
      case TRIM_MODES.PLACEHOLDER:
      default:
        this.placeholderElement(el);
        break;
    }
    this.trimmedCount++;
  }

  placeholderElement(el) {
    const textContent = this.extractPreviewText(el);
    const placeholder = document.createElement('div');
    placeholder.className = SELECTORS.PLACEHOLDER_CLASS;
    placeholder.setAttribute(SELECTORS.PLACEHOLDER_ATTR, 'true');
    placeholder.style.cssText = 'padding:8px 12px;margin:4px 0;color:#8888a0;font-size:12px;border-left:3px solid #3a3a4e;background:#1e1e30;border-radius:4px;cursor:pointer;transition:background 0.15s;';
    placeholder.textContent = `[#${this.trimmedCount + 1}] ${textContent}`;
    placeholder.title = 'Click to restore this message';

    const originalHTML = el.outerHTML;
    const originalParent = el.parentNode;
    const nextSibling = el.nextSibling;

    placeholder._restore = () => {
      const temp = document.createElement('div');
      temp.innerHTML = originalHTML;
      const restored = temp.firstElementChild;
      if (restored) {
        restored.removeAttribute(SELECTORS.PLACEHOLDER_ATTR);
        restored.classList.remove(SELECTORS.PLACEHOLDER_CLASS);
        if (nextSibling) {
          originalParent.insertBefore(restored, nextSibling);
        } else {
          originalParent.appendChild(restored);
        }
        placeholder.remove();
        this.trimmedCount = Math.max(0, this.trimmedCount - 1);
      }
    };

    placeholder.addEventListener('click', () => {
      this.isRestoring = true;
      placeholder._restore();
      this.isRestoring = false;
    });

    el.replaceWith(placeholder);
  }

  collapseElement(el) {
    const preview = this.extractPreviewText(el);
    const originalHeight = el.scrollHeight;
    el.setAttribute(SELECTORS.PLACEHOLDER_ATTR, 'true');
    el.style.cssText = `max-height:40px;overflow:hidden;opacity:0.5;cursor:pointer;`;
    el.title = 'Click to expand';

    const expandHandler = () => {
      el.style.maxHeight = originalHeight + 'px';
      el.style.opacity = '1';
      el.removeAttribute(SELECTORS.PLACEHOLDER_ATTR);
      el.removeEventListener('click', expandHandler);
      this.trimmedCount = Math.max(0, this.trimmedCount - 1);
    };
    el.addEventListener('click', expandHandler);
  }

  removeElement(el) {
    this.cleanupNodeListeners(el);
    el.remove();
  }

  extractPreviewText(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('code, pre, script, style, button, svg').forEach(n => n.remove());
    const text = (clone.textContent || '').trim().replace(/\s+/g, ' ');
    return text.length > 60 ? text.substring(0, 60) + '...' : text || '[message]';
  }

  cleanupNodeListeners(el) {
    const allNodes = el.querySelectorAll('*');
    for (const node of allNodes) {
      node.onclick = null;
      node.onmouseover = null;
      node.onmouseout = null;
      node.onload = null;
      node.onerror = null;
    }
  }

  restoreAll() {
    this.isRestoring = true;
    const placeholders = document.querySelectorAll(`[${SELECTORS.PLACEHOLDER_ATTR}="true"]`);
    for (const ph of placeholders) {
      if (ph._restore) {
        ph._restore();
      } else {
        ph.style.maxHeight = '';
        ph.style.opacity = '';
        ph.style.cursor = '';
        ph.removeAttribute(SELECTORS.PLACEHOLDER_ATTR);
        ph.removeAttribute('title');
      }
    }
    this.trimmedCount = 0;
    this.isRestoring = false;
  }

  forceCleanup() {
    this.performTrim();
    if (typeof window.requestIdleCallback === 'function') {
      requestIdleCallback(() => {
        if (window.gc) window.gc();
      });
    }
  }

  getStats() {
    const messages = this.adapter.getMessageContainers();
    return {
      domNodes: document.querySelectorAll('*').length,
      messageCount: messages ? messages.length : 0,
      trimmedCount: this.trimmedCount,
      siteId: this.adapter.SITE_ID
    };
  }

  destroy() {
    this.stopObserving();
    if (this.trimTimeout) clearTimeout(this.trimTimeout);
    this.restoreAll();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DomTrimmer };
}
