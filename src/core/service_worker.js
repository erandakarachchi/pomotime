// Should be in seconds.
const SECONDS_IN_MINUTE = 60;
const DEFAULT_WORK_TIME = 1 * SECONDS_IN_MINUTE;
const DEFAULT_BREAK_TIME = 5 * SECONDS_IN_MINUTE;
const DEFAULT_LARGE_BREAK_TIME = 15 * SECONDS_IN_MINUTE;

const DEFAULT_MAX_CYCLES = 4;

const DEFAULT_WORK_ICON_BADGE_COLOR = "#FB4141";
const DEFAULT_WORK_ICON_BADGE_TEXT_COLOR = "#FFFFFF";

const DEFAULT_BREAK_ICON_BADGE_COLOR = "#5CB338";
const DEFAULT_BREAK_ICON_BADGE_TEXT_COLOR = "#FFFFFF";

const DEFAULT_ICON_UPDATE_INTERVAL = 1000 * SECONDS_IN_MINUTE;

// Context menu
const OPEN_SETTINGS_CONTEXT_MENU_ID = "pomotime-settings";
const STOP_TIMER_CONTEXT_MENU_ID = "pomotime-stop";
const START_NEW_SESSION_CONTEXT_MENU_ID = "pomotime-start-new-session";

const CURRENT_TIMER_STATUS = {
  WORK: "work",
  BREAK: "break",
  LARGE_BREAK: "large_break",
  COMPLETE: "complete",
  IDLE: "idle",
};

let currentTimerStatus = CURRENT_TIMER_STATUS.IDLE;
let currentSessions = 0;

const workConfig = {
  iconBadgeColor: DEFAULT_WORK_ICON_BADGE_COLOR,
  iconBadgeTextColor: DEFAULT_WORK_ICON_BADGE_TEXT_COLOR,
  onComplete: () => {
    if (currentSessions === DEFAULT_MAX_CYCLES) {
      chrome.notifications.create({
        type: "basic",
        title: "Pomotime",
        message: "Work session complete, Take a long break!",
        iconUrl: "icons/icon16.png",
      });
      chrome.tabs.create({ url: "long-break.html" });
      currentTimerStatus = CURRENT_TIMER_STATUS.COMPLETE;
    } else {
      chrome.tabs.create({ url: "complete.html" });
      chrome.notifications.create({
        type: "basic",
        title: "Pomotime",
        message: "Work session complete, Take a break!",
        iconUrl: "icons/icon16.png",
      });
      currentTimerStatus = CURRENT_TIMER_STATUS.COMPLETE;
    }
  },
};

const breakConfig = {
  iconBadgeColor: DEFAULT_BREAK_ICON_BADGE_COLOR,
  iconBadgeTextColor: DEFAULT_BREAK_ICON_BADGE_TEXT_COLOR,
  onComplete: () => {
    chrome.notifications.create({
      type: "basic",
      title: "Pomotime",
      message: "Break complete, Start working again!",
      iconUrl: "icons/icon16.png",
    });
    chrome.tabs.create({ url: "break.html" });
    currentTimerStatus = CURRENT_TIMER_STATUS.COMPLETE;
  },
};

const largeBreakConfig = {
  iconBadgeColor: DEFAULT_BREAK_ICON_BADGE_COLOR,
  iconBadgeTextColor: DEFAULT_BREAK_ICON_BADGE_TEXT_COLOR,
  onComplete: () => {
    chrome.tabs.create({ url: "break.html" });
    currentTimerStatus = CURRENT_TIMER_STATUS.COMPLETE;
  },
};

const openSettingsContextMenuConfig = {
  id: OPEN_SETTINGS_CONTEXT_MENU_ID,
  title: "Open Settings",
  contexts: ["action"],
};

const stopTimerContextMenuConfig = {
  id: STOP_TIMER_CONTEXT_MENU_ID,
  title: "Stop Timer",
  contexts: ["action"],
};

// This function is responsible for starting the timer.
let timerInterval;
const startTimer = (time, config) => {
  console.log("Starting timer with time:", time);
  const { iconBadgeColor, iconBadgeTextColor, onComplete } = config;
  let currentTime = time;
  let remainingMinutes = Math.floor(currentTime / SECONDS_IN_MINUTE);
  //   Setting the icon badge
  chrome.action.setBadgeText({ text: remainingMinutes.toString() });
  chrome.action.setBadgeBackgroundColor({ color: iconBadgeColor });
  chrome.action.setBadgeTextColor({ color: iconBadgeTextColor });

  //   Starting the countdown
  timerInterval = setInterval(() => {
    currentTime = currentTime - SECONDS_IN_MINUTE;
    // Updating the icon badge
    remainingMinutes = Math.floor(currentTime / SECONDS_IN_MINUTE);
    chrome.action.setBadgeText({ text: `${remainingMinutes.toString()}` });
  }, 60 * 1000);

  //   Stopping the countdown
  setTimeout(() => {
    clearInterval(timerInterval);
    chrome.action.setBadgeText({ text: "" });
    if (onComplete) {
      onComplete();
    }
  }, time * 1000);
};

// Stop the timer
const stopTimer = () => {
  clearInterval(timerInterval);
  chrome.action.setBadgeText({ text: "" });
  currentTimerStatus = CURRENT_TIMER_STATUS.IDLE;
};

/*** Chrome Events ***/

//   Called when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create(openSettingsContextMenuConfig);
  chrome.contextMenus.create(stopTimerContextMenuConfig);
});

//   Called when the context menu is clicked
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === OPEN_SETTINGS_CONTEXT_MENU_ID) {
    chrome.tabs.create({ url: "settings.html" });
  } else if (info.menuItemId === STOP_TIMER_CONTEXT_MENU_ID) {
    stopTimer();
  }
});

//   Called when the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (currentTimerStatus === CURRENT_TIMER_STATUS.IDLE) {
    startTimer(DEFAULT_WORK_TIME, workConfig);
    currentTimerStatus = CURRENT_TIMER_STATUS.WORK;
    currentSessions++;
  }
});

//   Called when the extension receives a message
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const allowedStatuses = [
    CURRENT_TIMER_STATUS.WORK,
    CURRENT_TIMER_STATUS.IDLE,
    CURRENT_TIMER_STATUS.COMPLETE,
  ];
  if (
    message.action === "startBreak" &&
    allowedStatuses.includes(currentTimerStatus)
  ) {
    startTimer(DEFAULT_BREAK_TIME, breakConfig);
    currentTimerStatus = CURRENT_TIMER_STATUS.BREAK;
    return true;
  } else if (message.action === "startNewSession") {
    startTimer(DEFAULT_WORK_TIME, workConfig);
    currentSessions++;
    currentTimerStatus = CURRENT_TIMER_STATUS.WORK;
    return true;
  } else if (message.action === "startLongBreak") {
    startTimer(DEFAULT_LARGE_BREAK_TIME, largeBreakConfig);
    currentTimerStatus = CURRENT_TIMER_STATUS.LARGE_BREAK;
    return true;
  }
  return true;
});
