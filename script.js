"use strict";

const STORAGE_KEYS = {
  theme: "kagi-home-theme",
  shortcuts: "kagi-home-shortcuts",
  showShortcuts: "kagi-home-show-shortcuts",
  background: "kagi-home-background",
  backgroundImage: "kagi-home-background-image",
  backgroundBlur: "kagi-home-background-blur",
};

const CUSTOM_SHORTCUT_COLORS = ["#6c5edc", "#4a67c7", "#3f8611", "#da5819", "#707077", "#18181a"];
const MAX_SHORTCUTS = 10;

const BACKGROUND_OPTIONS = ["none", "custom"];
const MAX_BACKGROUND_IMAGE_LENGTH = 1800000;

// Each attempt downscales the chosen photo further so the data URL fits in local storage.
const BACKGROUND_IMAGE_ATTEMPTS = [
  { width: 2560, height: 1440, quality: 0.82 },
  { width: 1920, height: 1080, quality: 0.78 },
  { width: 1440, height: 900, quality: 0.74 },
  { width: 1024, height: 640, quality: 0.7 },
];

const BACKGROUND_UPLOAD_ERRORS = {
  type: "That file isn't an image.",
  read: "That image couldn't be read.",
  large: "That image is too large to save. Try a smaller photo.",
  storage: "This browser couldn't save the image.",
};

const elements = {
  searchForm: document.querySelector("#search-form"),
  searchInput: document.querySelector("#search-input"),
  clearSearch: document.querySelector("#clear-search"),
  searchHint: document.querySelector(".search-hint"),
  shortcuts: document.querySelector("#shortcuts"),
  shortcutsSection: document.querySelector("#shortcuts-section"),
  shortcutDialog: document.querySelector("#shortcut-dialog"),
  shortcutForm: document.querySelector("#shortcut-form"),
  shortcutName: document.querySelector("#shortcut-name"),
  shortcutUrl: document.querySelector("#shortcut-url"),
  shortcutError: document.querySelector("#shortcut-error"),
  customizeButton: document.querySelector("#customize-button"),
  customizePanel: document.querySelector("#customize-panel"),
  backgroundFile: document.querySelector("#background-file"),
  backgroundTile: document.querySelector(".background-preview--custom"),
  backgroundPreview: document.querySelector("#background-custom-preview"),
  backgroundPlaceholder: document.querySelector(".background-preview__icon"),
  backgroundCustom: document.querySelector("#background-custom"),
  backgroundReplace: document.querySelector("#background-custom-replace"),
  backgroundRemove: document.querySelector("#background-custom-remove"),
  closeCustomize: document.querySelector("#close-customize"),
  showShortcuts: document.querySelector("#show-shortcuts"),
  toast: document.querySelector("#toast"),
};

const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
let toastTimeout;

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // The homepage remains functional when storage is unavailable.
    return false;
  }
}

function removeStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable when the browser restricts local files.
  }
}

