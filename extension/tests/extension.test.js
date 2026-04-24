const assert = require('assert');

// ---------------------------------------------------------------------------
// Mocks for browser globals
// ---------------------------------------------------------------------------
let mockQuerySelectorAllResult = [];

global.document = {
  querySelector: () => null,
  querySelectorAll: (selector) => {
    if (selector === '[data-aico-trimmed="true"]') return mockQuerySelectorAllResult;
    return [];
  },
  getElementsByTagName: () => [],
  createElement: (tag) => ({
    tagName: tag.toUpperCase(),
    style: {},
    className: '',
    classList: { add: () => {}, remove: () => {} },
    attributes: {},
    setAttribute: function(k, v) { this.attributes[k] = v; },
    getAttribute: function(k) { return this.attributes[k] || null; },
    hasAttribute: function(k) { return k in this.attributes; },
    removeAttribute: function(k) { delete this.attributes[k]; },
    textContent: '',
    innerHTML: '',
    outerHTML: '',
    parentNode: null,
    nextSibling: null,
    appendChild: function(c) { return c; },
    insertBefore: function(c) { return c; },
    remove: function() {},
    replaceWith: function() {},
    cloneNode: function(deep) { return { ...this, querySelectorAll: () => [] }; },
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelectorAll: () => [],
    isConnected: true
  }),
  querySelectorAll: (selector) => {
    if (selector === '[data-aico-trimmed="true"]') return mockQuerySelectorAllResult;
    return [];
  }
};

global.window = {
  location: { hostname: 'chatgpt.com' },
  requestIdleCallback: (cb) => setTimeout(cb, 0),
  gc: () => {},
  performance: { memory: null },
  setInterval: (fn, delay) => { fn(); return 1; },
  clearInterval: () => {},
  setTimeout: (fn, delay) => { if (typeof fn === 'function') fn(); return 1; },
  clearTimeout: () => {},
  requestAnimationFrame: (fn) => { fn(0); return 1; },
  cancelAnimationFrame: () => {}
};

global.Node = { ELEMENT_NODE: 1 };
global.MutationObserver = class {
  observe() {}
  disconnect() {}
};

// ---------------------------------------------------------------------------
// Load modules under test
// ---------------------------------------------------------------------------
const {
  DEFAULT_SETTINGS,
  DEFAULT_SITE_OVERRIDE,
  TRIM_MODES,
  SITE_IDS,
  SITE_NAMES,
  MESSAGES,
  SELECTORS,
  PLACEHOLDER_GROUP_MIN_SIZE,
  PLACEHOLDER_PREVIEW_LENGTH,
  PLACEHOLDER_GROUP_PREVIEW_LENGTH,
  CONTAINER_MAX_RETRIES,
  CONTAINER_RETRY_IDLE_TIMEOUT_MS,
  CONTAINER_RETRY_DELAY_MS,
  TRIM_DEBOUNCE_MS,
  MEMORY_MONITOR_INTERVAL_MS,
  POPUP_STATUS_CLEAR_MS,
  POPUP_STATS_REFRESH_MS,
  detectSiteFromHostname,
  getSiteSettings,
  normalizeSettings
} = require('../utils/constants.js');

global.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
global.TRIM_MODES = TRIM_MODES;
global.SITE_IDS = SITE_IDS;
global.SITE_NAMES = SITE_NAMES;
global.MESSAGES = MESSAGES;
global.SELECTORS = SELECTORS;
global.PLACEHOLDER_GROUP_MIN_SIZE = PLACEHOLDER_GROUP_MIN_SIZE;
global.PLACEHOLDER_PREVIEW_LENGTH = PLACEHOLDER_PREVIEW_LENGTH;
global.PLACEHOLDER_GROUP_PREVIEW_LENGTH = PLACEHOLDER_GROUP_PREVIEW_LENGTH;
global.CONTAINER_MAX_RETRIES = CONTAINER_MAX_RETRIES;
global.CONTAINER_RETRY_IDLE_TIMEOUT_MS = CONTAINER_RETRY_IDLE_TIMEOUT_MS;
global.CONTAINER_RETRY_DELAY_MS = CONTAINER_RETRY_DELAY_MS;
global.TRIM_DEBOUNCE_MS = TRIM_DEBOUNCE_MS;
global.MEMORY_MONITOR_INTERVAL_MS = MEMORY_MONITOR_INTERVAL_MS;
global.POPUP_STATUS_CLEAR_MS = POPUP_STATUS_CLEAR_MS;
global.POPUP_STATS_REFRESH_MS = POPUP_STATS_REFRESH_MS;

