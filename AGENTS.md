# AGENTS.md

Static Kagi-themed browser start page: `index.html`, `styles.css`, `script.js`, and local images in `assets/`.

## Shape and workflow

- No package manager, build step, linter, tests, or CI. Open `index.html` directly (the README targets `file://`); do not add tooling or start a server unless the user asks.
- `script.js` is deferred and wires everything at top level. Every element ID referenced in its `elements` map must exist in `index.html`.
- Verification is manual in a browser: theme/background/shortcut persistence across reload, dark mode, and the 640 px width / 650 px height breakpoints. There is no test suite to run.

## Persistence

- Settings live in `localStorage` under `kagi-home-*` keys, JSON-encoded through `readStorage` / `writeStorage`. A new setting needs all of: key in `STORAGE_KEYS`, a validator, a `state` default, an `apply*` function, an init call, and a change listener.
- Stored values can be stale or corrupt, so validators stay strict and invalid data falls back to defaults (`none`, `system`, `true`, 0).
- Never store search queries or history; the page is privacy-oriented and queries go only to Kagi.

## Backgrounds

- A background key must match in four places: the radio in `index.html` (`input[name="background"]`), its `data-background-preview` image, `BACKGROUND_OPTIONS`, and `UNSPLASH_PHOTOS`. Missing one makes the option silently fail.
- Backgrounds are remote Unsplash images. `applyBackground` sets `--background-image` plus `has-background` on `<body>`; blur is `--background-blur` applied to the `body::before` scrim.

## Theme and icons

- JS resolves "system" and writes `document.documentElement.dataset.theme` (`light` or `dark`). CSS defines light values on `:root` and overrides only dark under `:root[data-theme="dark"]` — add every new color token to both.
- Icons are inline `<symbol id="icon-*">` definitions in `index.html`, used via `<use href="#icon-*">`. Use `createSvgIcon()` for JS-generated icons.

## Shortcuts and interactions

- `MAX_SHORTCUTS` is 10. URLs are normalized to http(s), adding `https://` when no protocol is given.
- Favicons try site-hosted paths, then DuckDuckGo, with special cases for Google Maps and `music.youtube.com`; if all fail, the colored initial stays.
- `/` and Ctrl/Cmd+K focus search unless an input is active or a dialog is open; Escape closes popovers and menus. Keep this working when adding controls.
- Use native `<dialog>.showModal()`, `aria-expanded`, and `hidden` for menus/panels, matching existing markup.

## Conventions

- Plain DOM APIs only; 2-space indent, double quotes, semicolons, `"use strict"`.
- CSS follows BEM-ish `block__element--modifier` names and toggles visibility with `[hidden]`.
- Keep the README feature list in sync with behavior; `assets/preview.png` is the README screenshot and should be refreshed after visible UI changes.
