const STORAGE_KEYS = {
  settings: "pvbSettings",
  siteVolumes: "pvbSiteVolumes",
  tabVolumes: "pvbTabVolumes",
};

const injectingTabs = new Set();
const DEFAULT_VOLUME = 100;

function clamp(value) {
  return Math.max(0, Math.min(300, value));
}

function canInjectUrl(url) {
  return typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"));
}

function getTabKey(tabId) {
  return String(tabId);
}

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (error) {
    return "";
  }
}

async function getLocalData(keys) {
  return chrome.storage.local.get(keys);
}

async function getTabVolumes() {
  const result = await getLocalData([STORAGE_KEYS.tabVolumes]);
  return result[STORAGE_KEYS.tabVolumes] || {};
}

async function getSiteVolumes() {
  const result = await getLocalData([STORAGE_KEYS.siteVolumes]);
  return result[STORAGE_KEYS.siteVolumes] || {};
}

async function getSettings() {
  const result = await getLocalData([STORAGE_KEYS.settings]);
  return result[STORAGE_KEYS.settings] || {};
}

async function saveTabVolumes(tabVolumes) {
  await chrome.storage.local.set({ [STORAGE_KEYS.tabVolumes]: tabVolumes });
}

async function saveSiteVolumes(siteVolumes) {
  await chrome.storage.local.set({ [STORAGE_KEYS.siteVolumes]: siteVolumes });
}

async function persistTabVolume(tabId, url, volume) {
  const safeVolume = clamp(volume);
  const tabVolumes = await getTabVolumes();
  tabVolumes[getTabKey(tabId)] = safeVolume;
  await saveTabVolumes(tabVolumes);

  const hostname = getHostname(url);
  if (hostname) {
    const siteVolumes = await getSiteVolumes();
    siteVolumes[hostname] = safeVolume;
    await saveSiteVolumes(siteVolumes);
  }

  return safeVolume;
}

async function resolveVolumeForTab(tabId, url) {
  const tabVolumes = await getTabVolumes();
  const tabVolume = Number(tabVolumes[getTabKey(tabId)]);
  if (Number.isFinite(tabVolume)) {
    return clamp(tabVolume);
  }

  const hostname = getHostname(url);
  if (hostname) {
    const siteVolumes = await getSiteVolumes();
    const siteVolume = Number(siteVolumes[hostname]);
    if (Number.isFinite(siteVolume)) {
      return clamp(siteVolume);
    }
  }

  const settings = await getSettings();
  const globalVolume = Number(settings.globalVolume);
  if (Number.isFinite(globalVolume)) {
    return clamp(globalVolume);
  }

  return DEFAULT_VOLUME;
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawVolumeIcon(volume, size) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const ratio = clamp(volume) / 300;
  const hue = Math.max(0, 140 - Math.round(ratio * 140));
  const accent = `hsl(${hue} 100% 60%)`;
  const accentDark = `hsl(${hue} 100% 34%)`;

  const background = ctx.createLinearGradient(0, 0, size, size);
  background.addColorStop(0, `hsl(${hue + 18} 100% 76%)`);
  background.addColorStop(0.5, `hsl(${hue} 100% 54%)`);
  background.addColorStop(1, `hsl(${Math.max(0, hue - 34)} 100% 45%)`);

  roundedRectPath(ctx, 0, 0, size, size, size * 0.22);
  ctx.fillStyle = background;
  ctx.fill();

  const shine = ctx.createRadialGradient(size * 0.25, size * 0.2, 2, size * 0.3, size * 0.25, size * 0.95);
  shine.addColorStop(0, "rgba(255, 255, 255, 0.9)");
  shine.addColorStop(0.35, "rgba(255, 255, 255, 0.4)");
  shine.addColorStop(1, "rgba(255, 255, 255, 0)");
  roundedRectPath(ctx, 2, 2, size - 4, size - 4, size * 0.2);
  ctx.fillStyle = shine;
  ctx.fill();

  ctx.save();
  ctx.translate(size * 0.22, size * 0.24);
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  roundedRectPath(ctx, 0, size * 0.22, size * 0.11, size * 0.28, size * 0.04);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(size * 0.11, size * 0.36);
  ctx.lineTo(size * 0.31, size * 0.22);
  ctx.lineTo(size * 0.31, size * 0.5);
  ctx.lineTo(size * 0.11, size * 0.36);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = accentDark;
  ctx.lineWidth = Math.max(1, size * 0.02);
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.95;

  const waves = [0.18, 0.29, 0.4];
  waves.forEach((offset, index) => {
    ctx.beginPath();
    ctx.arc(size * 0.34, size * 0.36, size * offset, -0.7, 0.7);
    ctx.strokeStyle = index < Math.max(1, Math.round(ratio * 3)) ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.28)";
    ctx.stroke();
  });
  ctx.restore();

  const barX = size * 0.14;
  const barY = size * 0.74;
  const barWidth = size * 0.72;
  const barHeight = size * 0.12;
  roundedRectPath(ctx, barX, barY, barWidth, barHeight, barHeight / 2);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fill();

  const fillWidth = barWidth * ratio;
  const meter = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
  meter.addColorStop(0, "#32d74b");
  meter.addColorStop(0.5, "#ffd83d");
  meter.addColorStop(1, "#ff4d4d");
  roundedRectPath(ctx, barX, barY, Math.max(barHeight, fillWidth), barHeight, barHeight / 2);
  ctx.fillStyle = meter;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = Math.max(1, size * 0.02);
  roundedRectPath(ctx, 1.5, 1.5, size - 3, size - 3, size * 0.22);
  ctx.stroke();

  return ctx.getImageData(0, 0, size, size);
}

