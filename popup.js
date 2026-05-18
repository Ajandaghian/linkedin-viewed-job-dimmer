const dimButton = document.getElementById("dimButton");
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

dimButton.addEventListener("click", runDimming);
