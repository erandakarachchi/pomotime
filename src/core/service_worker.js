const settings = require("./settings.json");

/**
 * Timer state management
 *
 * A running phase is described by an absolute `endTime` (epoch ms) rather than
 * a decrementing counter, so pausing, missed alarms and browser restarts can't
 * make it drift. While paused, `remainingMs` holds the time left instead.
 */
const TIMER_STATE_KEY = "timerState";
const MS_PER_MINUTE = 60000;
const PHASE = {
  work: "work",
  break: "break",
  largeBreak: "largeBreak",
};
const STATUS = {
  idle: "idle",
  running: "running",
  paused: "paused",
};
const DEFAULT_TIMER_STATE = {
  currentPhase: PHASE.work,
  workCyclesCompleted: 0,
  sessionCount: 0,
  status: STATUS.idle,
  endTime: null,
  remainingMs: null,
  durationMs: null, // full length of the current phase, for ring progress
};

/**
 * Timer settings - centralized for easy customization
 */
const getTimerSettings = async () => {
  const data = await getLocalStorage("settings");
  if (data && data.timerSettings) {
    return {
      workTime: parseInt(data.timerSettings.workTime) || settings.timerSettings.workTime,
      breakTime: parseInt(data.timerSettings.breakTime) || settings.timerSettings.breakTime,
      largeBreakTime: parseInt(data.timerSettings.largeBreakTime) || settings.timerSettings.largeBreakTime,
      maxCycles: parseInt(data.timerSettings.maxCycles) || settings.timerSettings.maxCycles
    };
  }
  // Fallback to default settings
  return {
    workTime: settings.timerSettings.workTime,
    breakTime: settings.timerSettings.breakTime,
    largeBreakTime: settings.timerSettings.largeBreakTime,
    maxCycles: settings.timerSettings.maxCycles
  };
};

const CONTEXT_MENU_ITEMS = {
  ID_OPEN_SETTINGS: "openSettings",
  ID_STOP_TIMER: "stopTimer",
  ID_SKIP_TIMER: "skipTimer",
  ID_RESET_TIMER: "resetTimer",
};

// Fires once, at the phase's end time.
const END_ALARM_NAME = "phaseEndAlarm";
// Fires every 30s to keep the badge and ring current without waking the worker constantly.
const TICK_ALARM_NAME = "badgeTickAlarm";
const TICK_INTERVAL_MS = 30000;

const BADGE_TEXT_COLOR = "#F7FFF7";
const PAUSED_BADGE_COLOR = "#9E9E9E";

const RING_TRACK_COLOR = "rgba(128, 128, 128, 0.35)";
const RING_WIDTH_RATIO = 0.1; // ring thickness as a share of the icon size
const MIN_RING_WIDTH_PX = 2;
const RING_TOMATO_GAP_PX = 1;
const RING_START_ANGLE = -Math.PI / 2; // 12 o'clock
const ICON_SOURCE_PATH = "icons/icon128.png";
const ICON_SIZES = [16, 32, 48];
const DEFAULT_ICON_PATHS = {
  16: "icons/icon16.png",
  32: "icons/icon32.png",
  48: "icons/icon48.png",
  128: "icons/icon128.png",
};

const PHASE_CONFIGS = {
  [PHASE.work]: {
    badgeBackgroundColor: "#FF6B6B",
    notification: ["Work complete", "Take a break and get ready for the next cycle"],
    page: "complete.html",
    duration: (timerSettings) => timerSettings.workTime,
  },
  [PHASE.break]: {
    badgeBackgroundColor: "#6BCB77",
    notification: ["Break complete", "Time to work again"],
    page: "break.html",
    duration: (timerSettings) => timerSettings.breakTime,
  },
  [PHASE.largeBreak]: {
    badgeBackgroundColor: "#6BCB77",
    notification: ["Large break complete", "Time to work again"],
    page: "large-break.html",
    duration: (timerSettings) => timerSettings.largeBreakTime,
  },
};

const MESSAGE_PHASES = {
  startWorkTimer: PHASE.work,
  startBreakTimer: PHASE.break,
  startLargeBreakTimer: PHASE.largeBreak,
};

