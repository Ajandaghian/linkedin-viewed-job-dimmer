const cleanButton = document.getElementById("cleanButton");
const statusNode = document.getElementById("status");

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

async function runCleanup() {
  cleanButton.disabled = true;
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
        type: "li-viewed-remover:clean"
      });
    } catch (_messageError) {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          if (typeof window.__liViewedRemoverRunCleanup === "function") {
            return window.__liViewedRemoverRunCleanup();
          }

          return 0;
        }
      });

      response = { removed: result?.result || 0 };
    }

    const removed = response?.removed || 0;
    setStatus(
      removed > 0
        ? `Removed ${removed} viewed job${removed === 1 ? "" : "s"}.`
        : "No viewed jobs found on this page.",
      removed > 0 ? "ok" : "info"
    );
  } catch (error) {
    setStatus(error?.message || "Failed to run the cleanup.", "error");
  } finally {
    cleanButton.disabled = false;
  }
}

cleanButton.addEventListener("click", runCleanup);
