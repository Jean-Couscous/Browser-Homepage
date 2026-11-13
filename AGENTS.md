# AGENTS.md

Static Kagi-themed browser start page: `index.html`, `styles.css`, `script.js`, and local images in `assets/`.

## Shape and workflow

- No package manager, build step, linter, tests, or CI. Open `index.html` directly in chromium headlessly (`file://`); never use a python/node server unless the user asks.
- `script.js` is deferred and wires everything at top level. Every element ID referenced in its `elements` map must exist in `index.html`.
- Verification is manual in a browser: theme/background/shortcut persistence across reload, dark mode, and the 640 px width / 650 px height breakpoints. Check the footer in both fact states (shown and hidden) — the customize button must stay bottom-right either way. There is no test suite to run.

## Animal modes

- `kagi-home-animal` holds `cat` or `dog`. `FACT_SOURCES` maps each mode to its API and response shape; `applyAnimal` swaps the mascot and the panel radios, and the footer refetches from the matching API. Add an animal in `ANIMALS`, `FACT_SOURCES`, and the `input[name="animal"]` radios together.
- Use Kagi's official mascot artwork — Doggo (`assets/doggo.svg`) and Katto (`assets/katto.svg`, from <https://kagi.com/assets>) — rather than drawing a replacement.
- The mascot is decorative and only the customization panel switches modes. The visible mascot must always match `state.animal`; keep both in the markup and toggle them with `hidden` instead of swapping `src`.
- `kagi-home-show-animal-fact` controls footer visibility and falls back to the legacy `kagi-home-show-cat-fact` key; no request is made while the fact is hidden.

## Persistence

- Settings live in `localStorage` under `kagi-home-*` keys, JSON-encoded through `readStorage` / `writeStorage`. A new setting needs all of: key in `STORAGE_KEYS`, a validator, a `state` default, an `apply*` function, an init call, and a change listener.
- Stored values can be stale or corrupt, so validators stay strict and invalid data falls back to defaults (`none`, `system`, `true`, 0).
- Never store search queries or history; the page is privacy-oriented and queries go only to Kagi.

## Backgrounds

- Only two keys exist: `none` and `custom`. A key must appear in both `BACKGROUND_OPTIONS` and an `input[name="background"]` radio in `index.html`; `syncBackgroundControls` keeps the radios, the tile preview, and `state.background` aligned — never set `.checked` by hand elsewhere.
- Custom images come from the user's device: `encodeBackgroundImage` downscales through a canvas (`BACKGROUND_IMAGE_ATTEMPTS`), re-encodes as WebP, and `storeBackgroundImage` saves the data URL under `kagi-home-background-image`. Keep `MAX_BACKGROUND_IMAGE_LENGTH` well under the ~5 MB local-storage quota, and surface a failed `writeStorage` as a toast instead of dropping the image silently.
- `applyBackground` sets `--background-image` plus `has-background` on `<body>`; blur is `--background-blur` applied to the `body::before` scrim. There are no remote background images, and the page must not add any.

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
