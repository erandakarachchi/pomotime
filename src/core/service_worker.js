const settings = require("./settings.json");

/**
 * Timer state management
 */
const TIMER_STATE_KEY = "timerState";
const DEFAULT_TIMER_STATE = {
  currentPhase: "work",
  workCyclesCompleted: 0,
  isRunning: false,
  sessionCount: 0
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
  ID_RESET_TIMER: "resetTimer",
};

const WORK_ALARM_NAME = "defaultWorkAlarm";
const CURRENT_TIMER_CONFIG = "currentTimerConfig";
const CURRENT_TIMER_DURATION = "currentTimerDuration";

const DEFAULT_WORK_CONFIG = {
  badgeTextColor: "#F7FFF7",
  badgeBackgroundColor: "#FF6B6B",
  onComplete: () => {
    showNotification(
      "Work complete 🎉",
      "Take a break and get ready for the next cycle"
    );
    openHtmlPage("complete.html");
  },
};

const DEFAULT_BREAK_CONFIG = {
  badgeTextColor: "#F7FFF7",
  badgeBackgroundColor: "#6BCB77",
  onComplete: () => {
    showNotification("Break complete", "Time to work again");
    openHtmlPage("break.html");
  },
};

const DEFAULT_LARGE_BREAK_CONFIG = {
  badgeTextColor: "#F7FFF7",
  badgeBackgroundColor: "#6BCB77",
  onComplete: () => {
    showNotification("Large break complete", "Time to work again");
    openHtmlPage("large-break.html");
  },
};

const TIMER_CONFIG_IDS = {
  work: "work",
  break: "break",
  largeBreak: "largeBreak",
};

const TIMER_CONFIGS = {
  [TIMER_CONFIG_IDS.work]: DEFAULT_WORK_CONFIG,
  [TIMER_CONFIG_IDS.break]: DEFAULT_BREAK_CONFIG,
  [TIMER_CONFIG_IDS.largeBreak]: DEFAULT_LARGE_BREAK_CONFIG,
};

chrome.runtime.onInstalled.addListener(async () => {
  await saveDefaultSettings();
  await initializeTimerState();
  createContextMenu();
  updateSettings();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === WORK_ALARM_NAME) {
    let timerDurationMinutes = await getLocalStorage(CURRENT_TIMER_DURATION);
    const currentTimerConfigId = await getLocalStorage(CURRENT_TIMER_CONFIG);
    const { badgeTextColor, badgeBackgroundColor, onComplete } =
      TIMER_CONFIGS[currentTimerConfigId];
    timerDurationMinutes = timerDurationMinutes - 1;
    if (timerDurationMinutes === 0) {
      chrome.alarms.clear(WORK_ALARM_NAME);
      await handleTimerComplete(currentTimerConfigId);
      setIconBadge(-1, badgeTextColor, badgeBackgroundColor);
      if (onComplete && typeof onComplete === "function") {
        onComplete();
      }
      return;
    } else {
      setIconBadge(timerDurationMinutes, badgeTextColor, badgeBackgroundColor);
      setLocalStorage(CURRENT_TIMER_DURATION, timerDurationMinutes);
    }
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  const timerState = await getTimerState();
  if (timerState.currentPhase === "work") {
    await startWorkTimer();
  } else if (timerState.currentPhase === "break") {
    await startBreakTimer();
  } else if (timerState.currentPhase === "largeBreak") {
    await startLargeBreakTimer();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await initializeTimerState();
  updateSettings();
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

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === "startWorkTimer") {
    await startWorkTimer();
  }
  if (message.action === "startBreakTimer") {
    await startBreakTimer();
  }
  if (message.action === "startLargeBreakTimer") {
    await startLargeBreakTimer();
  }
});

// Timer state management functions
const getTimerState = async () => {
  const result = await getLocalStorage(TIMER_STATE_KEY);
  return result || DEFAULT_TIMER_STATE;
};

const saveTimerState = async (state) => {
  await setLocalStorage(TIMER_STATE_KEY, state);
};

const initializeTimerState = async () => {
  const state = await getTimerState();
  // If no state exists, save the default state
  if (!await getLocalStorage(TIMER_STATE_KEY)) {
    await saveTimerState(DEFAULT_TIMER_STATE);
  }
};

