const dimButton = document.getElementById("dimButton");
const alwaysOnToggle = document.getElementById("alwaysOnToggle");
const modeTitle = document.getElementById("modeTitle");
const modeDescription = document.getElementById("modeDescription");
const switchText = document.getElementById("switchText");
const keywordRulesNode = document.getElementById("keywordRules");
const addRuleButton = document.getElementById("addRuleButton");
const saveRulesButton = document.getElementById("saveRulesButton");
const statusNode = document.getElementById("status");

const STORAGE_KEYS = {
  alwaysOn: "liViewedRemoverAlwaysOn",
  highlightRules: "liViewedRemoverHighlightRules"
};

const COLOR_OPTIONS = [
  { value: "amber", label: "Amber", bg: "#fde68a", fg: "#1f2937" },
  { value: "sky", label: "Sky", bg: "#bae6fd", fg: "#0f172a" },
  { value: "emerald", label: "Emerald", bg: "#bbf7d0", fg: "#064e3b" },
  { value: "rose", label: "Rose", bg: "#fecdd3", fg: "#881337" },
  { value: "violet", label: "Violet", bg: "#ddd6fe", fg: "#312e81" },
  { value: "orange", label: "Orange", bg: "#fed7aa", fg: "#7c2d12" },
  { value: "teal", label: "Teal", bg: "#99f6e4", fg: "#134e4a" },
  { value: "pink", label: "Pink", bg: "#fbcfe8", fg: "#831843" },
  { value: "lime", label: "Lime", bg: "#d9f99d", fg: "#365314" },
  { value: "slate", label: "Slate", bg: "#cbd5e1", fg: "#0f172a" }
];

let currentAlwaysOn = false;