async function updateActionVisuals(volume) {
  const safeVolume = clamp(volume);
  const sizes = [16, 32, 48, 128];
  const imageData = {};

  for (const size of sizes) {
    imageData[size] = drawVolumeIcon(safeVolume, size);
  }

  await chrome.action.setIcon({ imageData });
  await chrome.action.setBadgeText({ text: String(Math.round(safeVolume)) });
  await chrome.action.setBadgeBackgroundColor({ color: safeVolume < 100 ? "#1d9bf0" : safeVolume < 200 ? "#2ecc71" : "#ff7a18" });
  await chrome.action.setTitle({ title: `Volume Booster ${Math.round(safeVolume)}%` });
}

async function injectIntoTab(tabId) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => Boolean(document.getElementById("pvb-root")),
    });

    if (result && result.result) {
      return;
    }

    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["styles.css"],
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
  } catch (error) {
    // Ignore restricted pages where extensions cannot inject scripts.
  }
}

async function ensureInjected(tabId, url) {
  if (!tabId || !canInjectUrl(url) || injectingTabs.has(tabId)) {
    return;
  }

  injectingTabs.add(tabId);
  try {
    await injectIntoTab(tabId);
  } finally {
    injectingTabs.delete(tabId);
  }
}

async function showPanelForTab(tab) {
  if (!tab || !tab.id || !canInjectUrl(tab.url)) {
    return;
  }

  await ensureInjected(tab.id, tab.url);
  const volume = await resolveVolumeForTab(tab.id, tab.url);
  await chrome.tabs.sendMessage(tab.id, {
    type: "pvb-show-panel",
    tabId: tab.id,
    volume,
  });
  await updateActionVisuals(volume);
}

async function adjustCurrentTab(command) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id || !canInjectUrl(tab.url)) {
    return;
  }

  const currentVolume = await resolveVolumeForTab(tab.id, tab.url);
  const delta = command === "increase-volume" ? 10 : -10;
  const nextVolume = clamp(currentVolume + delta);

  await ensureInjected(tab.id, tab.url);
  await chrome.tabs.sendMessage(tab.id, {
    type: "pvb-adjust-volume",
    volume: nextVolume,
    delta,
    showPanel: true,
    tabId: tab.id,
  });
  await persistTabVolume(tab.id, tab.url, nextVolume);
  await updateActionVisuals(nextVolume);
}

async function refreshTabIcon(tabId) {
  if (!tabId) {
    return;
  }

  const tab = await chrome.tabs.get(tabId);
  if (!tab || !canInjectUrl(tab.url)) {
    return;
  }

  const volume = await resolveVolumeForTab(tab.id, tab.url);
  await updateActionVisuals(volume);
}

chrome.action.onClicked.addListener(async (tab) => {
  await showPanelForTab(tab);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-panel") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await showPanelForTab(tab);
    return;
  }

  if (command === "increase-volume" || command === "decrease-volume") {
    await adjustCurrentTab(command);
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || typeof message !== "object") {
    return;
  }

  if (message.type === "pvb-tab-volume-changed" && sender.tab && sender.tab.id) {
    const tabId = sender.tab.id;
    const tabUrl = sender.tab.url || "";
    const volume = clamp(Number(message.volume));

    persistTabVolume(tabId, tabUrl, volume).then(() => updateActionVisuals(volume));
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    await refreshTabIcon(tabId);
  } catch (error) {
    // Ignore tab lookup errors.
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const tabVolumes = await getTabVolumes();
  const key = getTabKey(tabId);
  if (key in tabVolumes) {
    delete tabVolumes[key];
    await saveTabVolumes(tabVolumes);
  }
});

chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  if (tab && tab.id) {
    refreshTabIcon(tab.id);
  }
});
