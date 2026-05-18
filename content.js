(() => {
  const GLOBAL_KEY = "__liViewedRemoverState";
  const HOST_ID = "li-viewed-remover-host";
  const STYLE_ID = "li-viewed-remover-style";
  const BADGE_STYLE_ID = "li-viewed-remover-badge-style";
  const BUTTON_ID = "li-viewed-remover-button";
  const LANGUAGE_BUTTON_ID = "li-viewed-remover-language-button";
  const STATUS_ID = "li-viewed-remover-status";

  const state = window[GLOBAL_KEY] || (window[GLOBAL_KEY] = {
    bootstrapped: false,
    cleanupEnabled: false,
    languageEnabled: false,
    cleanupQueued: false,
    languageQueued: false,
    languageProcessing: false,
    languageRescanRequested: false,
    observer: null,
    host: null,
    button: null,
    status: null,
    languageButton: null,
    languageCache: new Map(),
    messageListenerAttached: false
  });

  function isLinkedInJobsPage() {
    return location.hostname === "www.linkedin.com" && /^\/jobs\//.test(location.pathname);
  }

  const LANGUAGE_PROFILES = [
    {
      code: "en",
      name: "English",
      flag: "🇬🇧",
      words: [
        "the",
        "and",
        "for",
        "with",
        "you",
        "your",
        "our",
        "this",
        "that",
        "from",
        "will",
        "have",
        "not",
        "are",
        "be",
        "as",
        "or",
        "on",
        "at",
        "we"
      ]
    },
    {
      code: "nl",
      name: "Dutch",
      flag: "🇳🇱",
      words: [
        "de",
        "het",
        "een",
        "en",
        "van",
        "voor",
        "met",
        "je",
        "jij",
        "wij",
        "we",
        "ons",
        "jouw",
        "niet",
        "zijn",
        "als",
        "dat",
        "dit",
        "op",
        "te",
        "aan"
      ]
    },
    {
      code: "de",
      name: "German",
      flag: "🇩🇪",
      words: [
        "der",
        "die",
        "das",
        "und",
        "nicht",
        "mit",
        "fur",
        "wir",
        "sie",
        "ein",
        "eine",
        "als",
        "auf",
        "im",
        "ist",
        "von",
        "zu",
        "den",
        "dem"
      ],
      bonusChars: "äöüß"
    },
    {
      code: "fr",
      name: "French",
      flag: "🇫🇷",
      words: [
        "le",
        "la",
        "les",
        "des",
        "pour",
        "avec",
        "vous",
        "nous",
        "une",
        "dans",
        "que",
        "qui",
        "est",
        "pas",
        "sur",
        "du",
        "au",
        "aux",
        "un",
        "ce"
      ],
      bonusChars: "àâçéèêëîïôùûüœ"
    },
    {
      code: "es",
      name: "Spanish",
      flag: "🇪🇸",
      words: [
        "el",
        "la",
        "los",
        "las",
        "para",
        "con",
        "una",
        "que",
        "del",
        "por",
        "como",
        "no",
        "est",
        "sus",
        "al",
        "en",
        "y",
        "se"
      ],
      bonusChars: "áéíóúñü¡¿"
    },
    {
      code: "it",
      name: "Italian",
      flag: "🇮🇹",
      words: [
        "il",
        "lo",
        "la",
        "le",
        "gli",
        "per",
        "con",
        "una",
        "che",
        "del",
        "non",
        "nei",
        "nel",
        "della",
        "delle",
        "sono",
        "come",
        "in",
        "da"
      ],
      bonusChars: "àèéìíîòóù"
    },
    {
      code: "pt",
      name: "Portuguese",
      flag: "🇵🇹",
      words: [
        "para",
        "com",
        "uma",
        "que",
        "dos",
        "das",
        "nao",
        "por",
        "como",
        "nos",
        "nas",
        "em",
        "e",
        "um",
        "a",
        "os",
        "as"
      ],
      bonusChars: "ãõçáéíóúâêô"
    },
    {
      code: "sv",
      name: "Swedish",
      flag: "🇸🇪",
      words: ["och", "det", "att", "som", "for", "inte", "med", "du", "vi", "var", "den", "ett"],
      bonusChars: "åäö"
    },
    {
      code: "da",
      name: "Danish",
      flag: "🇩🇰",
      words: ["og", "det", "der", "som", "for", "ikke", "med", "du", "vi", "den", "et", "til"],
      bonusChars: "åæø"
    },
    {
      code: "no",
      name: "Norwegian",
      flag: "🇳🇴",
      words: ["og", "det", "som", "for", "ikke", "med", "du", "vi", "den", "et", "til", "en"],
      bonusChars: "åæø"
    },
    {
      code: "fi",
      name: "Finnish",
      flag: "🇫🇮",
      words: ["ja", "etta", "on", "ei", "kun", "me", "te", "he", "se", "niin", "kuin", "mutta"],
      bonusChars: "äö"
    },
    {
      code: "pl",
      name: "Polish",
      flag: "🇵🇱",
      words: ["i", "w", "na", "z", "nie", "jest", "do", "dla", "oraz", "jak", "to", "sie", "przy"],
      bonusChars: "ąćęłńóśźż"
    },
    {
      code: "tr",
      name: "Turkish",
      flag: "🇹🇷",
      words: ["ve", "bir", "icin", "ile", "bu", "da", "de", "mi", "gibi", "olan", "olarak", "siz", "biz"],
      bonusChars: "çğıöşü"
    },
    {
      code: "cs",
      name: "Czech",
      flag: "🇨🇿",
      words: ["a", "v", "na", "se", "je", "do", "z", "pro", "ne", "ktery", "jsme", "si"],
      bonusChars: "áčďéěíňóřšťúůýž"
    },
    {
      code: "ro",
      name: "Romanian",
      flag: "🇷🇴",
      words: ["si", "in", "de", "cu", "pentru", "este", "nu", "ca", "la", "un", "o", "pe"],
      bonusChars: "ăâîșț"
    }
  ];

  function ensureLanguageBadgeStyles() {
    const existing = document.getElementById(BADGE_STYLE_ID);
    if (existing) {
      existing.textContent = `
      .li-language-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-inline-start: 8px;
        padding: 2px 6px;
        border-radius: 999px;
        background: rgba(10, 102, 194, 0.1);
        border: 1px solid rgba(10, 102, 194, 0.16);
        color: #0a66c2;
        font-size: 12px;
        line-height: 1;
        vertical-align: middle;
        pointer-events: none;
        user-select: none;
        white-space: nowrap;
      }

      .li-language-badge[data-language="unknown"] {
        background: rgba(89, 102, 122, 0.1);
        border-color: rgba(89, 102, 122, 0.16);
        color: #59667a;
      }

      .li-language-badge[data-confidence="low"] {
        opacity: 0.68;
      }
    `;
      return;
    }

    const style = document.createElement("style");
    style.id = BADGE_STYLE_ID;
    style.textContent = `
      .li-language-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-inline-start: 8px;
        padding: 2px 6px;
        border-radius: 999px;
        background: rgba(10, 102, 194, 0.1);
        border: 1px solid rgba(10, 102, 194, 0.16);
        color: #0a66c2;
        font-size: 12px;
        line-height: 1;
        vertical-align: middle;
        pointer-events: none;
        user-select: none;
        white-space: nowrap;
      }

      .li-language-badge[data-language="unknown"] {
        background: rgba(89, 102, 122, 0.1);
        border-color: rgba(89, 102, 122, 0.16);
        color: #59667a;
      }

      .li-language-badge[data-confidence="low"] {
        opacity: 0.68;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function normalizeLanguageText(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function tokenizeLanguageText(text) {
    return normalizeLanguageText(text).match(/[a-z]{2,}/g) || [];
  }

  function countTokens(tokens) {
    const counts = new Map();
    for (const token of tokens) {
      counts.set(token, (counts.get(token) || 0) + 1);
    }
    return counts;
  }

  function getUnknownLanguage() {
    return {
      code: "unknown",
      name: "Language unclear",
      flag: "🌐",
      confidence: "unknown",
      score: 0
    };
  }

  function detectScriptLanguage(text) {
    if (/[ぁ-んァ-ヿ]/.test(text)) {
      return { code: "ja", name: "Japanese", flag: "🇯🇵", confidence: "high", score: 10 };
    }

    if (/[가-힣]/.test(text)) {
      return { code: "ko", name: "Korean", flag: "🇰🇷", confidence: "high", score: 10 };
    }

    if (/[一-鿿]/.test(text)) {
      return { code: "zh", name: "Chinese", flag: "🇨🇳", confidence: "high", score: 10 };
    }

    if (/[Ѐ-ӿ]/.test(text)) {
      if (/[іїєґІЇЄҐ]/.test(text)) {
        return { code: "uk", name: "Ukrainian", flag: "🇺🇦", confidence: "high", score: 10 };
      }

      if (/[ёЁыЫэЭ]/.test(text)) {
        return { code: "ru", name: "Russian", flag: "🇷🇺", confidence: "high", score: 10 };
      }

      return { code: "ru", name: "Russian", flag: "🇷🇺", confidence: "medium", score: 8 };
    }

    if (/[؀-ۿ]/.test(text)) {
      return { code: "ar", name: "Arabic", flag: "🇸🇦", confidence: "high", score: 10 };
    }

    if (/[א-ת]/.test(text)) {
      return { code: "he", name: "Hebrew", flag: "🇮🇱", confidence: "high", score: 10 };
    }

    if (/[अ-ह]/.test(text)) {
      return { code: "hi", name: "Hindi", flag: "🇮🇳", confidence: "high", score: 10 };
    }

    if (/[ก-๙]/.test(text)) {
      return { code: "th", name: "Thai", flag: "🇹🇭", confidence: "high", score: 10 };
    }

    if (/[α-ωΑ-Ω]/.test(text)) {
      return { code: "el", name: "Greek", flag: "🇬🇷", confidence: "high", score: 10 };
    }

    return null;
  }

  function scoreLanguageProfile(profile, counts, rawText) {
    let score = 0;
    for (const word of profile.words) {
      const count = counts.get(word);
      if (count) {
        score += count * (word.length <= 3 ? 0.4 : 1);
      }
    }

    if (profile.bonusChars) {
      for (const char of profile.bonusChars) {
        if (rawText.includes(char)) {
          score += 0.55;
        }
      }
    }

    return score;
  }

  function detectLanguageFromText(text) {
    const rawText = String(text || "").trim();
    if (!rawText) {
      return getUnknownLanguage();
    }

    const scriptLanguage = detectScriptLanguage(rawText);
    if (scriptLanguage) {
      return scriptLanguage;
    }

    const tokens = tokenizeLanguageText(rawText);
    if (!tokens.length) {
      return getUnknownLanguage();
    }

    const counts = countTokens(tokens);
    const scored = LANGUAGE_PROFILES.map((profile) => ({
      profile,
      score: scoreLanguageProfile(profile, counts, rawText)
    })).sort((left, right) => right.score - left.score);

    const best = scored[0];
    const second = scored[1];
    if (!best || best.score < 1.5) {
      return getUnknownLanguage();
    }

    const confidence = best.score >= 4 && (!second || best.score - second.score >= 1)
      ? "high"
      : "low";

    return {
      code: best.profile.code,
      name: best.profile.name,
      flag: best.profile.flag,
      confidence,
      score: best.score
    };
  }

  function getJobCardJobId(card) {
    return (
      card?.getAttribute("data-occludable-job-id") ||
      card?.dataset?.occludableJobId ||
      card?.querySelector("[data-job-id]")?.getAttribute("data-job-id") ||
      ""
    );
  }

  function getJobCardHref(card) {
    const anchor = getJobCardTitleAnchor(card);
    const href = anchor?.getAttribute("href") || anchor?.href || "";
    if (!href) {
      return "";
    }

    try {
      return new URL(href, location.href).toString();
    } catch (_error) {
      return href;
    }
  }

  function getJobCardTitleAnchor(card) {
    if (!card) {
      return null;
    }

    return (
      card.querySelector(".job-card-list__entity-lockup__title a[href*='/jobs/view/']") ||
      card.querySelector(".artdeco-entity-lockup__title a[href*='/jobs/view/']") ||
      card.querySelector("a.job-card-container__link[href*='/jobs/view/']") ||
      card.querySelector("a.job-card-list__title--link[href*='/jobs/view/']") ||
      card.querySelector("a[href*='/jobs/view/']")
    );
  }

  function getCurrentDetailTitleAnchor() {
    return document.querySelector(".job-details-jobs-unified-top-card__job-title a[href*='/jobs/view/']");
  }

  function getCurrentDetailJobId() {
    const anchor = getCurrentDetailTitleAnchor();
    return anchor ? getJobIdFromUrl(anchor.getAttribute("href") || anchor.href || "") : "";
  }

  function getJobIdFromUrl(url) {
    const match = String(url || "").match(/\/jobs\/view\/(\d+)/);
    return match ? match[1] : "";
  }

  function collectBlockText(root, maxBlocks = 8) {
    if (!root) {
      return "";
    }

    const blocks = [];
    const candidates = root.querySelectorAll("p, li");
    for (const node of candidates) {
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) {
        continue;
      }

      blocks.push(text);
      if (blocks.length >= maxBlocks) {
        break;
      }
    }

    if (blocks.length) {
      return blocks.join("\n");
    }

    return (root.textContent || "").replace(/\s+/g, " ").trim().slice(0, 1200);
  }

  function extractSampleFromDocument(doc) {
    const roots = [
      doc.querySelector("#job-details .mt4"),
      doc.querySelector("#job-details"),
      doc.querySelector(".jobs-description__content"),
      doc.querySelector("article.jobs-description__container"),
      doc.querySelector(".jobs-description")
    ].filter(Boolean);

    for (const root of roots) {
      const sample = collectBlockText(root);
      if (sample) {
        return sample;
      }
    }

    return "";
  }

  function extractSampleFromCard(card) {
    if (!card) {
      return "";
    }

    const text = (card.textContent || "").replace(/\s+/g, " ").trim();
    return text.slice(0, 800);
  }

  async function fetchJobPageSample(url) {
    const response = await fetch(url, {
      credentials: "include"
    });

    if (!response.ok) {
      throw new Error(`LinkedIn returned ${response.status} while fetching a job page.`);
    }

    const html = await response.text();
    const parsed = new DOMParser().parseFromString(html, "text/html");
    return extractSampleFromDocument(parsed);
  }

  function getLanguageBadgeTargetAnchors(card, jobId) {
    const anchors = [];
    const cardAnchor = getJobCardTitleAnchor(card);
    if (cardAnchor) {
      anchors.push(cardAnchor);
    }

    const detailAnchor = getCurrentDetailTitleAnchor();
    if (detailAnchor && (!jobId || getJobIdFromUrl(detailAnchor.getAttribute("href") || detailAnchor.href || "") === jobId)) {
      anchors.push(detailAnchor);
    }

    return Array.from(new Set(anchors));
  }

  function upsertLanguageBadge(anchor, detection, jobId) {
    if (!anchor) {
      return false;
    }

    let badge = anchor.querySelector(".li-language-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "li-language-badge";
      badge.setAttribute("aria-hidden", "true");
      anchor.appendChild(badge);
    }

    badge.dataset.language = detection.code;
    badge.dataset.confidence = detection.confidence || "medium";
    badge.dataset.jobId = jobId || "";
    badge.textContent = detection.flag || "🌐";
    badge.title = detection.name || "Language";

    return true;
  }

  async function detectLanguageForCard(card) {
    const jobId = getJobCardJobId(card);
    const cacheKey = jobId || getJobCardHref(card) || card;

    if (cacheKey && state.languageCache.has(cacheKey)) {
      return state.languageCache.get(cacheKey);
    }

    let sample = "";
    const currentDetailJobId = getCurrentDetailJobId();
    if (jobId && currentDetailJobId && jobId === currentDetailJobId) {
      sample = extractSampleFromDocument(document);
    }

    if (!sample) {
      const jobUrl = getJobCardHref(card);
      if (jobUrl) {
        try {
          sample = await fetchJobPageSample(jobUrl);
        } catch (_error) {
          sample = extractSampleFromCard(card);
        }
      } else {
        sample = extractSampleFromCard(card);
      }
    }

    const detection = detectLanguageFromText(sample);
    const enriched = {
      ...detection,
      sample: sample.slice(0, 240)
    };

    if (cacheKey) {
      state.languageCache.set(cacheKey, enriched);
    }

    return enriched;
  }

  async function scanVisibleJobLanguages(options = {}) {
    if (!isLinkedInJobsPage()) {
      return { scanned: 0, marked: 0 };
    }

    ensureLanguageBadgeStyles();

    const { quiet = false } = options;
    const cards = getJobCards();
    const jobCards = cards.filter((card) => getJobCardTitleAnchor(card));

    if (!jobCards.length) {
      if (!quiet) {
        setStatus("No job cards found to label.", "info");
      }
      return { scanned: 0, marked: 0 };
    }

    if (!quiet) {
      setStatus(`Scanning ${jobCards.length} job${jobCards.length === 1 ? "" : "s"} for language...`, "info");
    }

    const batchSize = 3;
    let marked = 0;

    for (let index = 0; index < jobCards.length; index += batchSize) {
      const batch = jobCards.slice(index, index + batchSize);
      const results = await Promise.all(batch.map(async (card) => {
        const detection = await detectLanguageForCard(card);
        const anchors = getLanguageBadgeTargetAnchors(card, getJobCardJobId(card));
        let updated = false;
        for (const anchor of anchors) {
          updated = upsertLanguageBadge(anchor, detection, getJobCardJobId(card)) || updated;
        }
        return { detection, updated };
      }));

      for (const result of results) {
        if (result.updated) {
          marked += 1;
        }
      }
    }

    if (!quiet) {
      setStatus(
        marked > 0
          ? `Added language markers to ${marked} job${marked === 1 ? "" : "s"}.`
          : "No language markers were added.",
        marked > 0 ? "ok" : "info"
      );
    }

    return { scanned: jobCards.length, marked };
  }

  function scheduleLanguageScan() {
    if (!state.languageEnabled) {
      return;
    }

    if (state.languageProcessing) {
      state.languageRescanRequested = true;
      return;
    }

    if (state.languageQueued) {
      return;
    }

    state.languageQueued = true;
    queueMicrotask(() => {
      state.languageQueued = false;
      if (!state.languageEnabled || state.languageProcessing) {
        return;
      }

      state.languageProcessing = true;
      (async () => {
        try {
          await scanVisibleJobLanguages({ quiet: true });
        } catch (error) {
          console.error("LinkedIn language scan failed:", error);
        } finally {
          state.languageProcessing = false;
          if (state.languageRescanRequested) {
            state.languageRescanRequested = false;
            scheduleLanguageScan();
          }
        }
      })();
    });
  }

  async function activateLanguageDetection() {
    state.languageEnabled = true;
    startObserver();
    try {
      const result = await scanVisibleJobLanguages({ quiet: true });
      setStatus(
        result.marked > 0
          ? `Added language markers to ${result.marked} job${result.marked === 1 ? "" : "s"}. Watching for more.`
          : "No language markers were added. Watching for more.",
        result.marked > 0 ? "ok" : "info"
      );
      return result.marked;
    } catch (error) {
      setStatus(error?.message || "Failed to detect languages.", "error");
      throw error;
    }
  }

  function ensureStyles(shadowRoot) {
    const css = `
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
        width: 100%;
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

      .actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .button[data-variant="secondary"] {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.14);
        box-shadow: none;
        color: #eef4ff;
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

    const existing = shadowRoot.querySelector(`#${STYLE_ID}`);
    if (existing) {
      existing.textContent = css;
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
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
    if (!state.cleanupEnabled || state.cleanupQueued) {
      return;
    }

    state.cleanupQueued = true;
    queueMicrotask(() => {
      state.cleanupQueued = false;
      if (state.cleanupEnabled) {
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
      if (state.cleanupEnabled) {
        scheduleCleanup();
      }

      if (state.languageEnabled) {
        scheduleLanguageScan();
      }
    });

    state.observer.observe(target, {
      childList: true,
      subtree: true
    });
  }

  function activateCleanup() {
    state.cleanupEnabled = true;
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
      const existingButton = panel.querySelector(`#${BUTTON_ID}`);
      const existingLanguageButton = panel.querySelector(`#${LANGUAGE_BUTTON_ID}`);
      const existingStatus = panel.querySelector(`#${STATUS_ID}`);

      if (existingButton && existingLanguageButton && existingStatus) {
        state.button = existingButton;
        state.languageButton = existingLanguageButton;
        state.status = existingStatus;
        return panel;
      }

      panel.remove();
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
    copy.textContent = "Runs on the open search page. It removes cards marked Viewed and can scan job pages to add a language flag beside each title.";

    const actions = document.createElement("div");
    actions.className = "actions";

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.className = "button";
    button.textContent = "Clean viewed jobs";
    button.addEventListener("click", () => {
      activateCleanup();
    });

    const languageButton = document.createElement("button");
    languageButton.id = LANGUAGE_BUTTON_ID;
    languageButton.type = "button";
    languageButton.className = "button";
    languageButton.dataset.variant = "secondary";
    languageButton.textContent = "Detect language flags";
    languageButton.addEventListener("click", () => {
      activateLanguageDetection();
    });

    const status = document.createElement("div");
    status.id = STATUS_ID;
    status.className = "status";
    status.dataset.tone = "info";
    status.textContent = "Ready to clean viewed jobs or detect languages on the current LinkedIn results list.";

    actions.append(button, languageButton);
    panel.append(eyebrow, title, copy, actions, status);
    shadowRoot.appendChild(panel);

    state.button = button;
    state.languageButton = languageButton;
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
  window.__liViewedRemoverRunLanguageScan = activateLanguageDetection;
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
        return;
      }

      if (message.type === "li-viewed-remover:detect-languages") {
        activateLanguageDetection()
          .then((marked) => {
            sendResponse({ ok: true, marked });
          })
          .catch((error) => {
            sendResponse({
              ok: false,
              error: error?.message || "Failed to detect languages."
            });
          });
        return true;
      }

      if (message.type === "li-viewed-remover:status") {
        sendResponse({
          ok: true,
          cleanupEnabled: state.cleanupEnabled,
          languageEnabled: state.languageEnabled,
          bootstrapped: state.bootstrapped
        });
      }
    });

    state.messageListenerAttached = true;
  }
})();
