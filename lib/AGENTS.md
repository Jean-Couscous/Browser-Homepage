# AGENTS.md

`browser-libraries.js` is a classic-script bundle of the four ES modules from
[Jean-Couscous/browser-libraries](https://github.com/Jean-Couscous/browser-libraries)
v0.1.0, plus a copy of its MIT license in `LICENSE`. It is vendored instead of
imported because Chromium blocks ES module imports over `file://`, and this page
must keep opening directly from disk.

## Updating a library

- When updating the copied library, make the same change in the original
  repository first, including its README and checks. Never let this copy drift
  ahead of the source.
- Copy the changed `index.js` into the matching section of
  `browser-libraries.js`, remove the `export` keywords, and keep the code and
  comments otherwise unchanged.
- Keep the bundle a classic script: no `import`, no `export`, no build step.
- Expose only what `script.js` consumes from the `BrowserLibraries` object, and
  keep that namespace stable.
- Update the version and source URL in the file header when the original
  releases a new version.

The source modules are `json-storage/index.js`, `url-normalizer/index.js`,
`favicon-candidates/index.js`, and `image-data-url/index.js`.

There is no test runner. Open `index.html` in headless Chromium and confirm the
page loads without console errors.
