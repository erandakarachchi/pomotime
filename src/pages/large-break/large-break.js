window.onload = () => {
    const button = document.getElementById("startLongBreak");
    button.addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "startWorkTimer" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          return;
        }
      });
      chrome.tabs.getCurrent((tab) => {
        chrome.tabs.remove(tab.id);
      });
    });
  };
  