window.onload = () => {
  const button = document.getElementById("break");
  button.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "startBreak" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        return;
      }
      console.log("Response from service worker:", response);
    });
    chrome.tabs.getCurrent((tab) => {
      chrome.tabs.remove(tab.id);
    });
  });
};