const $ = (id) => document.getElementById(id);

let currentSettings = null;
let refreshInterval = null;

async function loadSettings() {
  const data = await chrome.storage.sync.get(STORAGE_KEY);
  currentSettings = normalizeSettings(data[STORAGE_KEY]);
  applyToUI(currentSettings);
  buildSiteOverrides(currentSettings);
}

function applyToUI(settings) {
  $('globalToggle').checked = settings.enabled;
  $('maxMessages').value = settings.maxMessages;
  $('maxMessagesValue').textContent = settings.maxMessages;
  $('trimMode').value = settings.trimMode;
  $('memoryMonitor').checked = settings.enableMemoryMonitor;
  $('debugMode').checked = settings.debugMode || false;
  toggleMemoryStats(settings.enableMemoryMonitor);
}

function toggleMemoryStats(show) {
  $('memoryStatsSection').style.display = show ? 'grid' : 'none';
}

function buildSiteOverrides(settings) {
  const container = $('siteOverridesContent');
  container.innerHTML = '';

  for (const siteId of Object.values(SITE_IDS)) {
    const siteName = SITE_NAMES[siteId] || siteId;
    const override = settings.siteOverrides?.[siteId] || {};
    const isOverridden = !!settings.siteOverrides?.[siteId];
    const siteEnabled = override.enabled !== false;

    const card = document.createElement('div');
    card.className = 'site-card';
    card.dataset.siteId = siteId;

    const header = document.createElement('div');
    header.className = 'site-card-header';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = siteName;

    const overrideToggle = document.createElement('label');
    overrideToggle.className = 'toggle small';
    overrideToggle.title = 'Enable override';
    const overrideInput = document.createElement('input');
    overrideInput.type = 'checkbox';
    overrideInput.className = 'site-override-toggle';
    overrideInput.checked = isOverridden;
    const overrideSlider = document.createElement('span');
    overrideSlider.className = 'toggle-slider';
    overrideToggle.appendChild(overrideInput);
    overrideToggle.appendChild(overrideSlider);

    header.appendChild(nameSpan);
    header.appendChild(overrideToggle);

    const fields = document.createElement('div');
    fields.className = 'site-override-fields';
    if (!isOverridden) {
      fields.style.display = 'none';
      fields.style.opacity = '0.5';
      fields.style.pointerEvents = 'none';
    }

    const enabledRow = document.createElement('div');
    enabledRow.className = 'site-card-row';
    const enabledLabel = document.createElement('label');
    enabledLabel.textContent = 'Enabled on site';
    const enabledToggle = document.createElement('label');
    enabledToggle.className = 'toggle small';
    const enabledInput = document.createElement('input');
    enabledInput.type = 'checkbox';
    enabledInput.className = 'site-enabled-toggle';
    enabledInput.checked = siteEnabled;
    const enabledSlider = document.createElement('span');
    enabledSlider.className = 'toggle-slider';
    enabledToggle.appendChild(enabledInput);
    enabledToggle.appendChild(enabledSlider);
    enabledRow.appendChild(enabledLabel);
    enabledRow.appendChild(enabledToggle);

    const maxRow = document.createElement('div');
    maxRow.className = 'site-card-row';
    const maxLabel = document.createElement('label');
    maxLabel.textContent = 'Max messages';
    const maxGroup = document.createElement('div');
    maxGroup.className = 'range-group';
    const maxInput = document.createElement('input');
    maxInput.type = 'range';
    maxInput.className = 'site-max-messages';
    maxInput.min = '5';
    maxInput.max = '50';
    maxInput.value = override.maxMessages || settings.maxMessages;
    const maxValue = document.createElement('span');
    maxValue.className = 'site-max-value';
    maxValue.textContent = override.maxMessages || settings.maxMessages;
    maxGroup.appendChild(maxInput);
    maxGroup.appendChild(maxValue);
    maxRow.appendChild(maxLabel);
    maxRow.appendChild(maxGroup);

    const trimRow = document.createElement('div');
    trimRow.className = 'site-card-row';
    const trimLabel = document.createElement('label');
    trimLabel.textContent = 'Trim mode';
    const trimSelect = document.createElement('select');
    trimSelect.className = 'site-trim-mode';
    const currentTrimMode = override.trimMode || settings.trimMode;
    const modes = [
      { value: 'placeholder', label: 'Placeholder' },
      { value: 'collapse', label: 'Collapse' },
      { value: 'remove', label: 'Remove' }
    ];
    for (const mode of modes) {
      const opt = document.createElement('option');
      opt.value = mode.value;
      opt.textContent = mode.label;
      if (mode.value === currentTrimMode) opt.selected = true;
      trimSelect.appendChild(opt);
    }
    trimRow.appendChild(trimLabel);
    trimRow.appendChild(trimSelect);

    fields.appendChild(enabledRow);
    fields.appendChild(maxRow);
    fields.appendChild(trimRow);

    card.appendChild(header);
    card.appendChild(fields);

    overrideInput.addEventListener('change', () => {
      const enabled = overrideInput.checked;
      fields.style.display = enabled ? '' : 'none';
      fields.style.opacity = enabled ? '' : '0.5';
      fields.style.pointerEvents = enabled ? '' : 'none';
      if (!enabled) {
        maxInput.value = settings.maxMessages;
        maxValue.textContent = settings.maxMessages;
        trimSelect.value = settings.trimMode;
        enabledInput.checked = true;
      }
      saveSettings();
    });

    maxInput.addEventListener('input', (e) => {
      maxValue.textContent = e.target.value;
    });
    enabledInput.addEventListener('change', saveSettings);
    maxInput.addEventListener('change', saveSettings);
    trimSelect.addEventListener('change', saveSettings);

    container.appendChild(card);
  }
}

