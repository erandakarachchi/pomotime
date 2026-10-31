const defaultSettings = require("../../core/settings.json");

const DOT_CLASS = "dot";
const DOT_FILLED_CLASS = "dot-filled";

/**
 * Draws one dot per work cycle in the current round; filled for completed ones.
 */
const renderCycleDots = (completedCycles, maxCycles) => {
  const container = document.getElementById("cycleDots");
  for (let i = 0; i < maxCycles; i++) {
    const dot = document.createElement("span");
    dot.className = i < completedCycles ? `${DOT_CLASS} ${DOT_FILLED_CLASS}` : DOT_CLASS;
    container.appendChild(dot);
  }
};

window.onload = () => {
  chrome.storage.local.get("settings", (result) => {
    const maxCycles =
      parseInt(result.settings?.timerSettings?.maxCycles) || defaultSettings.timerSettings.maxCycles;
    chrome.storage.local.get("timerState", ({ timerState }) => {
      renderCycleDots(timerState?.workCyclesCompleted ?? 0, maxCycles);
    });
  });

  // Check timer state and update UI accordingly
  chrome.storage.local.get("timerState", (result) => {
    const timerState = result.timerState;
    const heading = document.querySelector("h2");
    const button = document.getElementById("break");

    if (timerState && timerState.currentPhase === "largeBreak") {
      heading.textContent = "Time for a longer break! You've completed a full cycle.";
      button.textContent = "Take a long break";
    } else {
      heading.textContent = "You have completed your work session.";
      button.textContent = "Take a break";
    }
  });

  const button = document.getElementById("break");
  button.addEventListener("click", async () => {
    // Get the current timer state to determine which type of break to start
    chrome.storage.local.get("timerState", (result) => {
      const timerState = result.timerState;
      let action = "startBreakTimer"; // default to regular break
      
      if (timerState && timerState.currentPhase === "largeBreak") {
        action = "startLargeBreakTimer";
      }
      
      chrome.runtime.sendMessage({ action: action }, (response) => {
        if (chrome.runtime.lastError || !response?.ok) {
          console.error(chrome.runtime.lastError || response?.error);
          return; // keep the page open so the user can try again
        }
        chrome.tabs.getCurrent((tab) => {
          chrome.tabs.remove(tab.id);
        });
      });
    });
  });
};