function createRuleId() {
  return `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

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
    ? "Viewed jobs dim automatically. Saved keyword sets highlight in the main JD on LinkedIn jobs pages."
    : "Viewed jobs dim only after you click the button. Saved keyword sets stay editable here.";
  switchText.textContent = "Always run";
}

function isLinkedInJobsUrl(url) {
  return typeof url === "string" && url.includes("linkedin.com/jobs");
}

function getColorOption(value) {
  return COLOR_OPTIONS.find((option) => option.value === value) || COLOR_OPTIONS[0];
}

function normalizeStoredHighlightRules(value) {
  const parsed = typeof value === "string" ? (() => {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return [];
    }
  })() : value;

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((rule) => ({
      id: typeof rule?.id === "string" && rule.id ? rule.id : createRuleId(),
      keywords: typeof rule?.keywords === "string" ? rule.keywords : "",
      color: getColorOption(rule?.color).value
    }))
    .filter((rule) => rule.keywords.trim().length > 0);
}

async function readAlwaysOnSetting() {
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      const result = await chrome.storage.local.get(STORAGE_KEYS.alwaysOn);
      return Boolean(result?.[STORAGE_KEYS.alwaysOn]);
    }
  } catch (_error) {
    // Fallback below.
  }

  try {
    return window.localStorage.getItem(STORAGE_KEYS.alwaysOn) === "1";
  } catch (_error) {
    return false;
  }
}

async function writeAlwaysOnSetting(alwaysOn) {
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [STORAGE_KEYS.alwaysOn]: Boolean(alwaysOn) });
      return;
    }
  } catch (_error) {
    // Fallback below.
  }

  try {
    window.localStorage.setItem(STORAGE_KEYS.alwaysOn, alwaysOn ? "1" : "0");
  } catch (_error) {
    throw new Error("Storage is unavailable in this popup.");
  }
}

async function readHighlightRulesSetting() {
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      const result = await chrome.storage.local.get(STORAGE_KEYS.highlightRules);
      return normalizeStoredHighlightRules(result?.[STORAGE_KEYS.highlightRules]);
    }
  } catch (_error) {
    // Fallback below.
  }

  try {
    return normalizeStoredHighlightRules(window.localStorage.getItem(STORAGE_KEYS.highlightRules));
  } catch (_error) {
    return [];
  }
}

async function writeHighlightRulesSetting(rules) {
  const serialized = JSON.stringify(rules);

  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [STORAGE_KEYS.highlightRules]: serialized });
      return;
    }
  } catch (_error) {
    // Fallback below.
  }

  try {
    window.localStorage.setItem(STORAGE_KEYS.highlightRules, serialized);
  } catch (_error) {
    throw new Error("Storage is unavailable in this popup.");
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

function syncRowColor(row, colorValue) {
  const option = getColorOption(colorValue);
  const select = row.querySelector(".color-select");

  row.dataset.color = option.value;
  row.style.setProperty("--selected-bg", option.bg);
  row.style.setProperty("--selected-fg", option.fg);

  if (select) {
    select.style.setProperty("--selected-bg", option.bg);
    select.style.setProperty("--selected-fg", option.fg);
  }
}

function createRuleRow(rule = {}) {
  const row = document.createElement("div");
  row.className = "keyword-row";
  row.dataset.ruleId = typeof rule.id === "string" && rule.id ? rule.id : createRuleId();

  const input = document.createElement("input");
  input.type = "text";
  input.className = "keyword-input";
  input.placeholder = "SQL, Python, year, years";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.value = typeof rule.keywords === "string" ? rule.keywords : "";
  input.setAttribute("aria-label", "Keywords for this color group");

  const select = document.createElement("select");
  select.className = "color-select";
  select.setAttribute("aria-label", "Highlight color");

  for (const option of COLOR_OPTIONS) {
    const optionNode = document.createElement("option");
    optionNode.value = option.value;
    optionNode.textContent = option.label;
    select.appendChild(optionNode);
  }

  select.value = getColorOption(rule.color).value;
  select.addEventListener("change", () => {
    syncRowColor(row, select.value);
  });

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "remove-button";
  removeButton.textContent = "×";
  removeButton.setAttribute("aria-label", "Remove keyword set");
  removeButton.addEventListener("click", () => {
    row.remove();
    if (!keywordRulesNode.querySelector(".keyword-row")) {
      addRuleRow();
    }
  });

  row.append(input, select, removeButton);
  syncRowColor(row, select.value);
  return row;
}

function addRuleRow(rule = {}) {
  const row = createRuleRow(rule);
  keywordRulesNode.appendChild(row);
  return row;
}

function loadHighlightRules(rules) {
  keywordRulesNode.replaceChildren();

  if (!rules.length) {
    addRuleRow();
    return;
  }

  for (const rule of rules) {
    addRuleRow(rule);
  }
}

function collectHighlightRules() {
  return Array.from(keywordRulesNode.querySelectorAll(".keyword-row"))
    .map((row) => {
      const input = row.querySelector(".keyword-input");
      const select = row.querySelector(".color-select");
      const keywords = (input?.value || "").trim();
      const color = getColorOption(select?.value).value;

      return {
        id: row.dataset.ruleId || createRuleId(),
        keywords,
        color
      };
    })
    .filter((rule) => rule.keywords.length > 0);
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

async function runHighlightSave() {
  saveRulesButton.disabled = true;
  setStatus("Saving keyword sets...");

  try {
    const rules = collectHighlightRules();
    await writeHighlightRulesSetting(rules);

    const tab = await getActiveTab();
    const ruleCount = rules.length;

    if (!tab || !tab.id || !isLinkedInJobsUrl(tab.url)) {
      setStatus(
        ruleCount > 0
          ? `Saved ${pluralize(ruleCount, "keyword set")}. Open a LinkedIn jobs tab to highlight them in the main JD.`
          : "Keyword sets cleared.",
        ruleCount > 0 ? "ok" : "info"
      );
      return;
    }

    await ensureContentScript(tab.id);

    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, {
        type: "li-viewed-remover:set-highlight-rules",
        rules
      });
    } catch (_messageError) {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (payload) => {
          if (typeof window.__liViewedRemoverApplyHighlightRules === "function") {
            return window.__liViewedRemoverApplyHighlightRules(payload);
          }

          if (typeof window.__liViewedRemoverRefreshHighlights === "function") {
            return window.__liViewedRemoverRefreshHighlights();
          }

          return null;
        },
        args: [rules]
      });

      response = result?.result || {};
    }

    const highlighted = response?.highlighted || 0;

    if (ruleCount === 0) {
      setStatus("Keyword sets cleared. Saved changes will remove JD highlights on LinkedIn jobs pages.", "info");
      return;
    }

    setStatus(
      highlighted > 0
        ? `Saved ${pluralize(ruleCount, "keyword set")} and highlighted ${pluralize(highlighted, "match")} in the JD.`
        : `Saved ${pluralize(ruleCount, "keyword set")}. No matches found in the current JD.`,
      highlighted > 0 ? "ok" : "info"
    );
  } catch (error) {
    setStatus(error?.message || "Failed to save keyword sets.", "error");
  } finally {
    saveRulesButton.disabled = false;
  }
}

async function initializePopup() {
  try {
    const [alwaysOn, rules] = await Promise.all([readAlwaysOnSetting(), readHighlightRulesSetting()]);
    setModeText(alwaysOn);
    loadHighlightRules(rules);

    const tab = await getActiveTab();
    const isLinkedInTab = Boolean(tab && tab.id && isLinkedInJobsUrl(tab.url));

    if (!isLinkedInTab) {
      dimButton.disabled = true;
      setStatus(
        rules.length > 0
          ? `Saved ${pluralize(rules.length, "keyword set")}. Open a LinkedIn jobs tab to highlight the main JD.`
          : "Add keyword sets here, then open a LinkedIn jobs tab to highlight the main JD.",
        "info"
      );
      return;
    }

    dimButton.disabled = false;
    setStatus(
      rules.length > 0
        ? `${pluralize(rules.length, "keyword set")} are ready for this LinkedIn jobs tab.`
        : alwaysOn
          ? "LinkedIn Viewed Job Dimmer is on. Viewed jobs will dim automatically."
          : "LinkedIn Viewed Job Dimmer is in manual mode. Click the button to dim viewed jobs.",
      "info"
    );
  } catch (error) {
    setModeText(false);
    loadHighlightRules([]);
    setStatus(error?.message || "Failed to load the saved settings.", "error");
  }
}

dimButton.addEventListener("click", runDimming);
addRuleButton.addEventListener("click", () => {
  addRuleRow();
});
saveRulesButton.addEventListener("click", runHighlightSave);

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
