const dimButton = document.getElementById("dimButton");
const alwaysOnToggle = document.getElementById("alwaysOnToggle");
const modeTitle = document.getElementById("modeTitle");
const modeDescription = document.getElementById("modeDescription");
const switchText = document.getElementById("switchText");
const statusNode = document.getElementById("status");
const STORAGE_KEY = "liViewedRemoverAlwaysOn";

let currentAlwaysOn = false;

function setStatus(message, tone = "") {
  statusNode.textContent = message;
  if (tone) {
    statusNode.dataset.tone = tone;
  } else {
    statusNode.removeAttribute("data-tone");
  }
}

function setModeText(alwaysOn) {
  currentAlwaysOn = Boolean(alwaysOn);
  alwaysOnToggle.checked = currentAlwaysOn;
  modeTitle.textContent = currentAlwaysOn ? "Always run" : "Only when selected";
  modeDescription.textContent = currentAlwaysOn
    ? "Viewed jobs are dimmed automatically on every LinkedIn jobs page."
    : "Viewed jobs are only dimmed after you click the button.";
  switchText.textContent = "Always run";
}

function isLinkedInJobsUrl(url) {
  return typeof url === "string" && url.includes("linkedin.com/jobs");
}

async function readAlwaysOnSetting() {
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      return Boolean(result?.[STORAGE_KEY]);
    }
  } catch (_error) {
    // Fallback below.
  }

  return false;
}

async function writeAlwaysOnSetting(alwaysOn) {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({ [STORAGE_KEY]: Boolean(alwaysOn) });
    return;
  }

  throw new Error("Storage is unavailable in this popup.");
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

async function runDimming() {
  dimButton.disabled = true;
  setStatus("Checking the active tab...");

  try {
    const tab = await getActiveTab();
    if (!tab || !tab.id || !isLinkedInJobsUrl(tab.url)) {
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
    const alwaysOn = await readAlwaysOnSetting();
    setModeText(alwaysOn);

    const tab = await getActiveTab();
    const isLinkedInTab = Boolean(tab && tab.id && isLinkedInJobsUrl(tab.url));

    if (!isLinkedInTab) {
      dimButton.disabled = true;
      alwaysOnToggle.disabled = false;
      setStatus(
        alwaysOn
          ? "LinkedIn Viewed Job Dimmer is on. It will apply the next time you open a LinkedIn jobs tab."
          : "LinkedIn Viewed Job Dimmer is ready. Toggle here to save the default for LinkedIn jobs tabs.",
        "info"
      );
      return;
    }

    dimButton.disabled = false;
    alwaysOnToggle.disabled = false;
    setStatus(
      alwaysOn
        ? "LinkedIn Viewed Job Dimmer is on. Viewed jobs will dim automatically."
        : "LinkedIn Viewed Job Dimmer is in manual mode. Click the button to dim viewed jobs.",
      "info"
    );
  } catch (error) {
    setModeText(false);
    setStatus(error?.message || "Failed to load the saved setting.", "error");
  }
}

dimButton.addEventListener("click", runDimming);
alwaysOnToggle.addEventListener("change", async () => {
  alwaysOnToggle.disabled = true;
  const nextValue = alwaysOnToggle.checked;

  try {
    await writeAlwaysOnSetting(nextValue);
    setModeText(nextValue);

    setStatus(
      nextValue
        ? "LinkedIn Viewed Job Dimmer is on. Viewed jobs will dim automatically."
        : "LinkedIn Viewed Job Dimmer is in manual mode. Click the button to dim viewed jobs.",
      "info"
    );
  } catch (error) {
    setModeText(currentAlwaysOn);
    setStatus(error?.message || "Failed to update the setting.", "error");
  } finally {
    alwaysOnToggle.disabled = false;
  }
});

void initializePopup();
