const assert = require('assert');

// ---------------------------------------------------------------------------
// Mocks for browser globals
// ---------------------------------------------------------------------------
global.document = {
  querySelector: () => null,
  querySelectorAll: () => [],
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
    cloneNode: function() { return { ...this, querySelectorAll: () => [] }; },
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelectorAll: () => []
  }),
  querySelectorAll: () => []
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
const { DEFAULT_SETTINGS, DEFAULT_SITE_OVERRIDE, TRIM_MODES, SITE_IDS, SITE_NAMES, MESSAGES, SELECTORS } = require('../utils/constants.js');

// Inject constants into global scope so site adapters can access them
global.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
global.TRIM_MODES = TRIM_MODES;
global.SITE_IDS = SITE_IDS;
global.SITE_NAMES = SITE_NAMES;
global.MESSAGES = MESSAGES;
global.SELECTORS = SELECTORS;

const { ChatGPTAdapter } = require('../content/sites/chatgpt.js');
const { GeminiAdapter } = require('../content/sites/gemini.js');
const { ClaudeAdapter } = require('../content/sites/claude.js');
const { PerplexityAdapter } = require('../content/sites/perplexity.js');
const { CopilotAdapter } = require('../content/sites/copilot.js');
const { DomTrimmer } = require('../content/core/dom-trimmer.js');

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
    // Replicate detectSite logic
    const SITE_URL_MAP = {
      'chatgpt.com': SITE_IDS.CHATGPT,
      'gemini.google.com': SITE_IDS.GEMINI,
      'aistudio.google.com': SITE_IDS.GEMINI,
      'claude.ai': SITE_IDS.CLAUDE,
      'perplexity.ai': SITE_IDS.PERPLEXITY,
      'copilot.microsoft.com': SITE_IDS.COPILOT
    };

    let result = SITE_URL_MAP[hostname] || null;
    if (!result && hostname.endsWith('.chatgpt.com')) result = SITE_IDS.CHATGPT;
    if (!result && hostname.endsWith('.claude.ai')) result = SITE_IDS.CLAUDE;
    if (!result && hostname.endsWith('.perplexity.ai')) result = SITE_IDS.PERPLEXITY;

    assert.strictEqual(result, expected, `Expected ${expected} for ${hostname}`);
  }
}

// ---------------------------------------------------------------------------
// Settings Merging Tests
// ---------------------------------------------------------------------------
function testSettingsMerging() {
  const baseSettings = { ...DEFAULT_SETTINGS, maxMessages: 15, trimMode: 'placeholder' };

  // No override
  const noOverride = { ...baseSettings, siteOverrides: {} };
  const merged1 = { ...noOverride, ...(noOverride.siteOverrides.chatgpt || {}) };
  assert.strictEqual(merged1.maxMessages, 15);
  assert.strictEqual(merged1.trimMode, 'placeholder');

  // With override
  const withOverride = {
    ...baseSettings,
    siteOverrides: {
      chatgpt: { maxMessages: 25, trimMode: 'collapse' }
    }
  };
  const merged2 = { ...withOverride, ...(withOverride.siteOverrides.chatgpt || {}) };
  assert.strictEqual(merged2.maxMessages, 25);
  assert.strictEqual(merged2.trimMode, 'collapse');
  assert.strictEqual(merged2.enabled, true); // base preserved

  // Partial override
  const partialOverride = {
    ...baseSettings,
    siteOverrides: {
      claude: { maxMessages: 5 }
    }
  };
  const merged3 = { ...partialOverride, ...(partialOverride.siteOverrides.claude || {}) };
  assert.strictEqual(merged3.maxMessages, 5);
  assert.strictEqual(merged3.trimMode, 'placeholder'); // base preserved
}

function testDefaultSiteOverrideShape() {
  assert.ok(DEFAULT_SITE_OVERRIDE);
  assert.strictEqual(typeof DEFAULT_SITE_OVERRIDE.enabled, 'boolean');
  assert.strictEqual(typeof DEFAULT_SITE_OVERRIDE.maxMessages, 'number');
  assert.strictEqual(typeof DEFAULT_SITE_OVERRIDE.trimMode, 'string');
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
    cloneNode: () => ({ querySelectorAll: () => [], textContent: 'Hello world this is a test message' }),
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

  // Mock querySelectorAll for placeholders
  const originalQSA = document.querySelectorAll;
  document.querySelectorAll = () => [];

  trimmer.restoreAll();
  assert.strictEqual(trimmer.trimmedCount, 0);

  document.querySelectorAll = originalQSA;
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
    { name: 'domTrimmerInitialization', fn: testDomTrimmerInitialization },
    { name: 'domTrimmerPlaceholderMode', fn: testDomTrimmerPlaceholderMode },
    { name: 'domTrimmerCollapseMode', fn: testDomTrimmerCollapseMode },
    { name: 'domTrimmerRemoveMode', fn: testDomTrimmerRemoveMode },
    { name: 'domTrimmerStats', fn: testDomTrimmerStats },
    { name: 'domTrimmerRestoreAll', fn: testDomTrimmerRestoreAll }
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
