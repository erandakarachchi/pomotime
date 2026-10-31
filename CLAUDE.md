# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working Rules

### Reuse before writing
- Read the relevant existing code before creating or modifying anything.
- Do not duplicate behavior that already exists. Search for an existing function, constant or pattern first (for example `startPhase`, `finishPhase`, `PHASE_CONFIGS`, `clearIndicators`) and extend it instead of writing a parallel version.
- If an existing implementation almost fits, change it in place rather than adding a second one beside it.

### Confirm, don't guess
- Never guess requirements, behavior, API semantics or intent. If anything is ambiguous or underspecified, ask the user before implementing.
- When a request has several reasonable interpretations, or affects user-visible behavior, saved data or a public surface, present the options and ask which to use.
- Verify facts about the code or the Chrome extension APIs by reading the code or docs instead of assuming from memory.

### Scope and simplicity
- Surgical changes: modify only what the task needs. Avoid large, sweeping refactors unless explicitly asked.
- Avoid over-engineering: implement the simplest, most performant solution that meets the requirement.
- No dead code: do not leave placeholder comments, `TODO` blocks, commented-out code, unused variables or leftover `console.log` calls.

### JavaScript conventions
- Follow the style of the surrounding code, and standard modern JavaScript where it is silent.
- Naming: `camelCase` for variables and functions, `PascalCase` for classes, `UPPER_SNAKE_CASE` for module-level constants. Use descriptive names; name booleans as questions (`isPaused`, `hasEnded`).
- Use `const` by default, `let` only when reassigning, never `var`. Use strict equality (`===`/`!==`).
- Prefer `async`/`await` over nested callbacks and `.then()` chains in new code; always handle or deliberately propagate rejections.
- No magic numbers or repeated string literals: give them a named constant (as with `TICK_INTERVAL_MS` and the `STATUS` values).
- Keep functions small and single-purpose, and comment only the non-obvious *why*. Use JSDoc for functions whose contract isn't clear from the name.
- Use CommonJS `require` / `module.exports`, matching the existing webpack setup.

## Commands

- `npm run build` — webpack production build into `dist/` (cleaned on each build).
- `npm run watch` — rebuild on change.
- No test runner or linter is configured (`npm test` is a placeholder that fails).

To try changes: build, then load `dist/` as an unpacked extension at `chrome://extensions/` (Developer mode) and reload the extension after each rebuild. Releases: bump the version in **both** `manifest.json` and `package.json`, build, and zip the *contents* of `dist/` (not the folder) for the Chrome Web Store. The README has the full store-listing checklist.

## Architecture

Chrome Manifest V3 extension with no popup: clicking the toolbar icon starts the timer. Plain JavaScript, bundled by webpack (CommonJS, `require`).

- **`src/core/service_worker.js`** is the whole backend. It owns the timer, the state machine and the toolbar badge.
- **`src/pages/*`** (`break`, `complete`, `large-break`, `settings`) are standalone HTML pages opened in new tabs. They hold no timer logic and talk to the service worker only through `chrome.storage.local` and `chrome.runtime.sendMessage({ action })`. Handled actions: `startWorkTimer`, `startBreakTimer`, `startLargeBreakTimer`. The worker replies `{ ok: true }` once the phase has started, and each page closes its own tab only after that reply. Closing straight after sending loses the message when the worker is asleep (it sleeps after ~30s idle), so the timer silently never starts.
- **`src/core/settings.json`** holds the defaults (work 25, break 5, large break 15, `maxCycles` 4). It is bundled into the service worker and written to storage on install. `notificationSettings` in it is not used by any code yet.

### Build quirk

`webpack.config.js` has explicit JS entries for the service worker and the `break`, `complete` and `large_break` pages, but `settings.js` is **not** an entry. HTML/CSS/JS under `src/pages/**` are also copied flat (`[name][ext]`, no subfolders) into `dist/`. A new page therefore needs its file names to be unique across all pages, and its script needs an entry added if it requires bundling. Pages are opened by bare filename (`chrome.tabs.create({ url: "complete.html" })`).

### Timer mechanics (non-obvious)

- A running phase is stored as an absolute `endTime` (epoch ms) in `timerState`, never as a decremented counter. Remaining time is always `endTime - Date.now()`, so missed alarms and browser restarts can't cause drift. While paused, `endTime` is null and `remainingMs` holds the time left. `timerState.status` is `idle | running | paused`.
- Two alarms drive a running phase: `phaseEndAlarm` fires once at `endTime` and completes the phase; `badgeTickAlarm` fires every 30s (aligned to `endTime`) and only refreshes the badge and the toolbar icon. The service worker is not persistent, so all state lives in `chrome.storage.local`, never in module variables.
- `restoreTimer()` runs on install/update and browser startup. It clears all alarms, then re-arms them from the stored `endTime` (or completes the phase right away if `endTime` already passed). Alarms and badge text can't be trusted to survive a restart; the stored end time can.
- Toolbar icon click: idle starts the current phase, running pauses, paused resumes. The right-click menu has Stop, Skip to Next Phase, Reset and Open Settings.
- `finishPhase({ completed })` is the single exit path for both natural completion and Skip. A skipped work phase doesn't increment `workCyclesCompleted`/`sessionCount` and doesn't notify, but still opens the page that starts the next phase. Per-phase badge color, notification text, page and duration live in `PHASE_CONFIGS`, keyed by `currentPhase` (`work` / `break` / `largeBreak`).
- After `maxCycles` completed work sessions the next phase is `largeBreak`. The cycle counter resets only when the large break ends.
- Phases are never auto-started. Each completion opens a page whose button sends the message that starts the next phase; `startPhase` refuses to run unless `status` is `idle`.
- User settings are stored under `settings` in storage and read through `getTimerSettings()`, which falls back to the `settings.json` defaults for missing or non-numeric values. The settings page replaces only `timerSettings` and preserves the rest.
- The progress ring is drawn in the service worker: `renderRingIcon` paints the tomato (`icons/icon128.png`) plus an arc on an `OffscreenCanvas` and applies it with `chrome.action.setIcon({ imageData })`. Use `clearIndicators()` (not `setIconBadge(-1)` alone) to remove the badge and restore the plain icon; it also invalidates any in-flight render via `iconRenderId`. Ring progress needs `timerState.durationMs`, set in `startPhase`.
