const $ = (id) => document.getElementById(id);

let currentSettings = null;

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
  $('observerCleanup').checked = settings.enableObserverCleanup;
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

    card.innerHTML = `
      <div class="site-card-header">
        <span>${siteName}</span>
        <label class="toggle small" title="Enable override">
          <input type="checkbox" class="site-override-toggle" ${isOverridden ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="site-override-fields" style="${isOverridden ? '' : 'display:none; opacity:0.5; pointer-events:none;'}">
        <div class="site-card-row">
          <label>Enabled on site</label>
          <label class="toggle small">
            <input type="checkbox" class="site-enabled-toggle" ${siteEnabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="site-card-row">
          <label>Max messages</label>
          <div class="range-group">
            <input type="range" class="site-max-messages" min="5" max="50" value="${override.maxMessages || settings.maxMessages}">
            <span class="site-max-value">${override.maxMessages || settings.maxMessages}</span>
          </div>
        </div>
        <div class="site-card-row">
          <label>Trim mode</label>
          <select class="site-trim-mode">
            <option value="placeholder" ${(override.trimMode || settings.trimMode) === 'placeholder' ? 'selected' : ''}>Placeholder</option>
            <option value="collapse" ${(override.trimMode || settings.trimMode) === 'collapse' ? 'selected' : ''}>Collapse</option>
            <option value="remove" ${(override.trimMode || settings.trimMode) === 'remove' ? 'selected' : ''}>Remove</option>
          </select>
        </div>
      </div>
    `;

    const toggle = card.querySelector('.site-override-toggle');
    const fields = card.querySelector('.site-override-fields');
    const siteEnabledToggle = card.querySelector('.site-enabled-toggle');
    const maxInput = card.querySelector('.site-max-messages');
    const maxValue = card.querySelector('.site-max-value');
    const trimSelect = card.querySelector('.site-trim-mode');

    toggle.addEventListener('change', () => {
      const enabled = toggle.checked;
      fields.style.display = enabled ? '' : 'none';
      fields.style.opacity = enabled ? '' : '0.5';
      fields.style.pointerEvents = enabled ? '' : 'none';
      if (!enabled) {
        maxInput.value = settings.maxMessages;
        maxValue.textContent = settings.maxMessages;
        trimSelect.value = settings.trimMode;
        siteEnabledToggle.checked = true;
      }
      saveSettings();
    });

    maxInput.addEventListener('input', (e) => {
      maxValue.textContent = e.target.value;
    });
    siteEnabledToggle.addEventListener('change', saveSettings);
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
    enableObserverCleanup: $('observerCleanup').checked,
    enableMemoryMonitor: $('memoryMonitor').checked,
    debugMode: $('debugMode').checked,
    siteOverrides
  };

  await chrome.storage.sync.set({ [STORAGE_KEY]: currentSettings });

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    try {
      await chrome.tabs.sendMessage(tabs[0].id, {
        type: MESSAGES.SETTINGS_UPDATED,
        settings: normalizeSettings(currentSettings)
      });
    } catch {
      // Tab may not have content script injected
    }
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
      $('domNodes').textContent = response.domNodes || '--';
      $('trimmedCount').textContent = response.trimmedCount || '--';
      $('currentSite').textContent = response.siteId || '--';

      if (response.heapUsed !== undefined) {
        $('heapUsed').textContent = response.heapUsed + ' MB';
      } else {
        $('heapUsed').textContent = '--';
      }
      if (response.heapTotal !== undefined) {
        $('heapTotal').textContent = response.heapTotal + ' MB';
      } else {
        $('heapTotal').textContent = '--';
      }
      if (response.observerStats) {
        $('activeTimers').textContent = response.observerStats.total || '0';
      } else {
        $('activeTimers').textContent = '--';
      }
    }
  } catch {
    $('domNodes').textContent = '--';
    $('trimmedCount').textContent = '--';
    $('currentSite').textContent = '--';
    $('heapUsed').textContent = '--';
    $('heapTotal').textContent = '--';
    $('activeTimers').textContent = '--';
  }
}

$('globalToggle').addEventListener('change', saveSettings);
$('maxMessages').addEventListener('input', (e) => {
  $('maxMessagesValue').textContent = e.target.value;
});
$('maxMessages').addEventListener('change', saveSettings);
$('trimMode').addEventListener('change', saveSettings);
$('observerCleanup').addEventListener('change', saveSettings);
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
    setTimeout(refreshStats, 500);
  } catch {
    showStatus('Not on a supported site');
  }
});

$('restoreAll').addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: MESSAGES.RESTORE_ALL });
    if (response?.success === false) throw new Error(response.error);
    showStatus('All messages restored');
    setTimeout(refreshStats, 500);
  } catch {
    showStatus('Not on a supported site');
  }
});

loadSettings();
refreshStats();