function isValidShortcut(value) {
  if (!value || typeof value !== "object") return false;
  if (typeof value.id !== "string" || typeof value.name !== "string") return false;
  try {
    const url = new URL(value.url);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isValidBackground(value) {
  return typeof value === "string" && BACKGROUND_OPTIONS.includes(value);
}

function isValidBackgroundImage(value) {
  return typeof value === "string"
    && value.startsWith("data:image/")
    && value.length <= MAX_BACKGROUND_IMAGE_LENGTH;
}

function isValidBackgroundBlur(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 20;
}

const storedShortcuts = readStorage(STORAGE_KEYS.shortcuts, []);
const storedBackground = readStorage(STORAGE_KEYS.background, "none");
const storedBackgroundImage = readStorage(STORAGE_KEYS.backgroundImage, null);
const storedBackgroundBlur = readStorage(STORAGE_KEYS.backgroundBlur, 0);
const state = {
  theme: readStorage(STORAGE_KEYS.theme, "system"),
  shortcuts: Array.isArray(storedShortcuts)
    ? storedShortcuts.filter(isValidShortcut).slice(0, MAX_SHORTCUTS)
    : [],
  showShortcuts: readStorage(STORAGE_KEYS.showShortcuts, true) !== false,
  background: isValidBackground(storedBackground) ? storedBackground : "none",
  backgroundImage: isValidBackgroundImage(storedBackgroundImage) ? storedBackgroundImage : null,
  backgroundBlur: isValidBackgroundBlur(storedBackgroundBlur) ? Number(storedBackgroundBlur) : 0,
};

try {
  localStorage.removeItem("kagi-home-recent-searches");
} catch {
  // Storage may be unavailable when the browser restricts local files.
}

if (!["system", "light", "dark"].includes(state.theme)) state.theme = "system";
if (!isValidBackground(state.background)) state.background = "none";
if (!isValidBackgroundBlur(state.backgroundBlur)) state.backgroundBlur = 0;

function applyTheme() {
  const resolvedTheme = state.theme === "system"
    ? (systemTheme.matches ? "dark" : "light")
    : state.theme;
  document.documentElement.dataset.theme = resolvedTheme;
  document.querySelector('meta[name="color-scheme"]').content = resolvedTheme;

  const selectedTheme = document.querySelector(`input[name="theme"][value="${state.theme}"]`);
  if (selectedTheme) selectedTheme.checked = true;
}

function getBackgroundImage(background = state.background) {
  if (background !== "custom" || !isValidBackgroundImage(state.backgroundImage)) return null;
  return state.backgroundImage;
}

function syncBackgroundControls() {
  const image = getBackgroundImage("custom");

  document.querySelectorAll('input[name="background"]').forEach((input) => {
    input.checked = input.value === state.background;
  });

  if (elements.backgroundPreview) {
    elements.backgroundPreview.hidden = !image;
    if (image) elements.backgroundPreview.src = image;
    else elements.backgroundPreview.removeAttribute("src");
  }
  if (elements.backgroundTile) {
    elements.backgroundTile.classList.toggle("background-preview--filled", Boolean(image));
  }
  if (elements.backgroundPlaceholder) elements.backgroundPlaceholder.hidden = Boolean(image);
  if (elements.backgroundCustom) elements.backgroundCustom.hidden = !image;
}

function applyBackground(background = state.background) {
  if (!isValidBackground(background)) background = "none";
  if (background === "custom" && !isValidBackgroundImage(state.backgroundImage)) background = "none";
  state.background = background;

  const image = getBackgroundImage(background);
  if (image) {
    document.body.style.setProperty("--background-image", `url("${image}")`);
    document.body.classList.add("has-background");
  } else {
    document.body.classList.remove("has-background");
    document.body.style.removeProperty("--background-image");
  }

  syncBackgroundControls();
}

function loadBackgroundImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error("Unsupported image"));
        return;
      }
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unreadable image"));
    };
    image.src = objectUrl;
  });
}

function encodeBackgroundImage(image) {
  for (const attempt of BACKGROUND_IMAGE_ATTEMPTS) {
    const scale = Math.min(1, attempt.width / image.naturalWidth, attempt.height / image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/webp", attempt.quality);
    if (isValidBackgroundImage(dataUrl)) return dataUrl;
  }
  return null;
}

async function storeBackgroundImage(file) {
  if (!file.type.startsWith("image/")) return "type";

  let image;
  try {
    image = await loadBackgroundImage(file);
  } catch {
    return "read";
  }

  const previousImage = state.backgroundImage;
  const dataUrl = encodeBackgroundImage(image);
  if (!dataUrl) return "large";

  state.backgroundImage = dataUrl;
  if (!writeStorage(STORAGE_KEYS.backgroundImage, dataUrl)) {
    state.backgroundImage = previousImage;
    applyBackground();
    return "storage";
  }

  state.background = "custom";
  writeStorage(STORAGE_KEYS.background, state.background);
  applyBackground(state.background);
  return null;
}

function removeBackgroundImage() {
  state.backgroundImage = null;
  removeStorage(STORAGE_KEYS.backgroundImage);
  applyBackground("none");
  writeStorage(STORAGE_KEYS.background, state.background);
  showToast("Background image removed");
}

function openBackgroundPicker() {
  elements.backgroundFile.value = "";
  elements.backgroundFile.click();
}

async function handleBackgroundFileChange() {
  const file = elements.backgroundFile.files?.[0];
  if (!file) return;

  try {
    const error = await storeBackgroundImage(file);
    showToast(error ? BACKGROUND_UPLOAD_ERRORS[error] : "Background image saved");
  } catch {
    showToast(BACKGROUND_UPLOAD_ERRORS.read);
  } finally {
    elements.backgroundFile.value = "";
  }
}

function applyBackgroundBlur(value = state.backgroundBlur) {
  const blur = isValidBackgroundBlur(value) ? Number(value) : 0;
  state.backgroundBlur = blur;
  document.body.style.setProperty("--background-blur", `${blur}px`);
  const slider = document.querySelector("#background-blur");
  if (slider) slider.value = String(blur);
  const label = document.querySelector("#background-blur-value");
  if (label) label.textContent = `${blur} px`;
}

function initializeBackgroundOptions() {
  syncBackgroundControls();
  applyBackgroundBlur(state.backgroundBlur);
}

function showToast(message) {
  window.clearTimeout(toastTimeout);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimeout = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2600);
}

