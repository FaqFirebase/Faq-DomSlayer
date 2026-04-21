class DomTrimmer {
  constructor(adapter, settings, debug) {
    this.adapter = adapter;
    this.settings = settings;
    this.debug = debug || { log: () => {}, warn: () => {}, error: () => {}, info: () => {} };
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
    if (!container) {
      this.debug.warn('Cannot start observing: no chat container found');
      return;
    }

    this.debug.log('Starting DOM observation');
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
      this.debug.log('Stopped DOM observation');
    }
  }

  scheduleTrim() {
    if (this.trimTimeout) clearTimeout(this.trimTimeout);
    this.trimTimeout = setTimeout(() => this.performTrim(), 500);
  }

  performTrim() {
    if (!this.settings.enabled) return;

    const messages = this.adapter.getMessageContainers();
    if (!messages || messages.length === 0) {
      this.debug.log('No messages found to trim');
      return;
    }

    const maxMessages = this.settings.maxMessages;
    const trimMode = this.settings.trimMode;

    this.debug.log(`Messages: ${messages.length}, max: ${maxMessages}, mode: ${trimMode}`);

    if (messages.length <= maxMessages) return;

    const excess = messages.length - maxMessages;
    const toTrim = Array.from(messages).slice(0, excess);

    this.debug.info(`Trimming ${toTrim.length} messages`);

    if (trimMode === TRIM_MODES.PLACEHOLDER) {
      this.placeholderElements(toTrim);
      return;
    }

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

  placeholderElements(elements) {
    const chunks = this.groupElementsByParent(elements.filter(el => el.parentNode && !el.hasAttribute(SELECTORS.PLACEHOLDER_ATTR)));

    for (const chunk of chunks) {
      if (chunk.length >= PLACEHOLDER_GROUP_MIN_SIZE) {
        this.placeholderGroupElements(chunk);
      } else {
        for (const el of chunk) {
          this.placeholderElement(el);
          this.trimmedCount++;
        }
      }
    }
  }

  groupElementsByParent(elements) {
    const chunks = [];
    let currentChunk = [];
    let currentParent = null;

    for (const el of elements) {
      if (currentChunk.length > 0 && el.parentNode !== currentParent) {
        chunks.push(currentChunk);
        currentChunk = [];
      }

      currentParent = el.parentNode;
      currentChunk.push(el);
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  createPlaceholder(textContent, title) {
    const placeholder = document.createElement('div');
    placeholder.className = SELECTORS.PLACEHOLDER_CLASS;
    placeholder.setAttribute(SELECTORS.PLACEHOLDER_ATTR, 'true');
    placeholder.style.cssText = 'padding:8px 12px;margin:4px 0;color:#8888a0;font-size:12px;border-left:3px solid #3a3a4e;background:#1e1e30;border-radius:4px;cursor:pointer;transition:background 0.15s;';
    placeholder.textContent = textContent;
    placeholder.title = title;
    return placeholder;
  }

  placeholderElement(el) {
    const textContent = this.extractPreviewText(el);
    const placeholder = this.createPlaceholder(
      `[#${this.trimmedCount + 1}] ${textContent}`,
      'Click to restore this message'
    );

    const originalHTML = el.outerHTML;
    const originalParent = el.parentNode;
    const nextSibling = el.nextSibling;

    placeholder._restore = () => {
      const restored = this.restoreHtml(originalHTML, originalParent, nextSibling, placeholder);
      if (restored) {
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

  placeholderGroupElements(elements) {
    const first = elements[0];
    const entries = elements.map(el => ({
      originalHTML: el.outerHTML,
      originalParent: el.parentNode
    }));
    const firstPreview = this.extractPreviewText(elements[0], PLACEHOLDER_GROUP_PREVIEW_LENGTH);
    const lastPreview = this.extractPreviewText(elements[elements.length - 1], PLACEHOLDER_GROUP_PREVIEW_LENGTH);
    const placeholder = this.createPlaceholder(
      `[${elements.length} trimmed messages] ${firstPreview} ... ${lastPreview}`,
      'Click to restore this group of messages'
    );

    placeholder._restore = () => {
      for (const entry of entries) {
        this.restoreHtml(entry.originalHTML, entry.originalParent, placeholder, placeholder);
      }
      placeholder.remove();
      this.trimmedCount = Math.max(0, this.trimmedCount - entries.length);
    };

    placeholder.addEventListener('click', () => {
      this.isRestoring = true;
      placeholder._restore();
      this.isRestoring = false;
    });

    first.parentNode.insertBefore(placeholder, first);
    for (const el of elements) {
      el.remove();
    }
    this.trimmedCount += elements.length;
  }

  restoreHtml(originalHTML, originalParent, nextSibling, placeholder) {
    const temp = document.createElement('div');
    temp.innerHTML = originalHTML;
    const restored = temp.firstElementChild;
    if (!restored) return null;

    restored.removeAttribute(SELECTORS.PLACEHOLDER_ATTR);
    restored.classList.remove(SELECTORS.PLACEHOLDER_CLASS);
    const fallbackParent = placeholder.parentNode || originalParent;
    if (!fallbackParent) return null;

    if (nextSibling && nextSibling.parentNode === fallbackParent) {
      fallbackParent.insertBefore(restored, nextSibling);
    } else if (placeholder.parentNode === fallbackParent) {
      fallbackParent.insertBefore(restored, placeholder);
    } else {
      fallbackParent.appendChild(restored);
    }

    return restored;
  }

  collapseElement(el) {
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

  extractPreviewText(el, maxLength = PLACEHOLDER_PREVIEW_LENGTH) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('code, pre, script, style, button, svg').forEach(n => n.remove());
    const text = (clone.textContent || '').trim().replace(/\s+/g, ' ');
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text || '[message]';
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
    this.debug.info(`Restoring ${placeholders.length} trimmed elements`);
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
