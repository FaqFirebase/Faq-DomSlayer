const STORAGE_KEY = 'aico_settings';

const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  maxMessages: 15,
  trimMode: 'placeholder',
  enableObserverCleanup: true,
  cleanupIntervalMs: 30000,
  enableMemoryMonitor: false,
  debugMode: false,
  siteOverrides: {}
});

const DEFAULT_SITE_OVERRIDE = Object.freeze({
  enabled: true,
  maxMessages: 15,
  trimMode: 'placeholder'
});

const TRIM_MODES = Object.freeze({
  PLACEHOLDER: 'placeholder',
  COLLAPSE: 'collapse',
  REMOVE: 'remove'
});

const SITE_IDS = Object.freeze({
  CHATGPT: 'chatgpt',
  GEMINI: 'gemini',
  CLAUDE: 'claude',
  PERPLEXITY: 'perplexity',
  COPILOT: 'copilot'
});

const SITE_NAMES = Object.freeze({
  [SITE_IDS.CHATGPT]: 'ChatGPT',
  [SITE_IDS.GEMINI]: 'Gemini',
  [SITE_IDS.CLAUDE]: 'Claude',
  [SITE_IDS.PERPLEXITY]: 'Perplexity',
  [SITE_IDS.COPILOT]: 'Copilot'
});

const SITE_URL_MAP = Object.freeze({
  'chatgpt.com': SITE_IDS.CHATGPT,
  'gemini.google.com': SITE_IDS.GEMINI,
  'aistudio.google.com': SITE_IDS.GEMINI,
  'claude.ai': SITE_IDS.CLAUDE,
  'perplexity.ai': SITE_IDS.PERPLEXITY,
  'copilot.microsoft.com': SITE_IDS.COPILOT
});

const MESSAGES = Object.freeze({
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  GET_STATS: 'GET_STATS',
  FORCE_CLEANUP: 'FORCE_CLEANUP',
  RESTORE_ALL: 'RESTORE_ALL'
});

const SELECTORS = Object.freeze({
  PLACEHOLDER_CLASS: 'aico-trimmed-placeholder',
  PLACEHOLDER_ATTR: 'data-aico-trimmed'
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEFAULT_SETTINGS, DEFAULT_SITE_OVERRIDE, TRIM_MODES, SITE_IDS, SITE_NAMES, SITE_URL_MAP, MESSAGES, SELECTORS };
}