const { ChatGPTAdapter } = require('../content/sites/chatgpt.js');
const { GeminiAdapter } = require('../content/sites/gemini.js');
const { ClaudeAdapter } = require('../content/sites/claude.js');
const { PerplexityAdapter } = require('../content/sites/perplexity.js');
const { CopilotAdapter } = require('../content/sites/copilot.js');
const { DomTrimmer } = require('../content/core/dom-trimmer.js');
const manifest = require('../manifest.json');

// ---------------------------------------------------------------------------
// Site Detection Tests
// ---------------------------------------------------------------------------
function testSiteAdapterBasics() {
  const adapters = [
    { cls: ChatGPTAdapter, id: SITE_IDS.CHATGPT },
    { cls: GeminiAdapter, id: SITE_IDS.GEMINI },
    { cls: ClaudeAdapter, id: SITE_IDS.CLAUDE },
    { cls: PerplexityAdapter, id: SITE_IDS.PERPLEXITY },
    { cls: CopilotAdapter, id: SITE_IDS.COPILOT }
  ];

  for (const { cls, id } of adapters) {
    const adapter = new cls();
    assert.strictEqual(adapter.SITE_ID, id, `${cls.name} should have correct SITE_ID`);
    assert.strictEqual(typeof adapter.getChatContainer, 'function', `${cls.name} should have getChatContainer`);
    assert.strictEqual(typeof adapter.getMessageContainers, 'function', `${cls.name} should have getMessageContainers`);
    assert.strictEqual(typeof adapter.observeNewMessages, 'function', `${cls.name} should have observeNewMessages`);
  }
}

function testSiteDetectionLogic() {
  const testCases = [
    { hostname: 'chatgpt.com', expected: SITE_IDS.CHATGPT },
    { hostname: 'sub.chatgpt.com', expected: SITE_IDS.CHATGPT },
    { hostname: 'gemini.google.com', expected: SITE_IDS.GEMINI },
    { hostname: 'aistudio.google.com', expected: SITE_IDS.GEMINI },
    { hostname: 'claude.ai', expected: SITE_IDS.CLAUDE },
    { hostname: 'sub.claude.ai', expected: SITE_IDS.CLAUDE },
    { hostname: 'perplexity.ai', expected: SITE_IDS.PERPLEXITY },
    { hostname: 'sub.perplexity.ai', expected: SITE_IDS.PERPLEXITY },
    { hostname: 'copilot.microsoft.com', expected: SITE_IDS.COPILOT },
    { hostname: 'unknown.com', expected: null }
  ];

  for (const { hostname, expected } of testCases) {
    assert.strictEqual(detectSiteFromHostname(hostname), expected, `Expected ${expected} for ${hostname}`);
  }
}

