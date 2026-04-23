const STORAGE_KEY = 'aico_settings';
const MANIFEST_VERSION = 3;
const DEFAULT_MAX_MESSAGES = 15;
const PLACEHOLDER_GROUP_MIN_SIZE = 3;
const PLACEHOLDER_PREVIEW_LENGTH = 80;
const PLACEHOLDER_GROUP_PREVIEW_LENGTH = 60;

const CONTAINER_MAX_RETRIES = 60;

const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  maxMessages: DEFAULT_MAX_MESSAGES,
  trimMode: 'placeholder',
  enableMemoryMonitor: false,
  debugMode: false,
  siteOverrides: {}
});

const DEFAULT_SITE_OVERRIDE = Object.freeze({
  enabled: true,
  maxMessages: DEFAULT_MAX_MESSAGES,
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

const WILDCARD_SITE_SUFFIXES = Object.freeze({
  '.chatgpt.com': SITE_IDS.CHATGPT,
  '.claude.ai': SITE_IDS.CLAUDE,
  '.perplexity.ai': SITE_IDS.PERPLEXITY
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

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSiteOverride(override) {
  const source = isObject(override) ? override : {};
  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : DEFAULT_SITE_OVERRIDE.enabled,
    maxMessages: Number.isInteger(source.maxMessages) ? source.maxMessages : DEFAULT_SITE_OVERRIDE.maxMessages,
    trimMode: Object.values(TRIM_MODES).includes(source.trimMode) ? source.trimMode : DEFAULT_SITE_OVERRIDE.trimMode
  };
}

function normalizeSettings(settings) {
  const source = isObject(settings) ? settings : {};
  const siteOverrides = {};
  const rawOverrides = isObject(source.siteOverrides) ? source.siteOverrides : {};

  for (const siteId of Object.values(SITE_IDS)) {
    if (isObject(rawOverrides[siteId])) {
      siteOverrides[siteId] = normalizeSiteOverride(rawOverrides[siteId]);
    }
  }

  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : DEFAULT_SETTINGS.enabled,
    maxMessages: Number.isInteger(source.maxMessages) ? source.maxMessages : DEFAULT_SETTINGS.maxMessages,
    trimMode: Object.values(TRIM_MODES).includes(source.trimMode) ? source.trimMode : DEFAULT_SETTINGS.trimMode,
    enableMemoryMonitor: typeof source.enableMemoryMonitor === 'boolean' ? source.enableMemoryMonitor : DEFAULT_SETTINGS.enableMemoryMonitor,
    debugMode: typeof source.debugMode === 'boolean' ? source.debugMode : DEFAULT_SETTINGS.debugMode,
    siteOverrides
  };
}

function getSiteSettings(settings, siteId) {
  const normalizedSettings = normalizeSettings(settings);
  const overrides = normalizedSettings.siteOverrides[siteId] || {};
  return { ...normalizedSettings, ...overrides };
}

function detectSiteFromHostname(hostname) {
  if (SITE_URL_MAP[hostname]) {
    return SITE_URL_MAP[hostname];
  }

  for (const [suffix, siteId] of Object.entries(WILDCARD_SITE_SUFFIXES)) {
    if (hostname.endsWith(suffix)) {
      return siteId;
    }
  }

  return null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STORAGE_KEY,
    MANIFEST_VERSION,
    DEFAULT_MAX_MESSAGES,
    PLACEHOLDER_GROUP_MIN_SIZE,
    PLACEHOLDER_PREVIEW_LENGTH,
    PLACEHOLDER_GROUP_PREVIEW_LENGTH,
    CONTAINER_MAX_RETRIES,
    DEFAULT_SETTINGS,
    DEFAULT_SITE_OVERRIDE,
    TRIM_MODES,
    SITE_IDS,
    SITE_NAMES,
    SITE_URL_MAP,
    WILDCARD_SITE_SUFFIXES,
    MESSAGES,
    SELECTORS,
    normalizeSettings,
    normalizeSiteOverride,
    getSiteSettings,
    detectSiteFromHostname
  };
}
