class DomTrimmer {
  constructor(adapter, settings, debug) {
    this.adapter = adapter;
    this.settings = settings;
    this.debug = debug || { log: () => {}, warn: () => {}, error: () => {}, info: () => {} };
    this.trimmedCount = 0;
    this.observer = null;
    this.isRestoring = false;
    this.isTrimming = false;
    this.trimTimeout = null;
  }

  _incrementTrimmed(count) {
    this.trimmedCount += count;
  }

  _decrementTrimmed(count) {
    this.trimmedCount = Math.max(0, this.trimmedCount - count);
  }

  /**
   * Count actual trimmed messages from DOM state.
   * Handles individual placeholders (count=1), grouped placeholders (count from text),
   * and collapsed elements (count=1 each).
   */
  countTrimmedMessages() {
    let count = 0;
    try {
      const trimmed = document.querySelectorAll(`[${SELECTORS.PLACEHOLDER_ATTR}="true"]`);
      for (const el of trimmed) {
        const mode = el.getAttribute('data-aico-mode');
        if (mode === 'placeholder') {
          // Grouped placeholder text: "[N trimmed messages] ..."
          const match = el.textContent.match(/^\[(\d+) trimmed messages?\]/);
          count += match ? parseInt(match[1], 10) : 1;
        } else {
          // Collapsed or unknown mode
          count += 1;
        }
      }
    } catch {}
    return count;
  }

  /**
   * Sync internal counter with actual DOM state.
   * Handles pre-existing trimmed elements from previous sessions.
   */
  _syncTrimmedCount() {
    this.trimmedCount = this.countTrimmedMessages();
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
      if (!this.isRestoring && !this.isTrimming) {
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
    this.trimTimeout = setTimeout(() => this.performTrim(), TRIM_DEBOUNCE_MS);
  }

  performTrim() {
    if (!this.settings.enabled) return;

    // Sync counter with DOM to handle pre-existing trimmed elements
    this._syncTrimmedCount();

    const nodeList = this.adapter.getMessageContainers();
    if (!nodeList || nodeList.length === 0) {
      this.debug.log('No messages found to trim');
      return;
    }

    const messages = Array.from(nodeList);
    const maxMessages = this.settings.maxMessages;
    const trimMode = this.settings.trimMode;

    this.debug.log(`Messages: ${messages.length}, max: ${maxMessages}, mode: ${trimMode}, trimmed: ${this.trimmedCount}`);

    if (messages.length <= maxMessages) return;

    const excess = messages.length - maxMessages;
    const toTrim = messages.slice(0, excess);

    // Skip already-trimmed elements (collapsed mode keeps originals in DOM)
    const untrimmed = toTrim.filter(el => !el.hasAttribute(SELECTORS.PLACEHOLDER_ATTR));
    if (untrimmed.length === 0) return;

    this.debug.info(`Trimming ${untrimmed.length} messages`);

    // Suppress observer during trim to prevent feedback loops
    this.isTrimming = true;

    try {
      if (trimMode === TRIM_MODES.PLACEHOLDER) {
        this.placeholderElements(untrimmed);
      } else {
        for (const el of untrimmed) {
          this.trimElement(el, trimMode);
        }
      }
    } catch (error) {
      this.debug.error('Trim failed', error);
    } finally {
      this.isTrimming = false;
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
    this._incrementTrimmed(1);
  }

  placeholderElements(elements) {
    const chunks = this.groupElementsByParent(elements.filter(el => el.parentNode));

    for (const chunk of chunks) {
      if (chunk.length >= PLACEHOLDER_GROUP_MIN_SIZE) {
        this.placeholderGroupElements(chunk);
      } else {
        for (const el of chunk) {
          this.placeholderElement(el);
          this._incrementTrimmed(1);
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
    placeholder.setAttribute('data-aico-mode', 'placeholder');
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

    const originalNode = el.cloneNode(true);
    const originalParent = el.parentNode;
    const nextSibling = el.nextSibling;

    placeholder._restore = () => {
      const fallbackParent = placeholder.parentNode || originalParent;
      if (!fallbackParent) return;

      originalNode.removeAttribute(SELECTORS.PLACEHOLDER_ATTR);
      originalNode.classList.remove(SELECTORS.PLACEHOLDER_CLASS);
      originalNode.removeAttribute('data-aico-mode');

      if (nextSibling && nextSibling.parentNode === fallbackParent) {
        fallbackParent.insertBefore(originalNode, nextSibling);
      } else if (placeholder.parentNode === fallbackParent) {
        fallbackParent.insertBefore(originalNode, placeholder);
      } else {
        fallbackParent.appendChild(originalNode);
      }
      placeholder.remove();
      this._decrementTrimmed(1);
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
    const originalNodes = elements.map(el => el.cloneNode(true));
    const originalParents = elements.map(el => el.parentNode);
    const firstPreview = this.extractPreviewText(elements[0], PLACEHOLDER_GROUP_PREVIEW_LENGTH);
    const lastPreview = this.extractPreviewText(elements[elements.length - 1], PLACEHOLDER_GROUP_PREVIEW_LENGTH);
    const placeholder = this.createPlaceholder(
      `[${elements.length} trimmed messages] ${firstPreview} ... ${lastPreview}`,
      'Click to restore this group of messages'
    );

    placeholder._restore = () => {
      for (let i = 0; i < originalNodes.length; i++) {
        const node = originalNodes[i];
        const parent = placeholder.parentNode || originalParents[i];
        if (!parent) continue;

        node.removeAttribute(SELECTORS.PLACEHOLDER_ATTR);
        node.classList.remove(SELECTORS.PLACEHOLDER_CLASS);
        node.removeAttribute('data-aico-mode');

        if (placeholder.parentNode === parent) {
          parent.insertBefore(node, placeholder);
        } else {
          parent.appendChild(node);
        }
      }
      placeholder.remove();
      this._decrementTrimmed(originalNodes.length);
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
    this._incrementTrimmed(elements.length);
  }

  collapseElement(el) {
    el.setAttribute(SELECTORS.PLACEHOLDER_ATTR, 'true');
    el.setAttribute('data-aico-mode', 'collapse');
    el.style.cssText = 'max-height:40px;overflow:hidden;opacity:0.5;cursor:pointer;';
    el.title = 'Click to expand';

    const expandHandler = () => {
      el.style.maxHeight = el.scrollHeight + 'px';
      el.style.opacity = '1';
      el.removeAttribute(SELECTORS.PLACEHOLDER_ATTR);
      el.removeAttribute('data-aico-mode');
      el.removeEventListener('click', expandHandler);
      this._decrementTrimmed(1);
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
      const mode = ph.getAttribute('data-aico-mode');
      if (mode === 'placeholder' && ph._restore) {
        ph._restore();
      } else if (mode === 'collapse') {
        ph.style.maxHeight = '';
        ph.style.opacity = '';
        ph.style.cursor = '';
        ph.removeAttribute(SELECTORS.PLACEHOLDER_ATTR);
        ph.removeAttribute('data-aico-mode');
        ph.removeAttribute('title');
      }
    }
    this.trimmedCount = 0;
    this.isRestoring = false;
  }

  forceCleanup() {
    this.performTrim();
  }

  getStats() {
    const messages = this.adapter.getMessageContainers();
    return {
      domNodes: document.getElementsByTagName('*').length,
      messageCount: messages ? messages.length : 0,
      trimmedCount: this.countTrimmedMessages(),
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