async function saveSettings() {
  const siteOverrides = {};
  const cards = document.querySelectorAll('.site-card');
  for (const card of cards) {
    const siteId = card.dataset.siteId;
    const toggle = card.querySelector('.site-override-toggle');
    if (toggle.checked) {
      siteOverrides[siteId] = {
        enabled: card.querySelector('.site-enabled-toggle').checked,
        maxMessages: parseInt(card.querySelector('.site-max-messages').value, 10),
        trimMode: card.querySelector('.site-trim-mode').value
      };
    }
  }

  currentSettings = {
    enabled: $('globalToggle').checked,
    maxMessages: parseInt($('maxMessages').value, 10),
    trimMode: $('trimMode').value,
    enableMemoryMonitor: $('memoryMonitor').checked,
    debugMode: $('debugMode').checked,
    siteOverrides
  };

  await chrome.storage.sync.set({ [STORAGE_KEY]: currentSettings });

  try {
    await chrome.runtime.sendMessage({
      type: MESSAGES.SETTINGS_UPDATED,
      settings: normalizeSettings(currentSettings)
    });
  } catch {
    // Background or content script may not be available
  }

  showStatus('Settings saved');
}

function showStatus(text) {
  $('statusText').textContent = text;
  setTimeout(() => { $('statusText').textContent = ''; }, 1500);
}

async function refreshStats() {
  try {
    const response = await chrome.runtime.sendMessage({ type: MESSAGES.GET_STATS });
    if (response && response.success !== false) {
      $('domNodes').textContent = response.domNodes != null ? response.domNodes : '--';
      $('trimmedCount').textContent = response.trimmedCount != null ? response.trimmedCount : '--';
      $('currentSite').textContent = response.siteId || '--';

      if (response.heapUsed != null) {
        $('heapUsed').textContent = response.heapUsed + ' MB';
      } else {
        $('heapUsed').textContent = '--';
      }
      if (response.heapTotal != null) {
        $('heapTotal').textContent = response.heapTotal + ' MB';
      } else {
        $('heapTotal').textContent = '--';
      }
    }
  } catch {
    $('domNodes').textContent = '--';
    $('trimmedCount').textContent = '--';
    $('currentSite').textContent = '--';
    $('heapUsed').textContent = '--';
    $('heapTotal').textContent = '--';
  }
}

function startAutoRefresh() {
  stopAutoRefresh();
  refreshStats();
  refreshInterval = setInterval(refreshStats, 2000);
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

$('globalToggle').addEventListener('change', saveSettings);
$('maxMessages').addEventListener('input', (e) => {
  $('maxMessagesValue').textContent = e.target.value;
});
$('maxMessages').addEventListener('change', saveSettings);
$('trimMode').addEventListener('change', saveSettings);
$('memoryMonitor').addEventListener('change', () => {
  toggleMemoryStats($('memoryMonitor').checked);
  saveSettings();
});
$('debugMode').addEventListener('change', saveSettings);

$('siteOverridesToggle').addEventListener('click', () => {
  const section = $('siteOverridesToggle').parentElement;
  section.classList.toggle('collapsed');
});

$('forceCleanup').addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: MESSAGES.FORCE_CLEANUP });
    if (response?.success === false) throw new Error(response.error);
    showStatus('Cleanup performed');
  } catch {
    showStatus('Not on a supported site');
  }
});

$('restoreAll').addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: MESSAGES.RESTORE_ALL });
    if (response?.success === false) throw new Error(response.error);
    showStatus('All messages restored');
  } catch {
    showStatus('Not on a supported site');
  }
});

loadSettings();
startAutoRefresh();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopAutoRefresh();
  } else {
    startAutoRefresh();
  }
});
