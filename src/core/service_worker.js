const settings = require("./settings.json");

/**
 * Global variables are defined here
 * They should have a prefix of g to indicate that they are global
 */
/**
 * Timer type to start next
 * This can have the options of work, break, largeBreak
 */
let gTimerType = "work";
let gIsTimerRunning = false;
let gWorkCyclesCount = 0;

let workTime = settings.timerSettings.workTime;
let breakTime = settings.timerSettings.breakTime;
let largeBreakTime = settings.timerSettings.largeBreakTime;
let maxCycles = settings.timerSettings.maxCycles;

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
      gIsTimerRunning = false;
      gTimerType = updateTimerState(gTimerType, gWorkCyclesCount, maxCycles);
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
  await startTimerHandler();
});

chrome.runtime.onStartup.addListener(() => {
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
      resetAllGlobals();
      break;
  }
});

chrome.storage.local.onChanged.addListener((changes) => {
  if (changes.settings) {
    updateSettings();
  }
});

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === "startBreak") {
    await startTimerHandler();
  }
  if (message.action === "startNewSession") {
    await startTimerHandler();
  }
  if (message.action === "startLargeBreak") {
    await startTimerHandler();
  }
});

const startTimerHandler = async () => {
  if (gIsTimerRunning) {
    showNotification(
      "Timer is already running",
      "Stop the timer to start a new one"
    );
    return;
  }
  if (gTimerType === "work") {
    await startTimer(workTime, TIMER_CONFIG_IDS.work);
  } else if (gTimerType === "break") {
    await startTimer(breakTime, TIMER_CONFIG_IDS.break);
  } else if (gTimerType === "largeBreak") {
    await startTimer(largeBreakTime, TIMER_CONFIG_IDS.largeBreak);
  }
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

const updateTimerState = (currentTimerType, workCyclesCount, maxWorkCycles) => {
  let nextTimerType = "";
  if (currentTimerType === "work") {
    gWorkCyclesCount++;
    // If the work cycles count is greater than or equal to the max work cycles,
    // then set the next timer type to large break
    //  Adding a -1 because the work cycles count is 0 based
    nextTimerType =
      workCyclesCount >= maxWorkCycles - 1 ? "largeBreak" : "break";
  } else if (currentTimerType === "break") {
    nextTimerType = "work";
  } else if (currentTimerType === "largeBreak") {
    gWorkCyclesCount = 0;
    nextTimerType = "work";
  }
  return nextTimerType;
};

const resetAllGlobals = () => {
  gIsTimerRunning = false;
  gWorkCyclesCount = 0;
  gTimerType = "work";
};

const updateSettings = async () => {
  const data = await chrome.storage.local.get("settings");
  const settings = data.settings;
  if (settings.timerSettings) {
    workTime = settings.timerSettings.workTime || workTime;
    breakTime = settings.timerSettings.breakTime || breakTime;
    largeBreakTime = settings.timerSettings.largeBreakTime || largeBreakTime;
    maxCycles = settings.timerSettings.maxCycles || maxCycles;
  }
};

const startTimer = async (time, configId) => {
  const { badgeTextColor, badgeBackgroundColor } = TIMER_CONFIGS[configId];
  gIsTimerRunning = true;
  setIconBadge(time, badgeTextColor, badgeBackgroundColor);
  setLocalStorage(CURRENT_TIMER_CONFIG, configId);
  setLocalStorage(CURRENT_TIMER_DURATION, time);
  // Alarm implementation
  await chrome.alarms.create(WORK_ALARM_NAME, {
    periodInMinutes: 1,
  });
};

const stopTimer = () => {
  if (!gIsTimerRunning) {
    showNotification("Timer is not running", "Start the timer to stop it");
    return;
  }
  chrome.alarms.clear(WORK_ALARM_NAME);
  gIsTimerRunning = false;
  setIconBadge(0, "#000000", "#FFFFFF");
};