// ---------------------------------------------------------------------------
// Settings Merging Tests
// ---------------------------------------------------------------------------
function testSettingsMerging() {
  const baseSettings = { ...DEFAULT_SETTINGS, maxMessages: 15, trimMode: 'placeholder' };

  const noOverride = { ...baseSettings, siteOverrides: {} };
  const merged1 = getSiteSettings(noOverride, SITE_IDS.CHATGPT);
  assert.strictEqual(merged1.maxMessages, 15);
  assert.strictEqual(merged1.trimMode, 'placeholder');

  const withOverride = {
    ...baseSettings,
    siteOverrides: {
      chatgpt: { maxMessages: 25, trimMode: 'collapse' }
    }
  };
  const merged2 = getSiteSettings(withOverride, SITE_IDS.CHATGPT);
  assert.strictEqual(merged2.maxMessages, 25);
  assert.strictEqual(merged2.trimMode, 'collapse');
  assert.strictEqual(merged2.enabled, true);

  const partialOverride = {
    ...baseSettings,
    siteOverrides: {
      claude: { maxMessages: 5 }
    }
  };
  const merged3 = getSiteSettings(partialOverride, SITE_IDS.CLAUDE);
  assert.strictEqual(merged3.maxMessages, 5);
  assert.strictEqual(merged3.trimMode, 'placeholder');

  const disabledOverride = getSiteSettings({
    ...baseSettings,
    siteOverrides: {
      perplexity: { enabled: false, maxMessages: 20, trimMode: 'remove' }
    }
  }, SITE_IDS.PERPLEXITY);
  assert.strictEqual(disabledOverride.enabled, false);
  assert.strictEqual(disabledOverride.maxMessages, 20);
}

function testDefaultSiteOverrideShape() {
  assert.ok(DEFAULT_SITE_OVERRIDE);
  assert.strictEqual(typeof DEFAULT_SITE_OVERRIDE.enabled, 'boolean');
  assert.strictEqual(typeof DEFAULT_SITE_OVERRIDE.maxMessages, 'number');
  assert.strictEqual(typeof DEFAULT_SITE_OVERRIDE.trimMode, 'string');
}

function testManifestScriptingPermission() {
  assert.ok(manifest.permissions.includes('scripting'), 'Background recovery injection requires scripting permission');
}

function testNormalizeSettings() {
  const normalizedEmpty = normalizeSettings(null);
  assert.strictEqual(normalizedEmpty.enabled, DEFAULT_SETTINGS.enabled);
  assert.strictEqual('enableObserverCleanup' in normalizedEmpty, false);
  assert.strictEqual('cleanupIntervalMs' in normalizedEmpty, false);
  assert.deepStrictEqual(normalizedEmpty.siteOverrides, {});

  const normalizedPartial = normalizeSettings({
    maxMessages: 30,
    trimMode: 'bad-mode',
    siteOverrides: {
      chatgpt: { enabled: false, maxMessages: 7, trimMode: TRIM_MODES.COLLAPSE },
      unknown: { enabled: false }
    }
  });

  assert.strictEqual(normalizedPartial.maxMessages, 30);
  assert.strictEqual(normalizedPartial.trimMode, DEFAULT_SETTINGS.trimMode);
  assert.strictEqual(normalizedPartial.siteOverrides.chatgpt.enabled, false);
  assert.strictEqual(normalizedPartial.siteOverrides.chatgpt.maxMessages, 7);
  assert.strictEqual(normalizedPartial.siteOverrides.chatgpt.trimMode, TRIM_MODES.COLLAPSE);
  assert.strictEqual(normalizedPartial.siteOverrides.unknown, undefined);
}

// ---------------------------------------------------------------------------
// Trim Mode Behavior Tests
// ---------------------------------------------------------------------------
function testDomTrimmerInitialization() {
  const adapter = new ChatGPTAdapter();
  const settings = { enabled: true, maxMessages: 10, trimMode: 'placeholder' };
  const trimmer = new DomTrimmer(adapter, settings);

  assert.strictEqual(trimmer.adapter, adapter);
  assert.strictEqual(trimmer.settings, settings);
  assert.strictEqual(trimmer.trimmedCount, 0);
  assert.strictEqual(trimmer.observer, null);
  assert.strictEqual(trimmer.isTrimming, false);
}

