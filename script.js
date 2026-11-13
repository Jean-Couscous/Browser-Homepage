"use strict";

// The classic-script bundle in lib/ loads first and exposes this namespace.
const {
  createJsonStorage,
  normalizeUrl,
  faviconCandidates,
  imageFileToDataUrl,
  ImageError,
} = BrowserLibraries;

const storage = createJsonStorage();

const STORAGE_KEYS = {
  theme: "kagi-home-theme",
  shortcuts: "kagi-home-shortcuts",
  showShortcuts: "kagi-home-show-shortcuts",
  showAnimalFact: "kagi-home-show-animal-fact",
  animal: "kagi-home-animal",
  background: "kagi-home-background",
  backgroundImage: "kagi-home-background-image",
  backgroundBlur: "kagi-home-background-blur",
};

const CUSTOM_SHORTCUT_COLORS = ["#6c5edc", "#4a67c7", "#3f8611", "#da5819", "#707077", "#18181a"];
const MAX_SHORTCUTS = 10;

const BACKGROUND_OPTIONS = ["none", "custom"];
// The bundled image library's default size ladder keeps the data URL within this budget.
const MAX_BACKGROUND_IMAGE_LENGTH = 1800000;

const ANIMALS = ["cat", "dog"];

// Each animal mode pairs a mascot with a public facts API and the shape of its response.
const FACT_SOURCES = {
  cat: {
    url: "https://meowfacts.herokuapp.com/",
    read: (payload) => payload?.data?.[0],
  },
  dog: {
    url: "https://dogapi.dog/api/v2/facts",
    read: (payload) => payload?.data?.[0]?.attributes?.body,
  },
};

const FACT_LOADING = "Loading a fact…";
const FACT_FALLBACK = "Facts are unavailable right now — try again in a moment.";
const MAX_FACT_LENGTH = 500;

const BACKGROUND_UPLOAD_ERRORS = {
  type: "That file isn't an image.",
  read: "That image couldn't be read.",
  encode: "That image couldn't be processed.",
  large: "That image is too large to save. Try a smaller photo.",
  storage: "This browser couldn't save the image.",
};