function createSvgIcon(symbol) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#icon-${symbol}`);
  svg.append(use);
  return svg;
}

function getShortcutFaviconUrls(shortcutUrl) {
  const url = new URL(shortcutUrl);
  const faviconUrls = [];
  const isGoogleMaps = url.hostname === "maps.google.com"
    || (["google.com", "www.google.com"].includes(url.hostname) && url.pathname.startsWith("/maps"));

  // Product icons avoid generic root favicons and low-resolution defaults.
  if (isGoogleMaps) {
    faviconUrls.push("https://www.google.com/images/branding/product/ico/maps15_bnuw3a_32dp.ico");
  }
  if (url.hostname === "music.youtube.com") {
    faviconUrls.push("https://music.youtube.com/img/favicon_144.png");
  }

  faviconUrls.push(
    ...["/favicon.svg", "/favicon.png", "/favicon.ico", "/apple-touch-icon.png"]
      .map((path) => new URL(path, url).href),
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(url.hostname)}.ico`,
  );
  return [...new Set(faviconUrls)];
}

function makeShortcutElement(shortcut) {
  const wrapper = document.createElement("div");
  wrapper.className = "shortcut";
  wrapper.dataset.shortcutId = shortcut.id;
  wrapper.dataset.shortcutHostname = new URL(shortcut.url).hostname;

  const link = document.createElement("a");
  link.className = "shortcut__link";
  link.href = shortcut.url;
  link.setAttribute("aria-label", shortcut.name);

  const icon = document.createElement("span");
  icon.className = "shortcut__icon";
  icon.style.setProperty("--shortcut-color", shortcut.color || CUSTOM_SHORTCUT_COLORS[0]);

  const fallback = document.createElement("span");
  fallback.setAttribute("aria-hidden", "true");
  fallback.textContent = shortcut.name.trim().charAt(0).toUpperCase() || "?";

  const favicon = document.createElement("img");
  favicon.className = "shortcut__favicon";
  favicon.alt = "";
  favicon.hidden = true;
  favicon.decoding = "async";
  favicon.referrerPolicy = "no-referrer";
  favicon.addEventListener("load", () => {
    fallback.hidden = true;
    favicon.hidden = false;
    icon.classList.add("has-favicon");
  });
  const faviconUrls = getShortcutFaviconUrls(shortcut.url);
  let faviconAttempt = 0;
  const tryNextFavicon = () => {
    if (faviconAttempt === faviconUrls.length) {
      favicon.remove();
      return;
    }
    favicon.src = faviconUrls[faviconAttempt];
    faviconAttempt += 1;
  };
  favicon.addEventListener("error", tryNextFavicon);
  tryNextFavicon();
  icon.append(fallback, favicon);

  const name = document.createElement("span");
  name.className = "shortcut__name";
  name.textContent = shortcut.name;
  link.append(icon, name);

  const menuButton = document.createElement("button");
  menuButton.className = "shortcut__menu-button";
  menuButton.type = "button";
  menuButton.setAttribute("aria-label", `Options for ${shortcut.name}`);
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.append(createSvgIcon("more"));

  const menu = document.createElement("div");
  menu.className = "shortcut__menu";
  menu.hidden = true;
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "Remove shortcut";
  removeButton.addEventListener("click", () => removeShortcut(shortcut.id, shortcut.name));
  menu.append(removeButton);

  menuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = menu.hidden;
    closeShortcutMenus();
    menu.hidden = !willOpen;
    menuButton.setAttribute("aria-expanded", String(willOpen));
  });

  link.addEventListener("click", () => closeShortcutMenus());
  wrapper.append(link, menuButton, menu);
  return wrapper;
}

function makeAddShortcutElement() {
  const wrapper = document.createElement("div");
  wrapper.className = "shortcut";
  const button = document.createElement("button");
  button.className = "add-shortcut";
  button.type = "button";
  button.setAttribute("aria-label", "Add shortcut");

  const icon = document.createElement("span");
  icon.className = "shortcut__icon";
  icon.append(createSvgIcon("plus"));
  const name = document.createElement("span");
  name.className = "shortcut__name";
  name.textContent = "Add shortcut";
  button.append(icon, name);
  button.addEventListener("click", openShortcutDialog);
  wrapper.append(button);
  return wrapper;
}

function renderShortcuts() {
  elements.shortcuts.replaceChildren();
  const fragment = document.createDocumentFragment();
  state.shortcuts.forEach((shortcut) => fragment.append(makeShortcutElement(shortcut)));
  if (state.shortcuts.length < MAX_SHORTCUTS) fragment.append(makeAddShortcutElement());
  elements.shortcuts.append(fragment);
  elements.shortcutsSection.hidden = !state.showShortcuts;
  elements.showShortcuts.checked = state.showShortcuts;
}

function closeShortcutMenus() {
  document.querySelectorAll(".shortcut__menu").forEach((menu) => { menu.hidden = true; });
  document.querySelectorAll(".shortcut__menu-button").forEach((button) => {
    button.setAttribute("aria-expanded", "false");
  });
}

function removeShortcut(id, name) {
  state.shortcuts = state.shortcuts.filter((shortcut) => shortcut.id !== id);
  writeStorage(STORAGE_KEYS.shortcuts, state.shortcuts);
  renderShortcuts();
  showToast(`${name} removed`);
}

function openShortcutDialog() {
  elements.shortcutForm.reset();
  elements.shortcutError.textContent = "";
  elements.shortcutDialog.showModal();
  window.setTimeout(() => elements.shortcutName.focus(), 50);
}

function normalizeUrl(value) {
  const trimmedValue = value.trim();
  const withProtocol = /^https?:\/\//i.test(trimmedValue) ? trimmedValue : `https://${trimmedValue}`;
  const url = new URL(withProtocol);
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) {
    throw new Error("Invalid URL");
  }
  return url.href;
}

