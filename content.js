(() => {
  const GLOBAL_KEY = "__liViewedRemoverState";
  const HOST_ID = "li-viewed-remover-host";
  const STYLE_ID = "li-viewed-remover-style";
  const BUTTON_ID = "li-viewed-remover-button";
  const STATUS_ID = "li-viewed-remover-status";

  const state = window[GLOBAL_KEY] || (window[GLOBAL_KEY] = {
    bootstrapped: false,
    enabled: false,
    cleanupQueued: false,
    observer: null,
    host: null,
    button: null,
    status: null,
    messageListenerAttached: false
  });

  function isLinkedInJobsPage() {
    return location.hostname === "www.linkedin.com" && /^\/jobs\//.test(location.pathname);
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

      .card-leaving {
        opacity: 0 !important;
        transform: translateX(-10px) scale(0.985);
        transition: opacity 180ms ease, transform 180ms ease;
      }
    `;
    shadowRoot.appendChild(style);
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

  function removeCard(card) {
    const item = card.closest("li[data-occludable-job-id]") || card;
    if (!item || item.dataset.liViewedRemoverRemoved === "1") {
      return false;
    }

    item.dataset.liViewedRemoverRemoved = "1";
    item.classList.add("card-leaving");

    window.setTimeout(() => {
      if (item.isConnected) {
        item.remove();
      }
    }, 180);

    return true;
  }

  function cleanViewedJobs(options = {}) {
    if (!isLinkedInJobsPage()) {
      return 0;
    }

    const { quiet = false } = options;
    const cards = getJobCards();
    let removed = 0;

    for (const card of cards) {
      if (isViewedCard(card) && removeCard(card)) {
        removed += 1;
      }
    }

    if (!quiet) {
      setStatus(
        removed > 0
          ? `Removed ${removed} viewed job${removed === 1 ? "" : "s"}.`
          : "No viewed jobs found.",
        removed > 0 ? "ok" : "info"
      );
    }

    return removed;
  }

  function scheduleCleanup() {
    if (!state.enabled || state.cleanupQueued) {
      return;
    }

    state.cleanupQueued = true;
    queueMicrotask(() => {
      state.cleanupQueued = false;
      if (state.enabled) {
        cleanViewedJobs({ quiet: true });
      }
    });
  }

  function startObserver() {
    if (state.observer) {
      return;
    }

    const target = document.body || document.documentElement;
    if (!target) {
      return;
    }

    state.observer = new MutationObserver(() => {
      if (state.enabled) {
        scheduleCleanup();
      }
    });

    state.observer.observe(target, {
      childList: true,
      subtree: true
    });
  }

  function activateCleanup() {
    state.enabled = true;
    startObserver();

    const removed = cleanViewedJobs({ quiet: true });
    setStatus(
      removed > 0
        ? `Removed ${removed} viewed job${removed === 1 ? "" : "s"}. Watching for more.`
        : "No viewed jobs found. Watching for more.",
      removed > 0 ? "ok" : "info"
    );

    return removed;
  }

  function ensurePanel() {
    const shadowRoot = ensureHost();

    let panel = shadowRoot.querySelector(".panel");
    if (panel) {
      return panel;
    }

    panel = document.createElement("div");
    panel.className = "panel";

    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "LinkedIn jobs";

    const title = document.createElement("p");
    title.className = "title";
    title.textContent = "Remove viewed jobs";

    const copy = document.createElement("p");
    copy.className = "copy";
    copy.textContent = "Runs on the open search page and keeps removing cards marked Viewed as new results load.";

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.className = "button";
    button.textContent = "Clean viewed jobs";
    button.addEventListener("click", () => {
      activateCleanup();
    });

    const status = document.createElement("div");
    status.id = STATUS_ID;
    status.className = "status";
    status.dataset.tone = "info";
    status.textContent = "Ready to clean the current LinkedIn results list.";

    panel.append(eyebrow, title, copy, button, status);
    shadowRoot.appendChild(panel);

    state.button = button;
    state.status = status;

    return panel;
  }

  function bootstrap() {
    if (state.bootstrapped || !isLinkedInJobsPage()) {
      return;
    }

    state.bootstrapped = true;
    ensurePanel();
  }

  window.__liViewedRemoverRunCleanup = activateCleanup;
  window.__liViewedRemoverCleanOnce = cleanViewedJobs;

  if (isLinkedInJobsPage()) {
    bootstrap();
  }

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage && !state.messageListenerAttached) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || typeof message.type !== "string") {
        return;
      }

      if (message.type === "li-viewed-remover:clean") {
        const removed = activateCleanup();
        sendResponse({ ok: true, removed });
      }

      if (message.type === "li-viewed-remover:status") {
        sendResponse({
          ok: true,
          enabled: state.enabled,
          bootstrapped: state.bootstrapped
        });
      }
    });

    state.messageListenerAttached = true;
  }
})();
