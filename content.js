(() => {
  const GLOBAL_KEY = "__liViewedRemoverState";
  const HOST_ID = "li-viewed-remover-host";
  const STYLE_ID = "li-viewed-remover-style";
  const CARD_STYLE_ID = "li-viewed-remover-card-style";
  const STORAGE_KEY = "liViewedRemoverAlwaysOn";
  const BUTTON_ID = "li-viewed-remover-button";
  const STATUS_ID = "li-viewed-remover-status";

  const state = window[GLOBAL_KEY] || (window[GLOBAL_KEY] = {
    bootstrapped: false,
    autoEnabled: false,
    manualEnabled: false,
    cleanupQueued: false,
    observer: null,
    host: null,
    button: null,
    status: null,
    pageStorageListenerAttached: false,
    messageListenerAttached: false
  });

  function isLinkedInJobsPage() {
    const host = location.hostname;
    const isLinkedInHost = host === "linkedin.com" || host === "www.linkedin.com" || host.endsWith(".linkedin.com");
    return isLinkedInHost && /^\/jobs\//.test(location.pathname);
  }

  function hasActiveMode() {
    return state.autoEnabled || state.manualEnabled;
  }

  function readAlwaysOnSetting() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch (_error) {
      return false;
    }
  }

  function writeAlwaysOnSetting(alwaysOn) {
    try {
      window.localStorage.setItem(STORAGE_KEY, alwaysOn ? "1" : "0");
    } catch (_error) {
      // Ignore storage failures; the page still gets updated for this session.
    }
  }

  function setObserverActive(active) {
    if (!active) {
      if (state.observer) {
        state.observer.disconnect();
        state.observer = null;
      }
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

  function scheduleCleanup() {
    if (!hasActiveMode() || state.cleanupQueued) {
      return;
    }

    state.cleanupQueued = true;
    queueMicrotask(() => {
      state.cleanupQueued = false;
      if (hasActiveMode()) {
        dimViewedJobs({ quiet: true });
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
        scheduleCleanup();
      }
    });

    state.observer.observe(target, {
      childList: true,
      subtree: true
    });
  }

  function activateCleanup() {
    state.manualEnabled = true;
    startObserver();

    const dimmed = dimViewedJobs({ quiet: true });
    setStatus(
      dimmed > 0
        ? `Dimmed ${dimmed} viewed job${dimmed === 1 ? "" : "s"}. Watching for more.`
        : "No viewed jobs found to dim. Watching for more.",
      dimmed > 0 ? "ok" : "info"
    );

    return dimmed;
  }

  function applyAlwaysOnSetting(alwaysOn, options = {}) {
    state.autoEnabled = Boolean(alwaysOn);
    if (readAlwaysOnSetting() !== state.autoEnabled) {
      writeAlwaysOnSetting(state.autoEnabled);
    }
    setObserverActive(hasActiveMode());

    if (!isLinkedInJobsPage()) {
      return;
    }

    const { announce = true } = options;
    if (!announce) {
      return;
    }

    if (state.autoEnabled) {
      const dimmed = dimViewedJobs({ quiet: true });
      setStatus(
        dimmed > 0
          ? `Always run is on. Dimmed ${dimmed} viewed job${dimmed === 1 ? "" : "s"}.`
          : "Always run is on. Watching for more viewed jobs.",
        dimmed > 0 ? "ok" : "info"
      );
      return;
    }

    if (!state.manualEnabled) {
      setStatus(
        "Only when selected is on. Use the button to dim viewed jobs on this page.",
        "info"
      );
    }
  }

  async function initializeAlwaysOnSetting() {
    try {
      applyAlwaysOnSetting(readAlwaysOnSetting(), { announce: true });
    } catch (error) {
      console.error("LinkedIn dimmer failed to read settings:", error);
    }
  }

  function attachPageStorageListener() {
    if (state.pageStorageListenerAttached) {
      return;
    }

    window.addEventListener("storage", (event) => {
      if (event.storageArea !== window.localStorage || event.key !== STORAGE_KEY) {
        return;
      }

      applyAlwaysOnSetting(event.newValue === "1", { announce: true });
    });

    state.pageStorageListenerAttached = true;
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
        title.textContent = "Dim viewed jobs";
      }

      if (copy) {
        copy.textContent = "Runs on the open search page and keeps viewed cards in place while muting them to dark gray as new results load.";
      }

      if (button) {
        button.textContent = "Dim viewed jobs";
      }

      if (status) {
        status.textContent = "Ready to dim the current LinkedIn results list.";
      }

      state.button = button || state.button;
      state.status = status || state.status;
      return panel;
    }

    panel = document.createElement("div");
    panel.className = "panel";

    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "LinkedIn jobs";

    const title = document.createElement("p");
    title.className = "title";
    title.textContent = "Dim viewed jobs";

    const copy = document.createElement("p");
    copy.className = "copy";
    copy.textContent = "Runs on the open search page and keeps viewed cards in place while muting them to dark gray as new results load.";

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
    status.textContent = "Ready to dim the current LinkedIn results list.";

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
    attachPageStorageListener();
    initializeAlwaysOnSetting();
  }

  window.__liViewedRemoverGetAlwaysOn = () => readAlwaysOnSetting();
  window.__liViewedRemoverSetAlwaysOn = (alwaysOn) => {
    applyAlwaysOnSetting(Boolean(alwaysOn), { announce: true });
    return state.autoEnabled;
  };
  window.__liViewedRemoverRunCleanup = activateCleanup;
  window.__liViewedRemoverRunDimming = activateCleanup;
  window.__liViewedRemoverCleanOnce = dimViewedJobs;

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
        sendResponse({
          ok: true,
          alwaysOn: readAlwaysOnSetting()
        });
        return;
      }

      if (message.type === "li-viewed-remover:set-mode") {
        const alwaysOn = Boolean(message.alwaysOn);
        const result = window.__liViewedRemoverSetAlwaysOn(alwaysOn);
        sendResponse({
          ok: true,
          alwaysOn: result
        });
        return;
      }

      if (message.type === "li-viewed-remover:status") {
        sendResponse({
          ok: true,
          autoEnabled: state.autoEnabled,
          manualEnabled: state.manualEnabled,
          bootstrapped: state.bootstrapped
        });
      }
    });

    state.messageListenerAttached = true;
  }
})();