const resetTimerState = async () => {
  await saveTimerState(DEFAULT_TIMER_STATE);
  setIconBadge(-1, "#000000", "#FFFFFF");
  showNotification("Timer Reset", "All timers have been reset");
};

// Explicit timer start functions
const startWorkTimer = async () => {
  const timerState = await getTimerState();
  if (timerState.isRunning) {
    showNotification("Timer is already running", "Stop the timer to start a new one");
    return;
  }
  
  const timerSettings = await getTimerSettings();
  timerState.isRunning = true;
  timerState.currentPhase = "work";
  await saveTimerState(timerState);
  await startTimer(timerSettings.workTime, TIMER_CONFIG_IDS.work);
};

const startBreakTimer = async () => {
  const timerState = await getTimerState();
  if (timerState.isRunning) {
    showNotification("Timer is already running", "Stop the timer to start a new one");
    return;
  }
  
  const timerSettings = await getTimerSettings();
  timerState.isRunning = true;
  timerState.currentPhase = "break";
  await saveTimerState(timerState);
  await startTimer(timerSettings.breakTime, TIMER_CONFIG_IDS.break);
};

const startLargeBreakTimer = async () => {
  const timerState = await getTimerState();
  if (timerState.isRunning) {
    showNotification("Timer is already running", "Stop the timer to start a new one");
    return;
  }
  
  const timerSettings = await getTimerSettings();
  timerState.isRunning = true;
  timerState.currentPhase = "largeBreak";
  await saveTimerState(timerState);
  await startTimer(timerSettings.largeBreakTime, TIMER_CONFIG_IDS.largeBreak);
};

// Handle timer completion and state transitions
const handleTimerComplete = async (completedTimerType) => {
  const timerState = await getTimerState();
  const timerSettings = await getTimerSettings();
  
  timerState.isRunning = false;
  
  if (completedTimerType === "work") {
    timerState.workCyclesCompleted++;
    timerState.sessionCount++;
    
    // Determine next phase: regular break or large break
    if (timerState.workCyclesCompleted >= timerSettings.maxCycles) {
      timerState.currentPhase = "largeBreak";
      // Don't reset cycle count here - reset after large break completes
    } else {
      timerState.currentPhase = "break";
    }
  } else if (completedTimerType === "break") {
    timerState.currentPhase = "work";
  } else if (completedTimerType === "largeBreak") {
    timerState.currentPhase = "work";
    timerState.workCyclesCompleted = 0; // Reset cycle count after large break completes
  }
  
  await saveTimerState(timerState);
};

const setIconBadge = (time, textColor, backgroundColor) => {
  const remainingMinutes = time === -1 ? "" : time.toString();
  chrome.action.setBadgeText({ text: remainingMinutes });
  chrome.action.setBadgeTextColor({ color: textColor });
  chrome.action.setBadgeBackgroundColor({ color: backgroundColor });
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
  chrome.storage.local.set({ [key]: value });
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
    id: CONTEXT_MENU_ITEMS.ID_RESET_TIMER,
    title: "Reset Timers",
    contexts: ["action"],
  });
};

const updateSettings = async () => {
  // Settings are now handled through getTimerSettings() function
  // This function kept for compatibility with storage change listener
};

const startTimer = async (time, configId) => {
  const { badgeTextColor, badgeBackgroundColor } = TIMER_CONFIGS[configId];
  setIconBadge(time, badgeTextColor, badgeBackgroundColor);
  setLocalStorage(CURRENT_TIMER_CONFIG, configId);
  setLocalStorage(CURRENT_TIMER_DURATION, time);
  // Alarm implementation
  await chrome.alarms.create(WORK_ALARM_NAME, {
    periodInMinutes: 1,
  });
};

const stopTimer = async () => {
  const timerState = await getTimerState();
  if (!timerState.isRunning) {
    showNotification("Timer is not running", "Start the timer to stop it");
    return;
  }
  chrome.alarms.clear(WORK_ALARM_NAME);
  timerState.isRunning = false;
  await saveTimerState(timerState);
  setIconBadge(-1, "#000000", "#FFFFFF");
  showNotification("Timer Stopped", "Timer has been stopped");
};
