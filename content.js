(() => {
  if (window.__pvbLoaded) {
    return;
  }
  window.__pvbLoaded = true;

  const SETTINGS_KEY = "pvbSettings";
  const SITE_VOLUMES_KEY = "pvbSiteVolumes";
  const TAB_VOLUMES_KEY = "pvbTabVolumes";
  const MIN = 0;
  const MAX = 300;
  const DEFAULT = 100;
  const SILENCE_THRESHOLD = 0.003;
  const LOW_AUDIO_THRESHOLD = 0.015;
  const LOW_AUDIO_SECONDS_TO_SUGGEST = 8;
  const host = window.location.hostname;

  const defaultSettings = {
    enabled: true,
    globalVolume: DEFAULT,
    theme: "light",
    language: "auto",
  };

  const translations = {
    en: {
      title: "Volume Booster",
      status: "Status",
      active: "Active",
      offGlobal: "Global OFF",
      volume: "Volume",
      themeDark: "Theme: Dark",
      themeLight: "Theme: Light",
      lowAudio: "Low audio detected.",
      boost150: "Boost to 150%",
      note: "Per-site and per-tab volume saved. Above 100% may distort.",
      language: "Language",
      auto: "Auto",
      english: "English",
      spanish: "Spanish",
    },
    es: {
      title: "Potenciador de volumen",
      status: "Estado",
      active: "Activo",
      offGlobal: "OFF global",
      volume: "Volumen",
      themeDark: "Tema: Oscuro",
      themeLight: "Tema: Claro",
      lowAudio: "Audio bajo detectado.",
      boost150: "Subir a 150%",
      note: "Volumen guardado por sitio y por pestaña. Por encima de 100% puede aparecer distorsion.",
      language: "Idioma",
      auto: "Auto",
      english: "Inglés",
      spanish: "Español",
    },
  };

  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const mediaNodes = new WeakMap();

  let settings = { ...defaultSettings };
  let siteVolumes = {};
  let tabVolumes = {};
  let currentPercent = DEFAULT;
  let lowAudioSeconds = 0;
  let lastAudioCheckMs = 0;
  let currentTabId = null;
  let currentLanguage = "en";

  const ui = {
    root: null,
    header: null,
    slider: null,
    value: null,
    minBtn: null,
    enabledBtn: null,
    status: null,
    themeBtn: null,
    closeBtn: null,
    languageSelect: null,
    lowAudioBox: null,
    lowAudioAction: null,
  };

  function resolveLanguagePreference() {
    if (settings.language === "en" || settings.language === "es") {
      return settings.language;
    }

    return navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
  }

  function t(key) {
    return translations[currentLanguage][key] || translations.en[key] || key;
  }

  function clamp(value) {
    return Math.max(MIN, Math.min(MAX, value));
  }

  function percentToGain(percent) {
    return clamp(percent) / 100;
  }

  function saveSettings() {
    chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  }

  function saveSiteVolumes() {
    chrome.storage.local.set({ [SITE_VOLUMES_KEY]: siteVolumes });
  }

  function saveTabVolumes() {
    chrome.storage.local.set({ [TAB_VOLUMES_KEY]: tabVolumes });
  }

  function getTabVolumeKey(tabId) {
    return String(tabId);
  }

  function getVolumeColor(percent) {
    const ratio = clamp(percent) / MAX;
    const hue = Math.max(0, 140 - Math.round(ratio * 140));
    return `hsl(${hue} 95% 58%)`;
  }

  function updateSliderVisuals(percent) {
    if (!ui.root || !ui.slider) {
      return;
    }

    const ratio = clamp(percent) / MAX;
    const fillPercent = Math.max(4, Math.round(ratio * 100));
    const hue = Math.max(0, 140 - Math.round(ratio * 140));
    const accent = `hsl(${hue} 95% 58%)`;
    const glow = `hsla(${hue}, 100%, 65%, 0.62)`;
    const track = `linear-gradient(90deg, ${accent} 0%, ${accent} ${fillPercent}%, rgba(255,255,255,0.72) ${fillPercent}%, rgba(255,255,255,0.28) 100%)`;

    ui.root.style.setProperty("--pvb-accent", accent);
    ui.root.style.setProperty("--pvb-glow", glow);
    ui.root.style.setProperty("--pvb-slider-track", track);
    ui.root.style.setProperty("--pvb-slider-track-shadow", `hsla(${hue}, 100%, 32%, 0.28)`);
    ui.root.style.setProperty("--pvb-slider-thumb-ring", accent);
    ui.root.style.setProperty("--pvb-slider-value", accent);
  }

  async function persistVolumeForCurrentTab(volume) {
    if (currentTabId == null) {
      return;
    }

    const key = getTabVolumeKey(currentTabId);
    tabVolumes[key] = clamp(volume);
    siteVolumes[host] = clamp(volume);
    saveTabVolumes();
    saveSiteVolumes();
    chrome.runtime.sendMessage({
      type: "pvb-tab-volume-changed",
      volume: clamp(volume),
    });
  }

  function getCurrentTabVolume() {
    if (currentTabId != null) {
      const tabValue = Number(tabVolumes[getTabVolumeKey(currentTabId)]);
      if (Number.isFinite(tabValue)) {
        return clamp(tabValue);
      }
    }

    const siteVolume = Number(siteVolumes[host]);
    if (Number.isFinite(siteVolume)) {
      return clamp(siteVolume);
    }

    const globalVolume = Number(settings.globalVolume);
    if (Number.isFinite(globalVolume)) {
      return clamp(globalVolume);
    }

    return DEFAULT;
  }

  function isActiveForCurrentPage() {
    return Boolean(settings.enabled);
  }

  function getEffectivePercent() {
    return isActiveForCurrentPage() ? currentPercent : 100;
  }

  function ensureConnected(mediaElement) {
    if (mediaNodes.has(mediaElement)) {
      return;
    }

    try {
      const source = audioContext.createMediaElementSource(mediaElement);
      const gainNode = audioContext.createGain();
      const analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 2048;

      source.connect(gainNode).connect(audioContext.destination);
      source.connect(analyserNode);

      mediaNodes.set(mediaElement, {
        gainNode,
        analyserNode,
      });

      gainNode.gain.value = percentToGain(getEffectivePercent());
    } catch (error) {
      // Ignore media that cannot be attached to AudioContext.
    }
  }

  function applyToAllMedia() {
    const media = document.querySelectorAll("video, audio");
    media.forEach((element) => ensureConnected(element));
  }

  function refreshStatusText() {
    if (!ui.status) {
      return;
    }

    if (!settings.enabled) {
      ui.status.textContent = t("offGlobal");
      return;
    }

    ui.status.textContent = t("active");
  }

  function refreshButtons() {
    if (ui.enabledBtn) {
      ui.enabledBtn.textContent = settings.enabled ? "ON" : "OFF";
      ui.enabledBtn.classList.toggle("pvb-btn-danger", !settings.enabled);
    }

    if (ui.themeBtn) {
      ui.themeBtn.textContent = settings.theme === "dark" ? t("themeDark") : t("themeLight");
    }

    if (ui.languageSelect) {
      ui.languageSelect.value = settings.language || "auto";
    }
  }

  function updateLocalizedUi() {
    currentLanguage = resolveLanguagePreference();

    const title = ui.root?.querySelector("#pvb-title");
    const statusLabel = ui.root?.querySelector("#pvb-status-label");
    const volumeLabel = ui.root?.querySelector("#pvb-volume-label");
    const languageLabel = ui.root?.querySelector("#pvb-language-label");
    const note = ui.root?.querySelector("#pvb-note");
    const lowAudioLabel = ui.root?.querySelector("#pvb-low-audio-label");
    const lowAudioAction = ui.root?.querySelector("#pvb-low-audio-action");

    if (title) title.textContent = t("title");
    if (statusLabel) statusLabel.textContent = t("status");
    if (volumeLabel) volumeLabel.textContent = t("volume");
    if (languageLabel) languageLabel.textContent = t("language");
    if (note) note.textContent = t("note");
    if (lowAudioLabel) lowAudioLabel.textContent = t("lowAudio");
    if (lowAudioAction) lowAudioAction.textContent = t("boost150");

    if (ui.languageSelect) {
      ui.languageSelect.options[0].text = t("auto");
      ui.languageSelect.options[1].text = t("english");
      ui.languageSelect.options[2].text = t("spanish");
    }

    if (ui.themeBtn) {
      ui.themeBtn.textContent = settings.theme === "dark" ? t("themeDark") : t("themeLight");
      ui.themeBtn.title = settings.theme === "dark" ? t("themeLight") : t("themeDark");
    }

    refreshStatusText();
  }

  function updateRootTheme() {
    if (ui.root) {
      ui.root.dataset.theme = settings.theme;
    }
  }

  function applyGainToConnectedNodes() {
    const effectivePercent = getEffectivePercent();
    document.querySelectorAll("video, audio").forEach((element) => {
      const nodes = mediaNodes.get(element);
      if (nodes) {
        nodes.gainNode.gain.value = percentToGain(effectivePercent);
      }
    });
  }

  function applyCurrentGain() {
    applyToAllMedia();
    applyGainToConnectedNodes();
    refreshStatusText();
  }

  function setVolume(percent, save = true) {
    currentPercent = clamp(percent);
    updateSliderVisuals(currentPercent);

    if (ui.slider) {
      ui.slider.value = String(currentPercent);
    }
    if (ui.value) {
      ui.value.textContent = `${currentPercent}%`;
    }

    settings.globalVolume = currentPercent;
    siteVolumes[host] = currentPercent;

    applyCurrentGain();

    if (save) {
      saveSettings();
      saveSiteVolumes();
      persistVolumeForCurrentTab(currentPercent);
    }
  }

  function createUI() {
    const root = document.createElement("div");
    root.id = "pvb-root";
    root.dataset.theme = settings.theme;

    root.innerHTML = `
      <div id="pvb-panel">
        <div id="pvb-header">
          <span id="pvb-title">${t("title")}</span>
          <div class="pvb-actions">
            <button class="pvb-btn" id="pvb-theme-btn" title="${t("themeDark")}">${t("themeDark")}</button>
            <button class="pvb-btn" id="pvb-min-btn" title="Minimizar">_</button>
            <button class="pvb-btn pvb-btn-close" id="pvb-close-btn" title="Cerrar panel">X</button>
          </div>
        </div>
        <div id="pvb-body">
          <div id="pvb-row" class="pvb-first-row">
            <span id="pvb-status-label">${t("status")}</span>
            <strong id="pvb-status">${t("active")}</strong>
          </div>

          <div class="pvb-row-gap">
            <button class="pvb-btn" id="pvb-enabled-btn">ON</button>
          </div>

          <div class="pvb-row-gap">
            <span class="pvb-mini-label" id="pvb-language-label">${t("language")}</span>
            <select id="pvb-language">
              <option value="auto">${t("auto")}</option>
              <option value="en">${t("english")}</option>
              <option value="es">${t("spanish")}</option>
            </select>
          </div>

          <div class="pvb-volume-card">
            <div class="pvb-volume-head">
              <span id="pvb-volume-label">${t("volume")}</span>
              <strong id="pvb-value">${currentPercent}%</strong>
            </div>

            <div class="pvb-profiles">
              <button class="pvb-btn pvb-profile" data-value="0">0%</button>
              <button class="pvb-btn pvb-profile" data-value="100">100%</button>
              <button class="pvb-btn pvb-profile" data-value="150">150%</button>
              <button class="pvb-btn pvb-profile" data-value="200">200%</button>
              <button class="pvb-btn pvb-profile" data-value="300">300%</button>
            </div>

            <input id="pvb-slider" type="range" min="0" max="300" value="${currentPercent}" step="1" />
          </div>

          <div id="pvb-low-audio" hidden>
            <span id="pvb-low-audio-label">${t("lowAudio")}</span>
            <button class="pvb-btn" id="pvb-low-audio-action">Subir a 150%</button>
          </div>

          <div id="pvb-note">
            ${t("note")}
          </div>
        </div>
      </div>
    `;

    document.documentElement.appendChild(root);

    ui.root = root;
    ui.header = root.querySelector("#pvb-header");
    ui.slider = root.querySelector("#pvb-slider");
    ui.value = root.querySelector("#pvb-value");
    ui.minBtn = root.querySelector("#pvb-min-btn");
    ui.enabledBtn = root.querySelector("#pvb-enabled-btn");
    ui.status = root.querySelector("#pvb-status");
    ui.closeBtn = root.querySelector("#pvb-close-btn");
    ui.themeBtn = root.querySelector("#pvb-theme-btn");
    ui.languageSelect = root.querySelector("#pvb-language");
    ui.lowAudioBox = root.querySelector("#pvb-low-audio");
    ui.lowAudioAction = root.querySelector("#pvb-low-audio-action");

    updateLocalizedUi();
    ui.languageSelect.value = settings.language || "auto";

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    function onMouseMove(event) {
      if (!dragging) {
        return;
      }
      const x = initialLeft + (event.clientX - startX);
      const y = initialTop + (event.clientY - startY);
      root.style.left = `${x}px`;
      root.style.top = `${y}px`;
      root.style.right = "auto";
    }

    function onMouseUp() {
      dragging = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    ui.header.addEventListener("mousedown", (event) => {
      if (event.target === ui.minBtn || event.target === ui.themeBtn || event.target === ui.closeBtn) {
        return;
      }
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      const rect = root.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });

    ui.slider.addEventListener("input", () => {
      setVolume(Number(ui.slider.value));
    });

    ui.enabledBtn.addEventListener("click", () => {
      settings.enabled = !settings.enabled;
      saveSettings();
      refreshButtons();
      applyCurrentGain();
    });

    ui.languageSelect.addEventListener("change", () => {
      settings.language = ui.languageSelect.value;
      saveSettings();
      currentLanguage = resolveLanguagePreference();
      updateLocalizedUi();
      refreshButtons();
    });

    root.querySelectorAll(".pvb-profile").forEach((button) => {
      button.addEventListener("click", () => {
        const target = Number(button.getAttribute("data-value"));
        setVolume(target);
      });
    });

    ui.themeBtn.addEventListener("click", () => {
      settings.theme = settings.theme === "dark" ? "light" : "dark";
      updateRootTheme();
      saveSettings();
      refreshButtons();
    });

    ui.minBtn.addEventListener("click", () => {
      root.classList.toggle("pvb-minimized");
      ui.minBtn.textContent = root.classList.contains("pvb-minimized") ? "+" : "_";
    });

    ui.lowAudioAction.addEventListener("click", () => {
      setVolume(150);
      if (ui.lowAudioBox) {
        ui.lowAudioBox.hidden = true;
      }
      lowAudioSeconds = 0;
    });

    ui.closeBtn.addEventListener("click", () => {
      root.classList.add("pvb-hidden");
    });

    refreshButtons();
    refreshStatusText();
    setVolume(currentPercent, false);
  }

  function getActiveMonitoringNodes() {
    const media = Array.from(document.querySelectorAll("video, audio"));
    for (const element of media) {
      if (element.paused || element.muted || element.ended) {
        continue;
      }

      const nodes = mediaNodes.get(element);
      if (nodes) {
        return nodes;
      }
    }

    return null;
  }

  function estimateAudioRms(analyserNode) {
    const samples = new Float32Array(analyserNode.fftSize);
    analyserNode.getFloatTimeDomainData(samples);

    let sum = 0;
    for (let i = 0; i < samples.length; i += 1) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  }

  function monitorLowAudio(nowMs) {
    if (!lastAudioCheckMs) {
      lastAudioCheckMs = nowMs;
    }

    const elapsed = (nowMs - lastAudioCheckMs) / 1000;
    if (elapsed < 1) {
      window.requestAnimationFrame(monitorLowAudio);
      return;
    }
    lastAudioCheckMs = nowMs;

    if (!isActiveForCurrentPage()) {
      lowAudioSeconds = 0;
      if (ui.lowAudioBox) {
        ui.lowAudioBox.hidden = true;
      }
      window.requestAnimationFrame(monitorLowAudio);
      return;
    }

    const nodes = getActiveMonitoringNodes();
    if (!nodes) {
      lowAudioSeconds = 0;
      if (ui.lowAudioBox) {
        ui.lowAudioBox.hidden = true;
      }
      window.requestAnimationFrame(monitorLowAudio);
      return;
    }

    const rms = estimateAudioRms(nodes.analyserNode);
    const shouldConsiderLow = currentPercent <= 120;
    const hasRealAudioSignal = rms > SILENCE_THRESHOLD;
    const isLowAudio = hasRealAudioSignal && rms < LOW_AUDIO_THRESHOLD;

    if (shouldConsiderLow && isLowAudio) {
      lowAudioSeconds += elapsed;
    } else {
      lowAudioSeconds = 0;
      if (ui.lowAudioBox) {
        ui.lowAudioBox.hidden = true;
      }
    }

    if (ui.lowAudioBox && lowAudioSeconds >= LOW_AUDIO_SECONDS_TO_SUGGEST) {
      ui.lowAudioBox.hidden = false;
    }

    window.requestAnimationFrame(monitorLowAudio);
  }

  const observer = new MutationObserver(() => {
    applyToAllMedia();
    applyGainToConnectedNodes();
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || typeof message !== "object") {
      return;
    }

    if (message.type === "pvb-show-panel" && ui.root) {
      if (typeof message.tabId === "number") {
        currentTabId = message.tabId;
      }

      if (typeof message.volume === "number") {
        setVolume(message.volume, false);
      }

      ui.root.classList.remove("pvb-hidden");
      ui.root.classList.remove("pvb-minimized");
      if (ui.minBtn) {
        ui.minBtn.textContent = "_";
      }
      ui.root.classList.add("pvb-pulse");
      window.setTimeout(() => {
        if (ui.root) {
          ui.root.classList.remove("pvb-pulse");
        }
      }, 700);
    }

    if (message.type === "pvb-hide-panel" && ui.root) {
      ui.root.classList.add("pvb-hidden");
    }

    if (message.type === "pvb-adjust-volume" && ui.root) {
      const nextVolume = typeof message.volume === "number" ? message.volume : currentPercent + Number(message.delta || 0);
      setVolume(nextVolume);
      ui.root.classList.remove("pvb-hidden");
      ui.root.classList.remove("pvb-minimized");
      if (ui.minBtn) {
        ui.minBtn.textContent = "_";
      }
    }
  });

  function startWhenReady() {
    if (audioContext.state === "suspended") {
      const resume = () => {
        audioContext.resume();
      };
      window.addEventListener("click", resume, { once: true });
      window.addEventListener("keydown", resume, { once: true });
    }

    chrome.storage.local.get([SETTINGS_KEY, SITE_VOLUMES_KEY, TAB_VOLUMES_KEY], (result) => {
      settings = {
        ...defaultSettings,
        ...(result[SETTINGS_KEY] || {}),
      };

      siteVolumes = result[SITE_VOLUMES_KEY] || {};
      tabVolumes = result[TAB_VOLUMES_KEY] || {};
      currentLanguage = resolveLanguagePreference();

      currentPercent = getCurrentTabVolume();

      createUI();
      updateSliderVisuals(currentPercent);
      applyCurrentGain();

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });

      window.requestAnimationFrame(monitorLowAudio);
    });
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", startWhenReady, { once: true });
  } else {
    startWhenReady();
  }
})();
