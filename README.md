# Faq DomSlayer

A Chrome extension that reduces memory usage on AI chat sites by trimming bloated DOM and cleaning up leaked resources.

## Supported Sites

- ChatGPT (chatgpt.com)
- Gemini (gemini.google.com, aistudio.google.com)
- Claude (claude.ai)
- Perplexity (perplexity.ai)
- Microsoft Copilot (copilot.microsoft.com)

## The Problem

AI chat interfaces render every message, code block, and syntax-highlighted token into the browser DOM. Long conversations can accumulate **80,000+ DOM nodes** and **23,000+ active timers**, causing:

- 2-4 GB RAM per tab
- Sluggish typing and scrolling
- Browser tab crashes

## How It Works

Faq DomSlayer monitors the chat DOM and replaces old messages with lightweight placeholders. It also tracks and cleans stale `setInterval`/`setTimeout` timers that pile up from streaming responses.

## Features

| Feature | Description |
|---|---|
| **DOM Trimming** | Keeps last N messages in DOM, replaces older ones with clickable placeholders |
| **3 Trim Modes** | Placeholder (restore on click), Collapse (CSS height limit), Remove (aggressive) |
| **Stale Timer Cleanup** | Tracks and cleans leaked `setInterval`/`setTimeout`/`requestAnimationFrame` |
| **Memory Monitoring** | Shows DOM node count, JS heap usage, and active timer count |
| **Per-Site Adapters** | Tailored CSS selectors for each platform |
| **One-Click Restore** | Restore all trimmed messages instantly |
| **Per-Site Toggles** | Enable/disable individually per platform |

## Installation

1. Download or clone this repository
2. Open `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked**
5. Select the `extension/` folder
6. Navigate to a supported AI chat site

## Usage

Click the extension icon to open settings:

- **Enable/Disable** - Global toggle
- **Max visible messages** - How many recent messages stay in full DOM (5-50)
- **Trim mode** - How old messages are handled
- **Clean stale timers** - Auto-clean leaked timers every 30s
- **Show memory stats** - Display heap and timer info in popup
- **Force Cleanup** - Immediate DOM trim and garbage collection
- **Restore All** - Bring back all trimmed messages

## Project Structure

```
extension/
├── manifest.json                  # Manifest V3 config
├── background.js                  # Service worker
├── popup/
│   ├── popup.html                 # Settings UI
│   ├── popup.css                  # Dark theme styling
│   └── popup.js                   # Settings logic
├── content/
│   ├── injector.js                # Entry point, site detection
│   ├── core/
│   │   ├── dom-trimmer.js         # Generic trim engine
│   │   ├── observer-cleaner.js    # Timer/observer cleanup
│   │   └── memory-monitor.js      # Heap monitoring
│   └── sites/
│       ├── chatgpt.js             # ChatGPT adapter
│       ├── gemini.js              # Gemini adapter
│       ├── claude.js              # Claude adapter
│       ├── perplexity.js          # Perplexity adapter
│       └── copilot.js             # Copilot adapter
├── utils/
│   └── constants.js               # Shared constants
└── icons/
    └── *.png                      # Extension icons
```

## Technical Details

- **Manifest V3** - Uses modern Chrome extension architecture
- **No remote code** - Everything runs locally, no data sent anywhere
- **MutationObserver** - Watches for new messages and trims automatically
- **requestIdleCallback** - Non-blocking DOM manipulation during browser idle time
- **Adapter pattern** - Each site has its own DOM selector strategy

## Debugging

1. Open DevTools on a supported site
2. Type `window.__aico` in the console - should show the extension object
3. Run `window.__aico.trimmer.getStats()` for live stats
4. Check the service worker console at `chrome://extensions/` for errors

## License

MIT
