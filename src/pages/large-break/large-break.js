window.onload = () => {
    const button = document.getElementById("startLongBreak");
    button.addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "startWorkTimer" }, (response) => {
        if (chrome.runtime.lastError || !response?.ok) {
          console.error(chrome.runtime.lastError || response?.error);
          return; // keep the page open so the user can try again
        }
        chrome.tabs.getCurrent((tab) => {
          chrome.tabs.remove(tab.id);
        });
      });
    });
  };

