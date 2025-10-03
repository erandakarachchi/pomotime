window.onload = () => {
  // Check timer state and update UI accordingly
  chrome.storage.local.get("timerState", (result) => {
    const timerState = result.timerState;
    const heading = document.querySelector("h2");
    const button = document.getElementById("break");
    
    if (timerState && timerState.currentPhase === "largeBreak") {
      heading.textContent = "Time for a longer break! You've completed a full cycle.";
      button.textContent = "Take a long break";
      console.log("UI updated for large break");
    } else {
      heading.textContent = "You have completed your work session.";
      button.textContent = "Take a break";
      console.log("UI updated for regular break");
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
        console.log("Starting large break timer based on current phase");
      } else {
        console.log("Starting regular break timer based on current phase");
      }
      
      chrome.runtime.sendMessage({ action: action }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          return;
        }
      });
      
      chrome.tabs.getCurrent((tab) => {
        chrome.tabs.remove(tab.id);
      });
    });
  });
};