const elements = {
  searchForm: document.querySelector("#search-form"),
  searchInput: document.querySelector("#search-input"),
  clearSearch: document.querySelector("#clear-search"),
  searchHint: document.querySelector(".search-hint"),
  animalFact: document.querySelector("#animal-fact"),
  animalFactText: document.querySelector("#animal-fact-text"),
  showAnimalFact: document.querySelector("#show-animal-fact"),
  mascotDog: document.querySelector(".mascot--dog"),
  mascotCat: document.querySelector(".mascot--cat"),
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

const storedShortcuts = storage.read(STORAGE_KEYS.shortcuts, []);
const storedBackground = storage.read(STORAGE_KEYS.background, "none");
const storedBackgroundImage = storage.read(STORAGE_KEYS.backgroundImage, null);
const storedBackgroundBlur = storage.read(STORAGE_KEYS.backgroundBlur, 0);

// The fact setting was stored under a cat-only key before dog mode existed.
const storedShowAnimalFact = storage.read(
  STORAGE_KEYS.showAnimalFact,
  storage.read("kagi-home-show-cat-fact", true),
);

const state = {
  theme: storage.read(STORAGE_KEYS.theme, "system"),
  shortcuts: Array.isArray(storedShortcuts)
    ? storedShortcuts.filter(isValidShortcut).slice(0, MAX_SHORTCUTS)
    : [],
  showShortcuts: storage.read(STORAGE_KEYS.showShortcuts, true) !== false,
  showAnimalFact: storedShowAnimalFact !== false,
  animal: storage.read(STORAGE_KEYS.animal, "cat"),
  background: isValidBackground(storedBackground) ? storedBackground : "none",
  backgroundImage: isValidBackgroundImage(storedBackgroundImage) ? storedBackgroundImage : null,
  backgroundBlur: isValidBackgroundBlur(storedBackgroundBlur) ? Number(storedBackgroundBlur) : 0,
};

storage.remove("kagi-home-recent-searches");

if (!["system", "light", "dark"].includes(state.theme)) state.theme = "system";
if (!isValidBackground(state.background)) state.background = "none";
if (!isValidBackgroundBlur(state.backgroundBlur)) state.backgroundBlur = 0;
if (!ANIMALS.includes(state.animal)) state.animal = "cat";

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

async function storeBackgroundImage(file) {
  let dataUrl;
  try {
    dataUrl = await imageFileToDataUrl(file, {
      maxLength: MAX_BACKGROUND_IMAGE_LENGTH,
    });
  } catch (error) {
    return error instanceof ImageError ? error.code : "read";
  }

  const previousImage = state.backgroundImage;
  state.backgroundImage = dataUrl;
  if (!storage.write(STORAGE_KEYS.backgroundImage, dataUrl)) {
    state.backgroundImage = previousImage;
    applyBackground();
    return "storage";
  }

  state.background = "custom";
  storage.write(STORAGE_KEYS.background, state.background);
  applyBackground(state.background);
  return null;
}

function removeBackgroundImage() {
  state.backgroundImage = null;
  storage.remove(STORAGE_KEYS.backgroundImage);
  applyBackground("none");
  storage.write(STORAGE_KEYS.background, state.background);
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

let factRequestId = 0;
let factLoaded = false;

function extractFact(animal, payload) {
  const source = FACT_SOURCES[animal];
  if (!source) return null;
  const fact = source.read(payload);
  if (typeof fact !== "string") return null;
  const cleanFact = fact.trim();
  return cleanFact && cleanFact.length <= MAX_FACT_LENGTH ? cleanFact : null;
}

async function fetchAnimalFact() {
  if (!state.showAnimalFact || !elements.animalFactText) return;
  const animal = state.animal;
  const source = FACT_SOURCES[animal];
  if (!source) return;
  const requestId = ++factRequestId;
  elements.animalFactText.setAttribute("aria-busy", "true");

  try {
    const response = await fetch(source.url, { cache: "no-store" });
    if (!response.ok) throw new Error("Fact request failed");
    const payload = await response.json();
    if (requestId !== factRequestId) return;
    const fact = extractFact(animal, payload);
    if (!fact) throw new Error("Fact response was invalid");
    elements.animalFactText.textContent = fact;
    factLoaded = true;
  } catch {
    if (requestId !== factRequestId) return;
    if (!factLoaded) {
      elements.animalFactText.textContent = FACT_FALLBACK;
    }
  } finally {
    if (requestId === factRequestId) {
      elements.animalFactText.removeAttribute("aria-busy");
    }
  }
}

function applyAnimal() {
  const isCat = state.animal === "cat";
  if (elements.mascotDog) elements.mascotDog.hidden = isCat;
  if (elements.mascotCat) elements.mascotCat.hidden = !isCat;

  document.querySelectorAll('input[name="animal"]').forEach((input) => {
    input.checked = input.value === state.animal;
  });
}

function applyFactVisibility() {
  if (!elements.animalFact) return;
  elements.animalFact.hidden = !state.showAnimalFact;
  if (elements.showAnimalFact) elements.showAnimalFact.checked = state.showAnimalFact;
  if (state.showAnimalFact) fetchAnimalFact();
}

function setAnimal(animal) {
  if (!ANIMALS.includes(animal) || animal === state.animal) return;
  state.animal = animal;
  storage.write(STORAGE_KEYS.animal, state.animal);
  applyAnimal();
  if (!state.showAnimalFact || !elements.animalFactText) return;
  // The previous fact belonged to the other animal, so a failed fetch must not
  // leave the loading text stuck in place.
  factLoaded = false;
  elements.animalFactText.textContent = FACT_LOADING;
  fetchAnimalFact();
}

function createSvgIcon(symbol) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#icon-${symbol}`);
  svg.append(use);
  return svg;
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
  const faviconUrls = faviconCandidates(shortcut.url);
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
  storage.write(STORAGE_KEYS.shortcuts, state.shortcuts);
  renderShortcuts();
  showToast(`${name} removed`);
}

function openShortcutDialog() {
  elements.shortcutForm.reset();
  elements.shortcutError.textContent = "";
  elements.shortcutDialog.showModal();
  window.setTimeout(() => elements.shortcutName.focus(), 50);
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
  storage.write(STORAGE_KEYS.shortcuts, state.shortcuts);
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
    storage.write(STORAGE_KEYS.theme, state.theme);
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
    storage.write(STORAGE_KEYS.background, state.background);
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
    storage.write(STORAGE_KEYS.backgroundBlur, state.backgroundBlur);
    applyBackgroundBlur(state.backgroundBlur);
  });
}

systemTheme.addEventListener("change", () => {
  if (state.theme === "system") applyTheme();
});

elements.showShortcuts.addEventListener("change", () => {
  state.showShortcuts = elements.showShortcuts.checked;
  storage.write(STORAGE_KEYS.showShortcuts, state.showShortcuts);
  renderShortcuts();
});

// Guarded so a stale cached index.html without these controls can't abort the
// rest of this script.
if (elements.showAnimalFact) {
  elements.showAnimalFact.addEventListener("change", () => {
    state.showAnimalFact = elements.showAnimalFact.checked;
    storage.write(STORAGE_KEYS.showAnimalFact, state.showAnimalFact);
    applyFactVisibility();
  });
}

document.querySelectorAll('input[name="animal"]').forEach((input) => {
  input.addEventListener("change", () => setAnimal(input.value));
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
applyAnimal();
applyFactVisibility();

// Autofocus can be ignored by some browsers when opening a local homepage.
if (!elements.shortcutDialog.open && !elements.customizePanel.open) {
  window.setTimeout(() => elements.searchInput.focus({ preventScroll: true }), 0);
}