chrome.runtime.onInstalled.addListener(async () => {
  await saveDefaultSettings();
  await initializeTimerState();
  createContextMenu();
  await restoreTimer();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === END_ALARM_NAME) {
    await finishPhase({ completed: true });
  } else if (alarm.name === TICK_ALARM_NAME) {
    const timerState = await getTimerState();
    if (timerState.status === STATUS.running) {
      updateBadge(timerState);
    }
  }
});

chrome.action.onClicked.addListener(async () => {
  const timerState = await getTimerState();
  if (timerState.status === STATUS.idle) {
    await startPhase(timerState.currentPhase);
  } else if (timerState.status === STATUS.running) {
    await pauseTimer();
  } else {
    await resumeTimer();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await initializeTimerState();
  await restoreTimer();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const menuItemId = info.menuItemId;
  switch (menuItemId) {
    case CONTEXT_MENU_ITEMS.ID_OPEN_SETTINGS:
      chrome.tabs.create({ url: "settings.html" });
      break;
    case CONTEXT_MENU_ITEMS.ID_STOP_TIMER:
      stopTimer();
      break;
    case CONTEXT_MENU_ITEMS.ID_SKIP_TIMER:
      skipTimer();
      break;
    case CONTEXT_MENU_ITEMS.ID_RESET_TIMER:
      resetTimerState();
      break;
  }
});

chrome.storage.local.onChanged.addListener((changes) => {
  if (changes.settings) {
    updateSettings();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const phase = MESSAGE_PHASES[message.action];
  if (!phase) {
    return;
  }
  // Reply once the phase has started so the sender can tell the message was handled
  // (a page that closes straight after sending can lose it while the worker wakes).
  startPhase(phase).then(
    () => sendResponse({ ok: true }),
    (error) => sendResponse({ ok: false, error: error.message })
  );
  return true; // keep the channel open for the async reply
});

// Timer state management functions
const getTimerState = async () => {
  const result = await getLocalStorage(TIMER_STATE_KEY);
  return { ...DEFAULT_TIMER_STATE, ...result };
};

const saveTimerState = async (state) => {
  await setLocalStorage(TIMER_STATE_KEY, state);
};

const initializeTimerState = async () => {
  // If no state exists, save the default state
  if (!await getLocalStorage(TIMER_STATE_KEY)) {
    await saveTimerState(DEFAULT_TIMER_STATE);
  }
};

const resetTimerState = async () => {
  await clearAlarms();
  await saveTimerState(DEFAULT_TIMER_STATE);
  await clearIndicators();
  showNotification("Timer Reset", "All timers have been reset");
};

const startPhase = async (phase) => {
  const timerState = await getTimerState();
  if (timerState.status !== STATUS.idle) {
    showNotification("Timer is already running", "Stop the timer to start a new one");
    return;
  }

  const timerSettings = await getTimerSettings();
  timerState.currentPhase = phase;
  timerState.status = STATUS.running;
  timerState.durationMs = PHASE_CONFIGS[phase].duration(timerSettings) * MS_PER_MINUTE;
  timerState.endTime = Date.now() + timerState.durationMs;
  timerState.remainingMs = null;
  await saveTimerState(timerState);
  scheduleAlarms(timerState.endTime);
  updateBadge(timerState);
};

const pauseTimer = async () => {
  const timerState = await getTimerState();
  if (timerState.status !== STATUS.running) {
    return;
  }
  timerState.remainingMs = Math.max(timerState.endTime - Date.now(), 0);
  timerState.endTime = null;
  timerState.status = STATUS.paused;
  await clearAlarms();
  await saveTimerState(timerState);
  updateBadge(timerState);
};

const resumeTimer = async () => {
  const timerState = await getTimerState();
  if (timerState.status !== STATUS.paused) {
    return;
  }
  timerState.endTime = Date.now() + timerState.remainingMs;
  timerState.remainingMs = null;
  timerState.status = STATUS.running;
  await saveTimerState(timerState);
  scheduleAlarms(timerState.endTime);
  updateBadge(timerState);
};

const stopTimer = async () => {
  const timerState = await getTimerState();
  if (timerState.status === STATUS.idle) {
    showNotification("Timer is not running", "Start the timer to stop it");
    return;
  }
  await clearAlarms();
  markIdle(timerState);
  await saveTimerState(timerState);
  await clearIndicators();
  showNotification("Timer Stopped", "Timer has been stopped");
};

const skipTimer = async () => {
  const timerState = await getTimerState();
  if (timerState.status === STATUS.idle) {
    showNotification("Timer is not running", "Start the timer to skip it");
    return;
  }
  await finishPhase({ completed: false });
};

/**
 * Ends the current phase and moves on to the next one. A skipped work phase
 * ({ completed: false }) doesn't count towards the cycle total and doesn't
 * notify, but still opens the page that starts the next phase.
 */
const finishPhase = async ({ completed }) => {
  const timerState = await getTimerState();
  if (timerState.status === STATUS.idle) {
    return;
  }
  const finishedPhase = timerState.currentPhase;
  await clearAlarms();
  await advancePhase(timerState, completed);
  await clearIndicators();

  const { notification, page } = PHASE_CONFIGS[finishedPhase];
  if (completed) {
    showNotification(...notification);
  }
  openHtmlPage(page);
};

// Handle state transitions once a phase has ended
const advancePhase = async (timerState, completed) => {
  const timerSettings = await getTimerSettings();

  if (timerState.currentPhase === PHASE.work) {
    if (completed) {
      timerState.workCyclesCompleted++;
      timerState.sessionCount++;
    }
    // Determine next phase: regular break or large break
    timerState.currentPhase =
      timerState.workCyclesCompleted >= timerSettings.maxCycles ? PHASE.largeBreak : PHASE.break;
    // Don't reset cycle count here - reset after large break completes
  } else {
    if (timerState.currentPhase === PHASE.largeBreak) {
      timerState.workCyclesCompleted = 0; // Reset cycle count after large break completes
    }
    timerState.currentPhase = PHASE.work;
  }

  markIdle(timerState);
  await saveTimerState(timerState);
};

const markIdle = (timerState) => {
  timerState.status = STATUS.idle;
  timerState.endTime = null;
  timerState.remainingMs = null;
};

/**
 * Re-arms alarms and the badge from the stored state. Alarms and badge text
 * don't reliably survive a browser restart or extension update, but the stored
 * end time does.
 */
const restoreTimer = async () => {
  await chrome.alarms.clearAll();
  const timerState = await getTimerState();
  if (timerState.status === STATUS.running) {
    if (timerState.endTime <= Date.now()) {
      await finishPhase({ completed: true });
    } else {
      scheduleAlarms(timerState.endTime);
      updateBadge(timerState);
    }
  } else if (timerState.status === STATUS.paused) {
    updateBadge(timerState);
  }
};

const scheduleAlarms = (endTime) => {
  const now = Date.now();
  chrome.alarms.create(END_ALARM_NAME, { when: endTime });
  // Ticks stay aligned to endTime, so the badge minute changes exactly on a tick.
  chrome.alarms.create(TICK_ALARM_NAME, {
    when: now + ((endTime - now) % TICK_INTERVAL_MS || TICK_INTERVAL_MS),
    periodInMinutes: TICK_INTERVAL_MS / MS_PER_MINUTE,
  });
};

const clearAlarms = async () => {
  await Promise.all([
    chrome.alarms.clear(END_ALARM_NAME),
    chrome.alarms.clear(TICK_ALARM_NAME),
  ]);
};

const updateBadge = (timerState) => {
  const isPaused = timerState.status === STATUS.paused;
  const remainingMs = isPaused ? timerState.remainingMs : timerState.endTime - Date.now();
  const remainingMinutes = Math.max(Math.ceil(remainingMs / MS_PER_MINUTE), 0);
  const backgroundColor = isPaused
    ? PAUSED_BADGE_COLOR
    : PHASE_CONFIGS[timerState.currentPhase].badgeBackgroundColor;
  setIconBadge(remainingMinutes, BADGE_TEXT_COLOR, backgroundColor);

  const progress = timerState.durationMs
    ? Math.min(Math.max(1 - remainingMs / timerState.durationMs, 0), 1)
    : 0;
  // The ring is cosmetic: a failed render is logged but must not break the timer.
  renderRingIcon(progress, backgroundColor).catch((error) => {
    console.error("Failed to render ring icon", error);
  });
};

const setIconBadge = (time, textColor, backgroundColor) => {
  const remainingMinutes = time === -1 ? "" : time.toString();
  chrome.action.setBadgeText({ text: remainingMinutes });
  if (textColor) chrome.action.setBadgeTextColor({ color: textColor });
  if (backgroundColor) chrome.action.setBadgeBackgroundColor({ color: backgroundColor });
};

// Removes the badge number and the progress ring, back to the plain tomato.
const clearIndicators = async () => {
  setIconBadge(-1);
  iconRenderId++;
  await chrome.action.setIcon({ path: DEFAULT_ICON_PATHS });
};

let tomatoBitmap;
let iconRenderId = 0;

const loadTomatoBitmap = async () => {
  if (!tomatoBitmap) {
    const response = await fetch(chrome.runtime.getURL(ICON_SOURCE_PATH));
    tomatoBitmap = await createImageBitmap(await response.blob());
  }
  return tomatoBitmap;
};

/**
 * Draws the tomato with a ring filling clockwise from the top as `progress`
 * goes 0 -> 1. The toolbar icon is set from pixels because an action icon
 * can't be styled any other way.
 */
const renderRingIcon = async (progress, color) => {
  const renderId = ++iconRenderId;
  const tomato = await loadTomatoBitmap();
  if (renderId !== iconRenderId) {
    return; // a newer update (or clearIndicators) superseded this one
  }

  const imageData = {};
  for (const size of ICON_SIZES) {
    const context = new OffscreenCanvas(size, size).getContext("2d");
    const ringWidth = Math.max(MIN_RING_WIDTH_PX, Math.round(size * RING_WIDTH_RATIO));
    const center = size / 2;
    const radius = center - ringWidth / 2;

    context.lineWidth = ringWidth;
    context.strokeStyle = RING_TRACK_COLOR;
    context.beginPath();
    context.arc(center, center, radius, 0, Math.PI * 2);
    context.stroke();

    if (progress > 0) {
      context.strokeStyle = color;
      context.beginPath();
      context.arc(center, center, radius, RING_START_ANGLE, RING_START_ANGLE + Math.PI * 2 * progress);
      context.stroke();
    }

    const tomatoSize = size - ringWidth * 2 - RING_TOMATO_GAP_PX;
    context.drawImage(tomato, center - tomatoSize / 2, center - tomatoSize / 2, tomatoSize, tomatoSize);
    imageData[size] = context.getImageData(0, 0, size, size);
  }
  await chrome.action.setIcon({ imageData });
};

const showNotification = (title, message) => {
  chrome.notifications.create({
    type: "basic",
    title: title,
    message: message,
    iconUrl: "icons/icon48.png",
  });
};

const setLocalStorage = (key, value) => {
  return chrome.storage.local.set({ [key]: value });
};

const getLocalStorage = (key) => {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key]);
    });
  });
};

const openHtmlPage = (page) => {
  chrome.tabs.create({ url: `${page}` });
};

const saveDefaultSettings = async () => {
  await chrome.storage.local.set({ settings: settings });
};

const createContextMenu = () => {
  // Recreated on every install/update, so clear any existing items first.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ITEMS.ID_OPEN_SETTINGS,
      title: "Open Settings",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ITEMS.ID_STOP_TIMER,
      title: "Stop Timer",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ITEMS.ID_SKIP_TIMER,
      title: "Skip to Next Phase",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ITEMS.ID_RESET_TIMER,
      title: "Reset Timers",
      contexts: ["action"],
    });
  });
};

const updateSettings = async () => {
  // Settings are now handled through getTimerSettings() function
  // This function kept for compatibility with storage change listener
};
