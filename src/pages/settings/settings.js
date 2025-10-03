window.addEventListener("DOMContentLoaded", () => {
  const workTimeInput = document.getElementById("workTime");
  const breakTimeInput = document.getElementById("breakTime");
  const largeBreakTimeInput = document.getElementById("largeBreakTime");
  const maxCyclesInput = document.getElementById("maxCycles");

  chrome.storage.local.get("settings", (result) => {
    const settings = result.settings;
    workTimeInput.value = settings.timerSettings.workTime;
    breakTimeInput.value = settings.timerSettings.breakTime;
    largeBreakTimeInput.value = settings.timerSettings.largeBreakTime;
    maxCyclesInput.value = settings.timerSettings.maxCycles;
  });

  const settingsForm = document.querySelector(".settings-form");
  settingsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    
    // Get existing settings first to preserve notification settings
    chrome.storage.local.get("settings", (result) => {
      const existingSettings = result.settings || {};
      
      chrome.storage.local.set(
        {
          settings: {
            ...existingSettings,
            timerSettings: {
              workTime: parseInt(workTimeInput.value),
              breakTime: parseInt(breakTimeInput.value),
              largeBreakTime: parseInt(largeBreakTimeInput.value),
              maxCycles: parseInt(maxCyclesInput.value),
            },
          },
        },
        () => {
          chrome.notifications.create({
            type: "basic",
            title: "Settings Saved",
            message: "Your timer settings have been updated successfully!",
            iconUrl: "/icons/icon48.png",
          });
        }
      );
    });
  });
});
