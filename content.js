(() => {
  const GLOBAL_KEY = "__liViewedRemoverState";
  const HOST_ID = "li-viewed-remover-host";
  const STYLE_ID = "li-viewed-remover-style";
  const CARD_STYLE_ID = "li-viewed-remover-card-style";
  const HIGHLIGHT_STYLE_ID = "li-viewed-remover-highlight-style";
  const STORAGE_KEY = "liViewedRemoverAlwaysOn";
  const HIGHLIGHT_STORAGE_KEY = "liViewedRemoverHighlightRules";
  const BUTTON_ID = "li-viewed-remover-button";
  const STATUS_ID = "li-viewed-remover-status";
  const HIGHLIGHT_MARK_CLASS = "li-viewed-remover-keyword-mark";
  const HIGHLIGHT_COLOR_MAP = {
    amber: { bg: "#fde68a", fg: "#1f2937" },
    sky: { bg: "#bae6fd", fg: "#0f172a" },
    emerald: { bg: "#bbf7d0", fg: "#064e3b" },
    rose: { bg: "#fecdd3", fg: "#881337" },
    violet: { bg: "#ddd6fe", fg: "#312e81" },
    orange: { bg: "#fed7aa", fg: "#7c2d12" },
    teal: { bg: "#99f6e4", fg: "#134e4a" },
    pink: { bg: "#fbcfe8", fg: "#831843" },
    lime: { bg: "#d9f99d", fg: "#365314" },
    slate: { bg: "#cbd5e1", fg: "#0f172a" }
  };

  const state = window[GLOBAL_KEY] || (window[GLOBAL_KEY] = {
    bootstrapped: false,
    autoEnabled: false,
    manualEnabled: false,
    refreshQueued: false,
    highlightRules: [],
    highlightSignature: "",
    observer: null,
    host: null,
    button: null,
    status: null,
    storageListenerAttached: false,
    messageListenerAttached: false
  });

  function isLinkedInJobsPage() {
    const host = location.hostname;
    const isLinkedInHost = host === "linkedin.com" || host === "www.linkedin.com" || host.endsWith(".linkedin.com");
    return isLinkedInHost && /^\/jobs\//.test(location.pathname);
  }

  function hasActiveMode() {
    return state.autoEnabled || state.manualEnabled || state.highlightRules.length > 0;
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

    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch (_error) {
      return false;
    }
  }

  async function writeAlwaysOnSetting(alwaysOn) {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [STORAGE_KEY]: Boolean(alwaysOn) });
        return;
      }
    } catch (_error) {
      // Fallback below.
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, alwaysOn ? "1" : "0");
    } catch (_error) {
      // Ignore storage failures; the page still gets updated for this session.
    }
  }

  async function readHighlightRulesSetting() {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(HIGHLIGHT_STORAGE_KEY);
        return result?.[HIGHLIGHT_STORAGE_KEY] || "[]";
      }
    } catch (_error) {
      // Fallback below.
    }

    try {
      return window.localStorage.getItem(HIGHLIGHT_STORAGE_KEY) || "[]";
    } catch (_error) {
      return "[]";
    }
  }

  async function writeHighlightRulesSetting(rules) {
    const serialized = JSON.stringify(rules);

    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [HIGHLIGHT_STORAGE_KEY]: serialized });
        return;
      }
    } catch (_error) {
      // Fallback below.
    }

    try {
      window.localStorage.setItem(HIGHLIGHT_STORAGE_KEY, serialized);
    } catch (_error) {
      // Ignore storage failures; the page still gets updated for this session.
    }
  }

  function normalizeText(value) {
    return String(value ?? "").replace(/\r\n/g, "\n");
  }

  function normalizeHighlightColor(color) {
    return Object.prototype.hasOwnProperty.call(HIGHLIGHT_COLOR_MAP, color)
      ? color
      : "amber";
  }

  function parseHighlightTerms(rawKeywords) {
    const seen = new Set();
    const terms = [];

    for (const fragment of normalizeText(rawKeywords).split(/[,\n;]+/)) {
      const term = fragment.trim();
      if (!term) {
        continue;
      }

      const lower = term.toLowerCase();
      if (seen.has(lower)) {
        continue;
      }

      seen.add(lower);
      terms.push(term);
    }

    return terms;
  }

  function normalizeHighlightRules(rawValue) {
    const parsed = Array.isArray(rawValue)
      ? rawValue
      : (() => {
          try {
            return JSON.parse(normalizeText(rawValue) || "[]");
          } catch (_error) {
            return [];
          }
        })();

    if (!Array.isArray(parsed)) {
      return [];
    }

    const seen = new Set();
    const rules = [];

    for (const [index, rule] of parsed.entries()) {
      const keywords = normalizeText(
        typeof rule?.keywords === "string"
          ? rule.keywords
          : typeof rule?.terms === "string"
            ? rule.terms
            : ""
      ).trim();
      const terms = parseHighlightTerms(keywords);
      if (!terms.length) {
        continue;
      }

      const color = normalizeHighlightColor(rule?.color);
      const signature = `${color}::${terms.map((term) => term.toLowerCase()).join("|")}`;
      if (seen.has(signature)) {
        continue;
      }

      seen.add(signature);
      rules.push({
        id: typeof rule?.id === "string" && rule.id ? rule.id : `rule-${index}`,
        color,
        keywords,
        terms
      });
    }

    return rules;
  }

  function buildHighlightSignature(rules) {
    return JSON.stringify(
      rules.map((rule) => ({
        color: rule.color,
        keywords: rule.keywords,
        terms: rule.terms.map((term) => term.toLowerCase())
      }))
    );
  }

  function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function buildHighlightPattern(term) {
    const trimmed = term.trim();
    if (!trimmed) {
      return "";
    }

    const escaped = escapeRegex(trimmed).replace(/\s+/g, "\\s+");
    const startsWithWord = /^[A-Za-z0-9]/.test(trimmed);
    const endsWithWord = /[A-Za-z0-9]$/.test(trimmed);

    return `${startsWithWord ? "\\b" : ""}${escaped}${endsWithWord ? "\\b" : ""}`;
  }

  function buildHighlightMatcher(rules) {
    const groupColors = {};
    const groupTerms = {};
    const patterns = [];
    let index = 0;

    for (const rule of rules) {
      for (const term of rule.terms) {
        const pattern = buildHighlightPattern(term);
        if (!pattern) {
          continue;
        }

        const groupName = `k${index}`;
        patterns.push(`(?<${groupName}>${pattern})`);
        groupColors[groupName] = rule.color;
        groupTerms[groupName] = term;
        index += 1;
      }
    }

    return {
      regex: patterns.length ? new RegExp(patterns.join("|"), "gi") : null,
      groupColors,
      groupTerms
    };
  }

  function setObserverActive(active) {
    if (!active) {
      if (state.observer) {
        state.observer.disconnect();
        state.observer = null;
      }
      state.refreshQueued = false;
      return;
    }

    startObserver();
  }

  function ensureStyles(shadowRoot) {
    if (shadowRoot.querySelector(`#${STYLE_ID}`)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      :host {
        all: initial;
        position: fixed;
        left: 0;
        bottom: 0;
        width: 0;
        height: 0;
        z-index: 2147483647;
        pointer-events: none;
      }

      .panel {
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: 240px;
        padding: 12px;
        border-radius: 20px;
        background: linear-gradient(160deg, rgba(11, 18, 32, 0.96), rgba(17, 31, 53, 0.94));
        color: #e9f0fb;
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .eyebrow {
        margin: 0;
        color: #8ea4c7;
        font-size: 11px;
        line-height: 1;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .title {
        margin: 0;
        font-size: 15px;
        line-height: 1.2;
        font-weight: 700;
      }

      .copy {
        margin: 0;
        color: #c7d3e6;
        font-size: 12px;
        line-height: 1.45;
      }

      .button {
        appearance: none;
        border: 0;
        border-radius: 999px;
        padding: 11px 14px;
        background: linear-gradient(135deg, #0a66c2, #1c8bf0);
        color: #ffffff;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.01em;
        cursor: pointer;
        box-shadow: 0 12px 24px rgba(10, 102, 194, 0.28);
        transition: transform 140ms ease, box-shadow 140ms ease, filter 140ms ease;
      }

      .button:hover {
        transform: translateY(-1px);
        filter: brightness(1.04);
      }

      .button:active {
        transform: translateY(0);
        filter: brightness(0.98);
      }

      .button:focus-visible {
        outline: 3px solid rgba(145, 202, 255, 0.85);
        outline-offset: 2px;
      }

      .status {
        min-height: 18px;
        padding: 10px 12px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.07);
        color: #e9f0fb;
        font-size: 12px;
        line-height: 1.45;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .status[data-tone="ok"] {
        background: rgba(31, 155, 109, 0.16);
        border-color: rgba(31, 155, 109, 0.28);
      }

      .status[data-tone="error"] {
        background: rgba(239, 68, 68, 0.16);
        border-color: rgba(239, 68, 68, 0.28);
      }
    `;
    shadowRoot.appendChild(style);
  }

  function ensureCardStyles() {
    const css = `
      li[data-occludable-job-id].li-viewed-remover-dimmed {
        opacity: 0.62 !important;
        filter: grayscale(1) saturate(0.06) brightness(0.92) contrast(0.96) !important;
      }

      li[data-occludable-job-id].li-viewed-remover-dimmed,
      li[data-occludable-job-id].li-viewed-remover-dimmed * {
        color: #6b7280 !important;
        text-shadow: none !important;
      }

      li[data-occludable-job-id].li-viewed-remover-dimmed .job-card-container,
      li[data-occludable-job-id].li-viewed-remover-dimmed .artdeco-entity-lockup,
      li[data-occludable-job-id].li-viewed-remover-dimmed .job-card-container--clickable {
        background: rgba(31, 41, 55, 0.03) !important;
      }

      li[data-occludable-job-id].li-viewed-remover-dimmed a[href*="/jobs/view/"] {
        pointer-events: none !important;
        cursor: default !important;
        text-decoration: none !important;
      }

      li[data-occludable-job-id].li-viewed-remover-dimmed .job-card-container__footer-job-state {
        color: #6b7280 !important;
      }
    `;

    const existing = document.getElementById(CARD_STYLE_ID);
    if (existing) {
      existing.textContent = css;
      return;
    }

    const style = document.createElement("style");
    style.id = CARD_STYLE_ID;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function ensureHighlightStyles() {
    if (document.getElementById(HIGHLIGHT_STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = HIGHLIGHT_STYLE_ID;
    style.textContent = `
      mark.${HIGHLIGHT_MARK_CLASS} {
        padding: 0 0.16em !important;
        border-radius: 4px !important;
        box-decoration-break: clone !important;
        -webkit-box-decoration-break: clone !important;
        text-shadow: none !important;
        font-weight: inherit !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function clearKeywordHighlights(root = document) {
    const marks = Array.from(root.querySelectorAll(`mark.${HIGHLIGHT_MARK_CLASS}`));

    for (const mark of marks) {
      const textNode = document.createTextNode(mark.textContent || "");
      mark.replaceWith(textNode);
    }
  }

  function findHighlightRoot() {
    const selectors = [
      "div.scaffold-layout__detail",
      "div.jobs-search__job-details--container",
      "div.jobs-search__job-details",
      "section.jobs-search__job-details",
      "main"
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
    }

    const heading = Array.from(document.querySelectorAll("h1, h2, h3, [role='heading']"))
      .find((element) => /\b(about the job|job description|description)\b/i.test(element.textContent || ""));

    if (heading) {
      return heading.closest("section, article, div") || heading.parentElement || null;
    }

    return document.body || document.documentElement || null;
  }

  function collectHighlightTextNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const text = node.nodeValue || "";
        if (!text.trim()) {
          return NodeFilter.FILTER_REJECT;
        }

        const parent = node.parentElement;
        if (!parent) {
          return NodeFilter.FILTER_REJECT;
        }

        if (parent.closest(`mark.${HIGHLIGHT_MARK_CLASS}`)) {
          return NodeFilter.FILTER_REJECT;
        }

        if (
          parent.closest(
            "script, style, noscript, svg, path, button, input, textarea, select, option, [contenteditable='true'], [aria-hidden='true']"
          )
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let current = walker.nextNode();
    while (current) {
      nodes.push(current);
      current = walker.nextNode();
    }

    return nodes;
  }

  function highlightTextNode(textNode, matcher) {
    const text = textNode.nodeValue || "";
    const { regex, groupColors } = matcher;
    if (!regex) {
      return 0;
    }

    const matches = Array.from(text.matchAll(regex));
    if (!matches.length) {
      return 0;
    }

    const fragment = document.createDocumentFragment();
    let cursor = 0;
    let count = 0;

    for (const match of matches) {
      const index = match.index ?? 0;
      const matchedText = match[0];
      const end = index + matchedText.length;

      if (end <= cursor) {
        continue;
      }

      if (index > cursor) {
        fragment.appendChild(document.createTextNode(text.slice(cursor, index)));
      }

      let groupName = "";
      if (match.groups) {
        for (const [name, value] of Object.entries(match.groups)) {
          if (value !== undefined) {
            groupName = name;
            break;
          }
        }
      }

      const color = normalizeHighlightColor(groupColors[groupName]);
      const palette = HIGHLIGHT_COLOR_MAP[color];
      const mark = document.createElement("mark");
      mark.className = HIGHLIGHT_MARK_CLASS;
      mark.dataset.highlightColor = color;
      mark.style.backgroundColor = palette.bg;
      mark.style.color = palette.fg;
      mark.textContent = matchedText;
      fragment.appendChild(mark);

      cursor = end;
      count += 1;
    }

    if (cursor < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(cursor)));
    }

    textNode.parentNode.replaceChild(fragment, textNode);
    return count;
  }

  function highlightKeywords(options = {}) {
    if (!isLinkedInJobsPage() || !state.highlightRules.length) {
      return 0;
    }

    const { quiet = false } = options;
    const root = findHighlightRoot();
    if (!root) {
      return 0;
    }

    ensureHighlightStyles();
    const matcher = buildHighlightMatcher(state.highlightRules);
    if (!matcher.regex) {
      return 0;
    }

    let highlighted = 0;
    for (const textNode of collectHighlightTextNodes(root)) {
      highlighted += highlightTextNode(textNode, matcher);
    }

    if (!quiet) {
      setStatus(
        highlighted > 0
          ? `Highlighted ${highlighted} JD match${highlighted === 1 ? "" : "es"}.`
          : "No keyword matches found in the JD.",
        highlighted > 0 ? "ok" : "info"
      );
    }

    return highlighted;
  }

  function ensureHost() {
    if (state.host && state.host.isConnected && state.host.shadowRoot) {
      ensureStyles(state.host.shadowRoot);
      return state.host.shadowRoot;
    }

    let host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement("div");
      host.id = HOST_ID;
      (document.body || document.documentElement).appendChild(host);
    }

    if (!host.shadowRoot) {
      host.attachShadow({ mode: "open" });
    }

    state.host = host;
    ensureStyles(host.shadowRoot);
    return host.shadowRoot;
  }

  function setStatus(message, tone = "info") {
    if (!isLinkedInJobsPage()) {
      return;
    }

    const shadowRoot = ensureHost();
    let status = state.status;
    if (!status || !status.isConnected) {
      status = shadowRoot.querySelector(`#${STATUS_ID}`);
      state.status = status;
    }

    if (status) {
      status.dataset.tone = tone;
      status.textContent = message;
    }
  }

  function getJobCards() {
    return Array.from(document.querySelectorAll("li[data-occludable-job-id]"))
      .filter((card) => card.querySelector(".job-card-container"));
  }

  function isViewedCard(card) {
    const footerState = card.querySelector(".job-card-container__footer-job-state");
    if (footerState && /\bViewed\b/i.test(footerState.textContent || "")) {
      return true;
    }

    const text = (card.textContent || "").replace(/\s+/g, " ").trim();
    return /\bViewed\b/i.test(text);
  }

  function dimCard(card) {
    const item = card.closest("li[data-occludable-job-id]") || card;
    if (!item || item.dataset.liViewedRemoverDimmed === "1") {
      return false;
    }

    item.dataset.liViewedRemoverDimmed = "1";
    item.classList.add("li-viewed-remover-dimmed");
    ensureCardStyles();

    return true;
  }

  function dimViewedJobs(options = {}) {
    if (!isLinkedInJobsPage()) {
      return 0;
    }

    const { quiet = false } = options;
    const cards = getJobCards();
    let dimmed = 0;

    for (const card of cards) {
      if (isViewedCard(card) && dimCard(card)) {
        dimmed += 1;
      }
    }

    if (!quiet) {
      setStatus(
        dimmed > 0
          ? `Dimmed ${dimmed} viewed job${dimmed === 1 ? "" : "s"}.`
          : "No viewed jobs found to dim.",
        dimmed > 0 ? "ok" : "info"
      );
    }

    return dimmed;
  }

  function composeStatusMessage(dimmed, highlighted) {
    const parts = [];

    if (state.autoEnabled || state.manualEnabled) {
      if (dimmed > 0) {
        parts.push(`Dimmed ${dimmed} viewed job${dimmed === 1 ? "" : "s"}.`);
      } else if (state.autoEnabled) {
        parts.push("Watching for viewed jobs.");
      } else {
        parts.push("Manual dimming is on. Watching for viewed jobs.");
      }
    }

    if (state.highlightRules.length > 0) {
      const ruleCount = state.highlightRules.length;
      if (highlighted > 0) {
        parts.push(
          `Highlighted ${highlighted} match${highlighted === 1 ? "" : "es"} across ${ruleCount} keyword set${ruleCount === 1 ? "" : "s"}.`
        );
      } else {
        parts.push(`Watching for ${ruleCount} keyword set${ruleCount === 1 ? "" : "s"}.`);
      }
    }

    if (!parts.length) {
      parts.push("Ready to dim viewed jobs and highlight saved keyword sets.");
    }

    return parts.join(" ");
  }

  function refreshActiveFeatures(options = {}) {
    if (!isLinkedInJobsPage()) {
      return { dimmed: 0, highlighted: 0 };
    }

    const { quiet = false, resetHighlights = false } = options;

    if (resetHighlights) {
      clearKeywordHighlights(document);
    }

    const dimmed = state.autoEnabled || state.manualEnabled ? dimViewedJobs({ quiet: true }) : 0;
    const highlighted = state.highlightRules.length ? highlightKeywords({ quiet: true }) : 0;

    if (!quiet) {
      setStatus(
        composeStatusMessage(dimmed, highlighted),
        dimmed > 0 || highlighted > 0 ? "ok" : "info"
      );
    }

    return { dimmed, highlighted };
  }

  function scheduleRefresh() {
    if (!hasActiveMode() || state.refreshQueued) {
      return;
    }

    state.refreshQueued = true;
    queueMicrotask(() => {
      state.refreshQueued = false;
      if (hasActiveMode()) {
        refreshActiveFeatures({ quiet: true });
      }
    });
  }

  function startObserver() {
    if (!hasActiveMode()) {
      if (state.observer) {
        state.observer.disconnect();
        state.observer = null;
      }
      return;
    }

    if (state.observer) {
      return;
    }

    const target = document.body || document.documentElement;
    if (!target) {
      return;
    }

    state.observer = new MutationObserver(() => {
      if (hasActiveMode()) {
        scheduleRefresh();
      }
    });

    state.observer.observe(target, {
      childList: true,
      subtree: true
    });
  }

  function activateCleanup() {
    state.manualEnabled = true;
    setObserverActive(hasActiveMode());

    const { dimmed } = refreshActiveFeatures({ quiet: false });
    return dimmed;
  }

  function applyAlwaysOnSetting(alwaysOn, options = {}) {
    state.autoEnabled = Boolean(alwaysOn);
    setObserverActive(hasActiveMode());

    if (!isLinkedInJobsPage()) {
      return;
    }

    if (options.announce === false) {
      return;
    }

    refreshActiveFeatures({ quiet: false });
  }

  function applyHighlightRules(rawRules, options = {}) {
    const nextRules = normalizeHighlightRules(rawRules);
    const nextSignature = buildHighlightSignature(nextRules);
    const rulesChanged = nextSignature !== state.highlightSignature;

    state.highlightRules = nextRules;
    state.highlightSignature = nextSignature;
    setObserverActive(hasActiveMode());

    if (!isLinkedInJobsPage()) {
      return {
        dimmed: 0,
        highlighted: 0,
        ruleCount: nextRules.length,
        changed: rulesChanged
      };
    }

    const { quiet = false } = options;
    const result = refreshActiveFeatures({
      quiet,
      resetHighlights: rulesChanged || nextRules.length === 0 || options.resetExistingHighlights === true
    });

    return {
      ...result,
      ruleCount: nextRules.length,
      changed: rulesChanged
    };
  }

  async function initializeSettings() {
    try {
      const [alwaysOn, rawRules] = await Promise.all([
        readAlwaysOnSetting(),
        readHighlightRulesSetting()
      ]);

      state.autoEnabled = Boolean(alwaysOn);
      state.highlightRules = normalizeHighlightRules(rawRules);
      state.highlightSignature = buildHighlightSignature(state.highlightRules);
      setObserverActive(hasActiveMode());

      if (isLinkedInJobsPage()) {
        refreshActiveFeatures({ quiet: false, resetHighlights: true });
      }
    } catch (error) {
      console.error("LinkedIn dimmer failed to read settings:", error);
    }
  }

  function attachStorageListener() {
    if (state.storageListenerAttached) {
      return;
    }

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "local") {
          return;
        }

        let shouldRefresh = false;
        let resetHighlights = false;

        if (changes[STORAGE_KEY]) {
          state.autoEnabled = Boolean(changes[STORAGE_KEY].newValue);
          shouldRefresh = true;
        }

        if (changes[HIGHLIGHT_STORAGE_KEY]) {
          state.highlightRules = normalizeHighlightRules(changes[HIGHLIGHT_STORAGE_KEY].newValue);
          state.highlightSignature = buildHighlightSignature(state.highlightRules);
          shouldRefresh = true;
          resetHighlights = true;
        }

        if (!shouldRefresh) {
          return;
        }

        setObserverActive(hasActiveMode());
        if (isLinkedInJobsPage()) {
          refreshActiveFeatures({
            quiet: false,
            resetHighlights
          });
        }
      });
    }

    state.storageListenerAttached = true;
  }

  function ensurePanel() {
    const shadowRoot = ensureHost();

    let panel = shadowRoot.querySelector(".panel");
    if (panel) {
      const title = panel.querySelector(".title");
      const copy = panel.querySelector(".copy");
      const button = panel.querySelector(`#${BUTTON_ID}`);
      const status = panel.querySelector(`#${STATUS_ID}`);

      if (title) {
        title.textContent = "LinkedIn Viewed Job Dimmer";
      }

      if (copy) {
        copy.textContent = "Keeps viewed cards in place, then highlights saved keyword sets in the main JD.";
      }

      if (button) {
        button.textContent = "Dim viewed jobs";
      }

      if (status) {
        status.textContent = "Ready to dim viewed jobs and highlight saved keyword sets.";
      }

      state.button = button || state.button;
      state.status = status || state.status;
      return panel;
    }

    panel = document.createElement("div");
    panel.className = "panel";

    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "LinkedIn Viewed Job Dimmer";

    const title = document.createElement("p");
    title.className = "title";
    title.textContent = "Dim viewed jobs";

    const copy = document.createElement("p");
    copy.className = "copy";
    copy.textContent = "Keeps viewed cards in place, then highlights saved keyword sets in the main JD.";

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.className = "button";
    button.textContent = "Dim viewed jobs";
    button.addEventListener("click", () => {
      activateCleanup();
    });

    const status = document.createElement("div");
    status.id = STATUS_ID;
    status.className = "status";
    status.dataset.tone = "info";
    status.textContent = "Ready to dim viewed jobs and highlight saved keyword sets.";

    panel.append(eyebrow, title, copy, button, status);
    shadowRoot.appendChild(panel);

    state.button = button;
    state.status = status;

    return panel;
  }

  function bootstrap() {
    if (!isLinkedInJobsPage()) {
      return;
    }

    state.bootstrapped = true;
    ensurePanel();
    attachStorageListener();
    initializeSettings();
  }

  window.__liViewedRemoverRunCleanup = activateCleanup;
  window.__liViewedRemoverRunDimming = activateCleanup;
  window.__liViewedRemoverCleanOnce = dimViewedJobs;
  window.__liViewedRemoverHighlightOnce = highlightKeywords;
  window.__liViewedRemoverRefreshHighlights = () => refreshActiveFeatures({ quiet: false }).highlighted;
  window.__liViewedRemoverApplyHighlightRules = (rules) => applyHighlightRules(rules, { quiet: false }).highlighted;

  if (isLinkedInJobsPage()) {
    bootstrap();
  }

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage && !state.messageListenerAttached) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || typeof message.type !== "string") {
        return;
      }

      if (message.type === "li-viewed-remover:dim" || message.type === "li-viewed-remover:clean") {
        const dimmed = activateCleanup();
        sendResponse({ ok: true, dimmed });
        return;
      }

      if (message.type === "li-viewed-remover:get-mode") {
        Promise.resolve(readAlwaysOnSetting()).then((alwaysOn) => {
          sendResponse({
            ok: true,
            alwaysOn
          });
        });
        return true;
      }

      if (message.type === "li-viewed-remover:set-mode") {
        const alwaysOn = Boolean(message.alwaysOn);
        Promise.resolve(writeAlwaysOnSetting(alwaysOn))
          .then(() => {
            applyAlwaysOnSetting(alwaysOn, { announce: true });
            sendResponse({
              ok: true,
              alwaysOn: state.autoEnabled
            });
          });
        return true;
      }

      if (message.type === "li-viewed-remover:get-highlight-rules") {
        sendResponse({
          ok: true,
          rules: state.highlightRules,
          ruleCount: state.highlightRules.length
        });
        return;
      }

      if (message.type === "li-viewed-remover:set-highlight-rules") {
        Promise.resolve(writeHighlightRulesSetting(message.rules || []))
          .then(() => {
            const result = applyHighlightRules(message.rules || [], {
              quiet: false,
              resetExistingHighlights: true
            });
            sendResponse({
              ok: true,
              highlighted: result.highlighted,
              ruleCount: result.ruleCount
            });
          });
        return true;
      }

      if (message.type === "li-viewed-remover:refresh-highlights") {
        const result = refreshActiveFeatures({ quiet: false });
        sendResponse({
          ok: true,
          dimmed: result.dimmed,
          highlighted: result.highlighted,
          ruleCount: state.highlightRules.length
        });
        return;
      }

      if (message.type === "li-viewed-remover:status") {
        sendResponse({
          ok: true,
          autoEnabled: state.autoEnabled,
          manualEnabled: state.manualEnabled,
          bootstrapped: state.bootstrapped,
          highlightRuleCount: state.highlightRules.length
        });
      }
    });

    state.messageListenerAttached = true;
  }
})();
