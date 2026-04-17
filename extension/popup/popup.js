const $ = (id) => document.getElementById(id);

let currentSettings = null;

async function loadSettings() {
  const data = await chrome.storage.sync.get(STORAGE_KEY);
  currentSettings = data[STORAGE_KEY] || DEFAULT_SETTINGS;
  applyToUI(currentSettings);
}

function applyToUI(settings) {
  $('globalToggle').checked = settings.enabled;
  $('maxMessages').value = settings.maxMessages;
  $('maxMessagesValue').textContent = settings.maxMessages;
  $('trimMode').value = settings.trimMode;
  $('observerCleanup').checked = settings.enableObserverCleanup;
  $('memoryMonitor').checked = settings.enableMemoryMonitor;
  toggleMemoryStats(settings.enableMemoryMonitor);
}

function toggleMemoryStats(show) {
  $('memoryStatsSection').style.display = show ? 'grid' : 'none';
}

async function saveSettings() {
  currentSettings = {
    enabled: $('globalToggle').checked,
    maxMessages: parseInt($('maxMessages').value, 10),
    trimMode: $('trimMode').value,
    enableObserverCleanup: $('observerCleanup').checked,
    enableMemoryMonitor: $('memoryMonitor').checked,
    siteOverrides: currentSettings.siteOverrides || {}
  };
  await chrome.storage.sync.set({ [STORAGE_KEY]: currentSettings });
  showStatus('Settings saved');
}

function showStatus(text) {
  $('statusText').textContent = text;
  setTimeout(() => { $('statusText').textContent = ''; }, 1500);
}

async function refreshStats() {
  try {
    const response = await chrome.runtime.sendMessage({ type: MESSAGES.GET_STATS });
    if (response) {
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

$('forceCleanup').addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({ type: MESSAGES.FORCE_CLEANUP });
    showStatus('Cleanup performed');
    setTimeout(refreshStats, 500);
  } catch {
    showStatus('Not on a supported site');
  }
});

$('restoreAll').addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({ type: MESSAGES.RESTORE_ALL });
    showStatus('All messages restored');
    setTimeout(refreshStats, 500);
  } catch {
    showStatus('Not on a supported site');
  }
});

loadSettings();
refreshStats();
