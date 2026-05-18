const dimButton = document.getElementById("dimButton");
const alwaysOnToggle = document.getElementById("alwaysOnToggle");
const modeTitle = document.getElementById("modeTitle");
const modeDescription = document.getElementById("modeDescription");
const switchText = document.getElementById("switchText");
const statusNode = document.getElementById("status");

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

async function readAlwaysOnFromTab(tabId) {
  await ensureContentScript(tabId);

  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "li-viewed-remover:get-mode"
    });

    if (response && response.ok) {
      return Boolean(response.alwaysOn);
    }
  } catch (_error) {
    // Fallback below.
  }

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      if (typeof window.__liViewedRemoverGetAlwaysOn === "function") {
        return Boolean(window.__liViewedRemoverGetAlwaysOn());
      }

      return false;
    }
  });

  return Boolean(result?.result);
}

async function writeAlwaysOnToTab(tabId, alwaysOn) {
  await ensureContentScript(tabId);

  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "li-viewed-remover:set-mode",
      alwaysOn
    });

    if (response && response.ok) {
      return Boolean(response.alwaysOn);
    }
  } catch (_error) {
    // Fallback below.
  }

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    args: [alwaysOn],
    func: (value) => {
      if (typeof window.__liViewedRemoverSetAlwaysOn === "function") {
        return Boolean(window.__liViewedRemoverSetAlwaysOn(value));
      }

      return Boolean(value);
    }
  });

  return Boolean(result?.result ?? alwaysOn);
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
    const tab = await getActiveTab();
    if (!tab || !tab.id || !isLinkedInJobsUrl(tab.url)) {
      setModeText(false);
      dimButton.disabled = true;
      alwaysOnToggle.disabled = true;
      setStatus("Open a LinkedIn jobs tab first.", "info");
      return;
    }

    const alwaysOn = await readAlwaysOnFromTab(tab.id);
    setModeText(alwaysOn);
    dimButton.disabled = false;
    alwaysOnToggle.disabled = false;
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
alwaysOnToggle.addEventListener("change", async () => {
  alwaysOnToggle.disabled = true;

  try {
    const tab = await getActiveTab();
    if (!tab || !tab.id || !isLinkedInJobsUrl(tab.url)) {
      throw new Error("Open a LinkedIn jobs tab first.");
    }

    const updated = await writeAlwaysOnToTab(tab.id, alwaysOnToggle.checked);
    setModeText(updated);
    setStatus(
      updated
        ? "Always run is on. Viewed jobs will dim automatically."
        : "Only when selected is on. Click the button to dim viewed jobs.",
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