function testDomTrimmerPlaceholderMode() {
  let replaced = false;
  const mockEl = {
    hasAttribute: () => false,
    setAttribute: () => {},
    getAttribute: () => null,
    removeAttribute: () => {},
    parentNode: { insertBefore: () => {}, appendChild: () => {} },
    nextSibling: null,
    outerHTML: '<div>test</div>',
    textContent: 'Hello world this is a test message',
    cloneNode: function(deep) {
      return {
        querySelectorAll: () => [],
        textContent: 'Hello world this is a test message',
        removeAttribute: () => {},
        classList: { remove: () => {} },
        isConnected: true
      };
    },
    querySelectorAll: () => [],
    replaceWith: function() { replaced = true; },
    style: {},
    classList: { add: () => {}, remove: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  const adapter = new ChatGPTAdapter();
  const settings = { enabled: true, maxMessages: 1, trimMode: TRIM_MODES.PLACEHOLDER };
  const trimmer = new DomTrimmer(adapter, settings);

  trimmer.trimElement(mockEl, TRIM_MODES.PLACEHOLDER);
  assert.strictEqual(replaced, true, 'Placeholder mode should replace element');
  assert.strictEqual(trimmer.trimmedCount, 1);
}

function testDomTrimmerGroupsLargePlaceholderBatches() {
  const originalCreateElement = document.createElement;
  document.createElement = (tag) => {
    const element = originalCreateElement(tag);
    if (tag === 'div') {
      element.firstElementChild = {
        removeAttribute: () => {},
        classList: { remove: () => {} }
      };
    }
    return element;
  };

  const parent = {
    inserted: [],
    insertBefore: function(child, referenceNode) {
      child.parentNode = this;
      this.inserted.push({ child, referenceNode });
      return child;
    }
  };
  const elements = Array.from({ length: PLACEHOLDER_GROUP_MIN_SIZE + 2 }, (_, index) => ({
    hasAttribute: () => false,
    parentNode: parent,
    nextSibling: null,
    outerHTML: `<div>Message ${index}</div>`,
    textContent: `Message ${index}`,
    cloneNode: function(deep) {
      return {
        querySelectorAll: () => [],
        textContent: `Message ${index}`,
        removeAttribute: () => {},
        classList: { remove: () => {} },
        isConnected: true
      };
    },
    remove: function() { this.removed = true; }
  }));

  const adapter = new ChatGPTAdapter();
  const settings = { enabled: true, maxMessages: 1, trimMode: TRIM_MODES.PLACEHOLDER };
  const trimmer = new DomTrimmer(adapter, settings);

  try {
    trimmer.placeholderElements(elements);

    assert.strictEqual(parent.inserted.length, 1, 'Large batches should create one grouped placeholder');
    assert.strictEqual(trimmer.trimmedCount, elements.length);
    assert.ok(parent.inserted[0].child.textContent.includes(`${elements.length} trimmed messages`));
    assert.ok(elements.every(el => el.removed), 'Grouped source elements should be removed');
  } finally {
    document.createElement = originalCreateElement;
  }
}

function testDomTrimmerRestoresGroupedPlaceholderInOrder() {
  const originalCreateElement = document.createElement;
  document.createElement = (tag) => {
    const element = originalCreateElement(tag);
    if (tag === 'div') {
      element.firstElementChild = {
        restoredIndex: null,
        removeAttribute: () => {},
        classList: { remove: () => {} }
      };
      Object.defineProperty(element, 'innerHTML', {
        set(value) {
          const match = value.match(/Message (\d+)/);
          this.firstElementChild.restoredIndex = match ? Number(match[1]) : null;
        }
      });
    }
    return element;
  };

  const parent = {
    restored: [],
    insertBefore: function(child, referenceNode) {
      child.parentNode = this;
      this.restored.push({ child, referenceNode });
      return child;
    }
  };
  const elements = Array.from({ length: PLACEHOLDER_GROUP_MIN_SIZE }, (_, index) => ({
    hasAttribute: () => false,
    parentNode: parent,
    nextSibling: null,
    outerHTML: `<div>Message ${index}</div>`,
    textContent: `Message ${index}`,
    cloneNode: function(deep) {
      return {
        querySelectorAll: () => [],
        textContent: `Message ${index}`,
        removeAttribute: () => {},
        classList: { remove: () => {} },
        isConnected: true,
        restoredIndex: index
      };
    },
    remove: function() { this.removed = true; }
  }));

  const adapter = new ChatGPTAdapter();
  const settings = { enabled: true, maxMessages: 1, trimMode: TRIM_MODES.PLACEHOLDER };
  const trimmer = new DomTrimmer(adapter, settings);

  try {
    trimmer.placeholderElements(elements);
    const placeholder = parent.restored[0].child;
    parent.restored = [];
    placeholder._restore();

    assert.strictEqual(parent.restored.length, PLACEHOLDER_GROUP_MIN_SIZE);
    assert.strictEqual(trimmer.trimmedCount, 0);
  } finally {
    document.createElement = originalCreateElement;
  }
}

function testDomTrimmerCollapseMode() {
  let clickHandler = null;
  const mockEl = {
    hasAttribute: () => false,
    setAttribute: function(k, v) { this.attributes[k] = v; },
    getAttribute: function(k) { return this.attributes[k]; },
    removeAttribute: function(k) { delete this.attributes[k]; },
    attributes: {},
    scrollHeight: 200,
    style: {},
    textContent: 'Collapsed message content',
    cloneNode: () => ({ querySelectorAll: () => [], textContent: 'Collapsed message content' }),
    querySelectorAll: () => [],
    addEventListener: function(event, handler) { if (event === 'click') clickHandler = handler; },
    removeEventListener: () => {}
  };

  const adapter = new ChatGPTAdapter();
  const settings = { enabled: true, maxMessages: 1, trimMode: TRIM_MODES.COLLAPSE };
  const trimmer = new DomTrimmer(adapter, settings);

  trimmer.trimElement(mockEl, TRIM_MODES.COLLAPSE);
  assert.ok(mockEl.style.cssText.includes('max-height:40px'), 'Collapse mode should set max-height');
  assert.ok(mockEl.style.cssText.includes('overflow:hidden'), 'Collapse mode should set overflow');
  assert.strictEqual(mockEl.attributes['data-aico-mode'], 'collapse', 'Collapse should set data-aico-mode');
  assert.strictEqual(trimmer.trimmedCount, 1);
  assert.ok(clickHandler, 'Collapse mode should attach click handler');
}

function testDomTrimmerRemoveMode() {
  let removed = false;
  const mockEl = {
    hasAttribute: () => false,
    remove: function() { removed = true; },
    querySelectorAll: () => [],
    onclick: null,
    onmouseover: null,
    onmouseout: null,
    onload: null,
    onerror: null
  };

  const adapter = new ChatGPTAdapter();
  const settings = { enabled: true, maxMessages: 1, trimMode: TRIM_MODES.REMOVE };
  const trimmer = new DomTrimmer(adapter, settings);

  trimmer.trimElement(mockEl, TRIM_MODES.REMOVE);
  assert.strictEqual(removed, true, 'Remove mode should remove element');
  assert.strictEqual(trimmer.trimmedCount, 1);
}

function testDomTrimmerStats() {
  const adapter = new ChatGPTAdapter();
  const settings = { enabled: true, maxMessages: 10, trimMode: 'placeholder' };
  const trimmer = new DomTrimmer(adapter, settings);

  const stats = trimmer.getStats();
  assert.strictEqual(typeof stats.domNodes, 'number');
  assert.strictEqual(typeof stats.messageCount, 'number');
  assert.strictEqual(stats.trimmedCount, 0);
  assert.strictEqual(stats.siteId, SITE_IDS.CHATGPT);
}

function testDomTrimmerRestoreAll() {
  const adapter = new ChatGPTAdapter();
  const settings = { enabled: true, maxMessages: 10, trimMode: 'placeholder' };
  const trimmer = new DomTrimmer(adapter, settings);
  trimmer.trimmedCount = 5;

  const originalQSA = document.querySelectorAll;
  document.querySelectorAll = () => [];

  trimmer.restoreAll();
  assert.strictEqual(trimmer.trimmedCount, 0);

  document.querySelectorAll = originalQSA;
}

function testDomTrimmerPlaceholderRestoreUsesPlaceholderParent() {
  const originalCreateElement = document.createElement;
  document.createElement = (tag) => {
    if (tag === 'div') {
      const element = originalCreateElement(tag);
      element.firstElementChild = {
        inserted: false,
        removeAttribute: () => {},
        classList: { remove: () => {} }
      };
      return element;
    }
    return originalCreateElement(tag);
  };

  const adapter = new ChatGPTAdapter();
  const settings = { enabled: true, maxMessages: 1, trimMode: TRIM_MODES.PLACEHOLDER };
  const trimmer = new DomTrimmer(adapter, settings);

  let placeholderNode = null;
  const fallbackParent = {
    insertBefore: (restored, referenceNode) => {
      assert.strictEqual(referenceNode, placeholderNode);
      restored.inserted = true;
    }
  };
  const originalParent = {
    insertBefore: () => { throw new Error('Should not use stale original parent'); },
    appendChild: () => { throw new Error('Should not append to stale original parent'); }
  };
  const mockEl = {
    hasAttribute: () => false,
    parentNode: originalParent,
    nextSibling: { parentNode: null },
    outerHTML: '<div>restored</div>',
    textContent: 'Restorable message',
    cloneNode: function(deep) {
      return {
        querySelectorAll: () => [],
        textContent: 'Restorable message',
        removeAttribute: () => {},
        classList: { remove: () => {} },
        isConnected: true,
        inserted: false
      };
    },
    replaceWith: function(placeholder) {
      placeholderNode = placeholder;
      placeholder.parentNode = fallbackParent;
    }
  };

  try {
    trimmer.trimElement(mockEl, TRIM_MODES.PLACEHOLDER);
    assert.ok(placeholderNode._restore, 'Placeholder should expose restore handler');
    placeholderNode._restore();
    assert.strictEqual(trimmer.trimmedCount, 0);
  } finally {
    document.createElement = originalCreateElement;
  }
}

function testContainerMaxRetriesConstant() {
  assert.strictEqual(typeof CONTAINER_MAX_RETRIES, 'number');
  assert.ok(CONTAINER_MAX_RETRIES > 0, 'CONTAINER_MAX_RETRIES should be positive');
  assert.strictEqual(typeof CONTAINER_RETRY_IDLE_TIMEOUT_MS, 'number');
  assert.strictEqual(typeof CONTAINER_RETRY_DELAY_MS, 'number');
  assert.strictEqual(typeof TRIM_DEBOUNCE_MS, 'number');
  assert.strictEqual(typeof MEMORY_MONITOR_INTERVAL_MS, 'number');
  assert.strictEqual(typeof POPUP_STATUS_CLEAR_MS, 'number');
  assert.strictEqual(typeof POPUP_STATS_REFRESH_MS, 'number');
}

function testCountTrimmedMessages() {
  const adapter = new ChatGPTAdapter();
  const settings = { enabled: true, maxMessages: 10, trimMode: 'placeholder' };
  const trimmer = new DomTrimmer(adapter, settings);

  // No trimmed elements
  const saved = mockQuerySelectorAllResult;
  mockQuerySelectorAllResult = [];
  assert.strictEqual(trimmer.countTrimmedMessages(), 0);

  // Individual placeholders (count = number of elements)
  mockQuerySelectorAllResult = [
    { getAttribute: () => 'placeholder', textContent: '[#1] Hello world' },
    { getAttribute: () => 'placeholder', textContent: '[#2] Another message' },
    { getAttribute: () => 'collapse', textContent: 'Collapsed' }
  ];
  assert.strictEqual(trimmer.countTrimmedMessages(), 3);

  // Grouped placeholder (count parsed from text)
  mockQuerySelectorAllResult = [
    { getAttribute: () => 'placeholder', textContent: '[15 trimmed messages] first ... last' },
    { getAttribute: () => 'placeholder', textContent: '[#16] Single message' }
  ];
  assert.strictEqual(trimmer.countTrimmedMessages(), 16);

  mockQuerySelectorAllResult = saved;
}

function testGetStatsUsesDOMCount() {
  const adapter = new ChatGPTAdapter();
  const settings = { enabled: true, maxMessages: 10, trimMode: 'placeholder' };
  const trimmer = new DomTrimmer(adapter, settings);

  // Set accumulator to wrong value
  trimmer.trimmedCount = 999;

  // getStats should use DOM count, not accumulator
  const saved = mockQuerySelectorAllResult;
  mockQuerySelectorAllResult = [
    { getAttribute: () => 'placeholder', textContent: '[5 trimmed messages] a ... b' }
  ];

  const stats = trimmer.getStats();
  assert.strictEqual(stats.trimmedCount, 5, 'getStats should return DOM count, not accumulator');

  mockQuerySelectorAllResult = saved;
}

function testDomTrimmerResetsTrimGuardAfterTrimError() {
  const adapter = {
    SITE_ID: SITE_IDS.CHATGPT,
    getMessageContainers: () => [
      { hasAttribute: () => false, parentNode: {} },
      { hasAttribute: () => false, parentNode: {} }
    ]
  };
  const debug = { log: () => {}, warn: () => {}, info: () => {}, error: () => {} };
  const settings = { enabled: true, maxMessages: 1, trimMode: TRIM_MODES.PLACEHOLDER };
  const trimmer = new DomTrimmer(adapter, settings, debug);

  trimmer.placeholderElements = () => {
    throw new Error('mock trim failure');
  };

  trimmer.performTrim();
  assert.strictEqual(trimmer.isTrimming, false, 'performTrim should always clear isTrimming');
}

// ---------------------------------------------------------------------------
// Test Runner
// ---------------------------------------------------------------------------
function runTests() {
  const tests = [
    { name: 'siteAdapterBasics', fn: testSiteAdapterBasics },
    { name: 'siteDetectionLogic', fn: testSiteDetectionLogic },
    { name: 'settingsMerging', fn: testSettingsMerging },
    { name: 'defaultSiteOverrideShape', fn: testDefaultSiteOverrideShape },
    { name: 'manifestScriptingPermission', fn: testManifestScriptingPermission },
    { name: 'normalizeSettings', fn: testNormalizeSettings },
    { name: 'domTrimmerInitialization', fn: testDomTrimmerInitialization },
    { name: 'domTrimmerPlaceholderMode', fn: testDomTrimmerPlaceholderMode },
    { name: 'domTrimmerGroupsLargePlaceholderBatches', fn: testDomTrimmerGroupsLargePlaceholderBatches },
    { name: 'domTrimmerRestoresGroupedPlaceholderInOrder', fn: testDomTrimmerRestoresGroupedPlaceholderInOrder },
    { name: 'domTrimmerCollapseMode', fn: testDomTrimmerCollapseMode },
    { name: 'domTrimmerRemoveMode', fn: testDomTrimmerRemoveMode },
    { name: 'domTrimmerStats', fn: testDomTrimmerStats },
    { name: 'domTrimmerRestoreAll', fn: testDomTrimmerRestoreAll },
    { name: 'domTrimmerPlaceholderRestoreUsesPlaceholderParent', fn: testDomTrimmerPlaceholderRestoreUsesPlaceholderParent },
    { name: 'containerMaxRetriesConstant', fn: testContainerMaxRetriesConstant },
    { name: 'countTrimmedMessages', fn: testCountTrimmedMessages },
    { name: 'getStatsUsesDOMCount', fn: testGetStatsUsesDOMCount },
    { name: 'domTrimmerResetsTrimGuardAfterTrimError', fn: testDomTrimmerResetsTrimGuardAfterTrimError }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      test.fn();
      console.log(`  PASS: ${test.name}`);
      passed++;
    } catch (error) {
      console.error(`  FAIL: ${test.name}`);
      console.error(`    ${error.message}`);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
