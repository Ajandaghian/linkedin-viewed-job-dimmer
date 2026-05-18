const dimButton = document.getElementById("dimButton");
const alwaysOnToggle = document.getElementById("alwaysOnToggle");
const modeTitle = document.getElementById("modeTitle");
const modeDescription = document.getElementById("modeDescription");
const switchText = document.getElementById("switchText");
const statusNode = document.getElementById("status");

const STORAGE_KEY = "liViewedRemoverAlwaysOn";

function setStatus(message, tone = "") {
  statusNode.textContent = message;
  if (tone) {
    statusNode.dataset.tone = tone;
  } else {
    statusNode.removeAttribute("data-tone");
  }
}

function setModeText(alwaysOn) {
  alwaysOnToggle.checked = alwaysOn;
  modeTitle.textContent = alwaysOn ? "Always run" : "Only when selected";
  modeDescription.textContent = alwaysOn
    ? "Viewed jobs are dimmed automatically on every LinkedIn jobs page."
    : "Viewed jobs are only dimmed after you click the button.";
  switchText.textContent = "Always run";
}

function storageGet(defaultValue) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get({ [STORAGE_KEY]: defaultValue }, (items) => {
        const error = chrome.runtime && chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }

        resolve(items?.[STORAGE_KEY] ?? defaultValue);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function storageSet(alwaysOn) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set({ [STORAGE_KEY]: alwaysOn }, () => {
        const error = chrome.runtime && chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }

        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
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

async function setAlwaysOn(alwaysOn) {
  await storageSet(alwaysOn);
  setModeText(alwaysOn);
  setStatus(
    alwaysOn
      ? "Always run is on. Viewed jobs will dim automatically."
      : "Only when selected is on. Click the button to dim viewed jobs.",
    "info"
  );
}

async function runDimming() {
  dimButton.disabled = true;
  setStatus("Checking the active tab...");

  try {
    const tab = await getActiveTab();
    if (!tab || !tab.id || !tab.url || !tab.url.includes("linkedin.com/jobs")) {
      throw new Error("Open a LinkedIn jobs tab first.");
    }

    await ensureContentScript(tab.id);

    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, {
        type: "li-viewed-remover:dim"
      });
    } catch (_messageError) {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          if (typeof window.__liViewedRemoverRunDimming === "function") {
            return window.__liViewedRemoverRunDimming();
          }

          if (typeof window.__liViewedRemoverRunCleanup === "function") {
            return window.__liViewedRemoverRunCleanup();
          }

          return 0;
        }
      });

      response = { dimmed: result?.result || 0 };
    }

    const dimmed = response?.dimmed || 0;
    setStatus(
      dimmed > 0
        ? `Dimmed ${dimmed} viewed job${dimmed === 1 ? "" : "s"}.`
        : "No viewed jobs found to dim on this page.",
      dimmed > 0 ? "ok" : "info"
    );
  } catch (error) {
    setStatus(error?.message || "Failed to dim the jobs.", "error");
  } finally {
    dimButton.disabled = false;
  }
}

async function initializePopup() {
  try {
    const alwaysOn = Boolean(await storageGet(false));
    setModeText(alwaysOn);
    setStatus(
      alwaysOn
        ? "Always run is on. Viewed jobs will dim automatically."
        : "Only when selected is on. Click the button to dim viewed jobs.",
      "info"
    );
  } catch (error) {
    setModeText(false);
    setStatus(error?.message || "Failed to load the saved setting.", "error");
  }
}

dimButton.addEventListener("click", runDimming);
alwaysOnToggle.addEventListener("change", () => {
  void setAlwaysOn(alwaysOnToggle.checked);
});

void initializePopup();
