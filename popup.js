const cleanButton = document.getElementById("cleanButton");
const languageButton = document.getElementById("languageButton");
const statusNode = document.getElementById("status");
const actionButtons = [cleanButton, languageButton].filter(Boolean);

function setButtonsDisabled(disabled) {
  for (const button of actionButtons) {
    button.disabled = disabled;
  }
}

function setStatus(message, tone = "") {
  statusNode.textContent = message;
  if (tone) {
    statusNode.dataset.tone = tone;
  } else {
    statusNode.removeAttribute("data-tone");
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  return tabs[0] || null;
}

async function ensureContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });
}

const ACTIONS = {
  clean: {
    messageType: "li-viewed-remover:clean",
    fallbackName: "__liViewedRemoverRunCleanup",
    resultKey: "removed",
    startMessage: "Removing viewed jobs...",
    errorMessage: "Failed to remove viewed jobs.",
    successMessage(count) {
      return count > 0
        ? `Removed ${count} viewed job${count === 1 ? "" : "s"}.`
        : "No viewed jobs found on this page.";
    }
  },
  language: {
    messageType: "li-viewed-remover:detect-languages",
    fallbackName: "__liViewedRemoverRunLanguageScan",
    resultKey: "marked",
    startMessage: "Scanning job pages for language...",
    errorMessage: "Failed to detect languages.",
    successMessage(count) {
      return count > 0
        ? `Added language markers to ${count} job${count === 1 ? "" : "s"}.`
        : "No language markers were added on this page.";
    }
  }
};

async function runAction(action) {
  setButtonsDisabled(true);
  setStatus(action.startMessage);

  try {
    const tab = await getActiveTab();
    if (!tab || !tab.id || !tab.url || !tab.url.includes("linkedin.com/jobs")) {
      throw new Error("Open a LinkedIn jobs tab first.");
    }

    await ensureContentScript(tab.id);

    let response = null;
    try {
      response = await chrome.tabs.sendMessage(tab.id, {
        type: action.messageType
      });
    } catch (_messageError) {
      response = null;
    }

    if (response && response.ok === false) {
      throw new Error(response.error || action.errorMessage);
    }

    let count = Number(response?.[action.resultKey] || 0);
    if (!response) {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (runnerName) => {
          const runner = window[runnerName];
          if (typeof runner === "function") {
            return runner();
          }

          return 0;
        },
        args: [action.fallbackName]
      });

      count = Number(result?.result || 0);
    }

    setStatus(action.successMessage(count), count > 0 ? "ok" : "info");
  } catch (error) {
    setStatus(error?.message || action.errorMessage, "error");
  } finally {
    setButtonsDisabled(false);
  }
}

cleanButton.addEventListener("click", () => {
  runAction(ACTIONS.clean);
});

languageButton.addEventListener("click", () => {
  runAction(ACTIONS.language);
});