function submitSearch(query) {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    elements.searchInput.focus();
    return;
  }
  window.location.assign(`https://kagi.com/search?q=${encodeURIComponent(cleanQuery)}`);
}

function closePopovers() {
  document.querySelectorAll(".popover").forEach((popover) => { popover.hidden = true; });
  document.querySelectorAll('[aria-controls="apps-menu"]').forEach((button) => {
    button.setAttribute("aria-expanded", "false");
  });
}

function setupPopover(buttonId, menuId) {
  const button = document.querySelector(`#${buttonId}`);
  const menu = document.querySelector(`#${menuId}`);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = menu.hidden;
    closePopovers();
    menu.hidden = !willOpen;
    button.setAttribute("aria-expanded", String(willOpen));
  });
  menu.addEventListener("click", (event) => event.stopPropagation());
}

function closeCustomizePanel() {
  elements.customizePanel.close();
}

elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitSearch(elements.searchInput.value);
});

elements.searchInput.addEventListener("input", () => {
  elements.clearSearch.hidden = !elements.searchInput.value;
});

elements.clearSearch.addEventListener("click", () => {
  elements.searchInput.value = "";
  elements.clearSearch.hidden = true;
  elements.searchInput.focus();
});

elements.shortcutForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = elements.shortcutName.value.trim();
  if (!name) {
    elements.shortcutError.textContent = "Enter a name for this shortcut.";
    elements.shortcutName.focus();
    return;
  }

  let url;
  try {
    url = normalizeUrl(elements.shortcutUrl.value);
  } catch {
    elements.shortcutError.textContent = "Enter a valid web address, such as example.com.";
    elements.shortcutUrl.focus();
    return;
  }

  const colorIndex = state.shortcuts.length % CUSTOM_SHORTCUT_COLORS.length;
  state.shortcuts.push({
    id: `custom-${Date.now()}`,
    name,
    url,
    color: CUSTOM_SHORTCUT_COLORS[colorIndex],
  });
  writeStorage(STORAGE_KEYS.shortcuts, state.shortcuts);
  renderShortcuts();
  elements.shortcutDialog.close();
  showToast(`${name} added to your shortcuts`);
});

