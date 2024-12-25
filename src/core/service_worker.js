const settings = require("./settings.json");

/**
 * Global variables are defined here
 * They should have a prefix of g to indicate that they are global
 */
let gTimerInterval;
let gTimeout;
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

const DEFAULT_WORK_CONFIG = {
  badgeTextColor: "#F7FFF7",
  badgeBackgroundColor: "#FF6B6B",
  onComplete: () => {
    showNotification(
      "Work complete 🎉",
      "Take a break and get ready for the next cycle"
    );
  },
};

const DEFAULT_BREAK_CONFIG = {
  badgeTextColor: "#F7FFF7",
  badgeBackgroundColor: "#6BCB77",
  onComplete: () => {
    showNotification("Break complete", "Time to work again");
  },
};

const DEFAULT_LARGE_BREAK_CONFIG = {
  badgeTextColor: "#F7FFF7",
  badgeBackgroundColor: "#6BCB77",
  onComplete: () => {
    showNotification("Large break complete", "Time to work again");
  },
};

chrome.runtime.onInstalled.addListener(async () => {
  await saveDefaultSettings();
  createContextMenu();
  updateSettings();
});

chrome.action.onClicked.addListener((tab) => {
  startTimerHandler();
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

const startTimerHandler = () => {
  if (gIsTimerRunning) {
    showNotification(
      "Timer is already running",
      "Stop the timer to start a new one"
    );
    return;
  }
  if (gTimerType === "work") {
    startTimer(workTime, DEFAULT_WORK_CONFIG);
  } else if (gTimerType === "break") {
    startTimer(breakTime, DEFAULT_BREAK_CONFIG);
  } else if (gTimerType === "largeBreak") {
    startTimer(largeBreakTime, DEFAULT_LARGE_BREAK_CONFIG);
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
const startTimer = (time, config) => {
  const { onComplete, badgeTextColor, badgeBackgroundColor } = config;
  gIsTimerRunning = true;
  setIconBadge(time, badgeTextColor, badgeBackgroundColor);

  gTimerInterval = setInterval(() => {
    time = time - 1;
    setIconBadge(time, badgeTextColor, badgeBackgroundColor);
  }, 60 * 1000);

  gTimeout = setTimeout(() => {
    gIsTimerRunning = false;
    clearInterval(gTimerInterval);
    setIconBadge(0, badgeTextColor, badgeBackgroundColor);
    gTimerType = updateTimerState(gTimerType, gWorkCyclesCount, maxCycles);
    if (onComplete) {
      onComplete();
    }
  }, time * 60 * 1000);
};

const stopTimer = () => {
  if (!gIsTimerRunning) {
    showNotification("Timer is not running", "Start the timer to stop it");
    return;
  }
  clearInterval(gTimerInterval);
  clearTimeout(gTimeout);
  gIsTimerRunning = false;
  setIconBadge(0, "#000000", "#FFFFFF");
};
