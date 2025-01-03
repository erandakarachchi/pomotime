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
    console.log("form submitted");
    chrome.storage.local.set(
      {
        settings: {
          timerSettings: {
            workTime: workTimeInput.value,
            breakTime: breakTimeInput.value,
            largeBreakTime: largeBreakTimeInput.value,
            maxCycles: maxCyclesInput.value,
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