document.querySelectorAll(".dialog-close").forEach((button) => {
  button.addEventListener("click", () => elements.shortcutDialog.close());
});

elements.shortcutDialog.addEventListener("click", (event) => {
  if (event.target !== elements.shortcutDialog) return;
  const bounds = elements.shortcutDialog.getBoundingClientRect();
  const inside = event.clientX >= bounds.left && event.clientX <= bounds.right
    && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
  if (!inside) elements.shortcutDialog.close();
});

elements.customizeButton.addEventListener("click", () => {
  closePopovers();
  elements.customizePanel.showModal();
});
elements.closeCustomize.addEventListener("click", closeCustomizePanel);

document.querySelectorAll('input[name="theme"]').forEach((input) => {
  input.addEventListener("change", () => {
    state.theme = input.value;
    writeStorage(STORAGE_KEYS.theme, state.theme);
    applyTheme();
  });
});

document.querySelectorAll('input[name="background"]').forEach((input) => {
  input.addEventListener("change", () => {
    if (!isValidBackground(input.value)) {
      syncBackgroundControls();
      return;
    }

    if (input.value === "custom" && !isValidBackgroundImage(state.backgroundImage)) {
      syncBackgroundControls();
      openBackgroundPicker();
      return;
    }

    state.background = input.value;
    writeStorage(STORAGE_KEYS.background, state.background);
    applyBackground(state.background);
  });
});

elements.backgroundReplace.addEventListener("click", openBackgroundPicker);
elements.backgroundRemove.addEventListener("click", removeBackgroundImage);
elements.backgroundFile.addEventListener("change", handleBackgroundFileChange);

const backgroundBlurSlider = document.querySelector("#background-blur");
if (backgroundBlurSlider) {
  backgroundBlurSlider.addEventListener("input", () => {
    const value = isValidBackgroundBlur(backgroundBlurSlider.value)
      ? Number(backgroundBlurSlider.value)
      : 0;
    state.backgroundBlur = value;
    writeStorage(STORAGE_KEYS.backgroundBlur, state.backgroundBlur);
    applyBackgroundBlur(state.backgroundBlur);
  });
}

systemTheme.addEventListener("change", () => {
  if (state.theme === "system") applyTheme();
});

elements.showShortcuts.addEventListener("change", () => {
  state.showShortcuts = elements.showShortcuts.checked;
  writeStorage(STORAGE_KEYS.showShortcuts, state.showShortcuts);
  renderShortcuts();
});

setupPopover("apps-button", "apps-menu");

document.addEventListener("click", () => {
  closePopovers();
  closeShortcutMenus();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closePopovers();
    closeShortcutMenus();
    return;
  }

  const activeTag = document.activeElement?.tagName;
  const isTyping = activeTag === "INPUT" || activeTag === "TEXTAREA" || document.activeElement?.isContentEditable;
  const dialogOpen = elements.shortcutDialog.open || elements.customizePanel.open;
  if ((event.key === "/" && !isTyping && !dialogOpen) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !dialogOpen)) {
    event.preventDefault();
    closePopovers();
    elements.searchInput.focus();
    elements.searchInput.select();
  }
});

let hintTimeout;
document.addEventListener("mousemove", () => {
  if (document.activeElement === elements.searchInput || elements.searchHint.classList.contains("is-visible")) return;
  elements.searchHint.classList.add("is-visible");
  window.clearTimeout(hintTimeout);
  hintTimeout = window.setTimeout(() => elements.searchHint.classList.remove("is-visible"), 2400);
}, { passive: true });

applyTheme();
renderShortcuts();
initializeBackgroundOptions();
applyBackground();

// Autofocus can be ignored by some browsers when opening a local homepage.
if (!elements.shortcutDialog.open && !elements.customizePanel.open) {
  window.setTimeout(() => elements.searchInput.focus({ preventScroll: true }), 0);
}
