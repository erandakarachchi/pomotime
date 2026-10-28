# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run build` — webpack production build into `dist/` (cleaned on each build).
- `npm run watch` — rebuild on change.
- No test runner or linter is configured (`npm test` is a placeholder that fails).

To try changes: build, then load `dist/` as an unpacked extension at `chrome://extensions/` (Developer mode) and reload the extension after each rebuild. Releases: bump the version in **both** `manifest.json` and `package.json`, build, and zip the *contents* of `dist/` (not the folder) for the Chrome Web Store. The README has the full store-listing checklist.

## Architecture

Chrome Manifest V3 extension with no popup: clicking the toolbar icon starts the timer. Plain JavaScript, bundled by webpack (CommonJS, `require`).

- **`src/core/service_worker.js`** is the whole backend. It owns the timer, the state machine and the toolbar badge.
- **`src/pages/*`** (`break`, `complete`, `large-break`, `settings`) are standalone HTML pages opened in new tabs. They hold no timer logic and talk to the service worker only through `chrome.storage.local` and `chrome.runtime.sendMessage({ action })`. Handled actions: `startWorkTimer`, `startBreakTimer`, `startLargeBreakTimer`. Each page closes its own tab after sending.
- **`src/core/settings.json`** holds the defaults (work 25, break 5, large break 15, `maxCycles` 4). It is bundled into the service worker and written to storage on install. `notificationSettings` in it is not used by any code yet.

### Build quirk

`webpack.config.js` has explicit JS entries for the service worker and the `break`, `complete` and `large_break` pages, but `settings.js` is **not** an entry. HTML/CSS/JS under `src/pages/**` are also copied flat (`[name][ext]`, no subfolders) into `dist/`. A new page therefore needs its file names to be unique across all pages, and its script needs an entry added if it requires bundling. Pages are opened by bare filename (`chrome.tabs.create({ url: "complete.html" })`).

### Timer mechanics (non-obvious)

- One `chrome.alarms` alarm (`defaultWorkAlarm`) fires every minute. Each tick decrements the remaining minutes stored in `chrome.storage.local` (`currentTimerDuration`), updates the badge, and at 0 clears the alarm and runs the phase's `onComplete` (notification plus opening the matching page). The service worker is not persistent, so all timer state lives in storage, never in module variables.
- The alarm handler looks up the running phase through `currentTimerConfig` (`work` / `break` / `largeBreak`), which indexes `TIMER_CONFIGS`. Each config bundles badge colors and the `onComplete` callback.
- Phase state is separate, under `timerState`: `currentPhase`, `workCyclesCompleted`, `isRunning`, `sessionCount`. `handleTimerComplete` advances it. After `maxCycles` completed work sessions the next phase is `largeBreak`. The cycle counter resets only when the large break completes.
- Phases are never auto-started. Each completion opens a page whose button sends the message that starts the next phase. `startWorkTimer`, `startBreakTimer` and `startLargeBreakTimer` refuse to run while `isRunning` is true.
- User settings are stored under `settings` in storage and read through `getTimerSettings()`, which falls back to the `settings.json` defaults for missing or non-numeric values. The settings page replaces only `timerSettings` and preserves the rest.
- The toolbar context menu (Open Settings, Stop Timer, Reset Timers) is created in `onInstalled`.
