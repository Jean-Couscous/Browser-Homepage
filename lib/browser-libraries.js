/*
 * Classic-script bundle of Jean-Couscous/browser-libraries v0.1.0.
 * https://github.com/Jean-Couscous/browser-libraries
 *
 * Keep this file free of import/export so index.html can run from file://.
 * See AGENTS.md in this folder before updating the copied libraries.
 */

// deno-lint-ignore no-unused-vars -- Classic-script global consumed by script.js.
const BrowserLibraries = (() => {
  "use strict";

  // json-storage/index.js

  /**
   * JSON-aware wrapper around a synchronous Web Storage backend.
   *
   * Every operation is guarded: a missing backend, a disabled storage area, a
   * full quota, or corrupt JSON degrades to the caller's fallback instead of
   * throwing. That keeps pages usable when storage is restricted.
   */

  function resolveDefaultStorage() {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      // Some privacy modes throw on the property access itself.
      return null;
    }
  }

  /**
   * @param {object} [options]
   * @param {Storage|null} [options.storage] Backend to use; defaults to localStorage.
   * @param {string} [options.prefix] Prepended to every key, e.g. "my-app-".
   * @returns {{ read: (key: string, fallback: unknown) => unknown, write: (key: string, value: unknown) => boolean, remove: (key: string) => boolean }}
   */
  function createJsonStorage(
    { storage = resolveDefaultStorage(), prefix = "" } = {},
  ) {
    const resolveKey = (key) => `${prefix}${key}`;

    /**
     * Read and parse a value. Missing keys, invalid JSON, and storage failures
     * all return `fallback` unchanged.
     */
    function read(key, fallback) {
      if (!storage) return fallback;
      try {
        const value = storage.getItem(resolveKey(key));
        return value === null ? fallback : JSON.parse(value);
      } catch {
        return fallback;
      }
    }

    /**
     * Serialize and persist a value. Returns false when the backend is missing,
     * the value cannot be serialized, or the write is rejected (e.g. quota).
     */
    function write(key, value) {
      if (!storage) return false;
      try {
        storage.setItem(resolveKey(key), JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    }

    /** Delete a key. Returns false when the backend is missing or rejects it. */
    function remove(key) {
      if (!storage) return false;
      try {
        storage.removeItem(resolveKey(key));
        return true;
      } catch {
        return false;
      }
    }

    return { read, write, remove };
  }

  // url-normalizer/index.js

  /**
   * Normalize user-typed addresses into http(s) URLs.
   */

  /**
   * Turn user input such as "example.com" into a normalized http(s) URL.
   *
   * @param {string} value
   * @param {object} [options]
   * @param {boolean} [options.requireDot] Reject hostnames without a dot
   *   ("localhost", intranet names). Defaults to true.
   * @returns {string} `URL.href` of the normalized address.
   * @throws {TypeError} When the input is not a usable web address.
   */
  function normalizeUrl(value, { requireDot = true } = {}) {
    const trimmed = String(value).trim();
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(withProtocol);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      (requireDot && !url.hostname.includes("."))
    ) {
      throw new TypeError(`Not a web address: ${value}`);
    }
    return url.href;
  }

  // favicon-candidates/index.js

  /**
   * Build an ordered fallback chain of favicon URLs for a page.
   */

  const FAVICON_PATHS = [
    "/favicon.svg",
    "/favicon.png",
    "/favicon.ico",
    "/apple-touch-icon.png",
  ];

  // Product icons are higher quality than a site's generic root favicon.
  const PRODUCT_FAVICONS = [
    {
      matches: (url) =>
        url.hostname === "maps.google.com" ||
        (["google.com", "www.google.com"].includes(url.hostname) &&
          url.pathname.startsWith("/maps")),
      url:
        "https://www.google.com/images/branding/product/ico/maps15_bnuw3a_32dp.ico",
    },
    {
      matches: (url) => url.hostname === "music.youtube.com",
      url: "https://music.youtube.com/img/favicon_144.png",
    },
  ];

  /**
   * Ordered, de-duplicated favicon URLs to try for a page.
   *
   * Site-hosted icons come first, then the DuckDuckGo icon service as a
   * fallback that covers sites without their own favicon. Google Maps and
   * YouTube Music get their official product icon ahead of the generics.
   *
   * @param {string|URL} value Absolute URL (or URL object) of the page.
   * @returns {string[]} Candidate URLs, best first.
   */
  function faviconCandidates(value) {
    const url = value instanceof URL ? value : new URL(value);

    const candidates = PRODUCT_FAVICONS
      .filter(({ matches }) => matches(url))
      .map(({ url: productUrl }) => productUrl);

    candidates.push(
      ...FAVICON_PATHS.map((path) => new URL(path, url).href),
      `https://icons.duckduckgo.com/ip3/${
        encodeURIComponent(url.hostname)
      }.ico`,
    );

    return [...new Set(candidates)];
  }

  // image-data-url/index.js

  /**
   * Client-side image downscaling and encoding, for photos that must fit in
   * localStorage. Nothing is uploaded; the file is decoded and re-encoded in
   * the browser.
   */

  /**
   * Each attempt downscales further and lowers quality, so the resulting data
   * URL fits a smaller storage budget. Stop at the first one that fits.
   */
  const DEFAULT_IMAGE_ATTEMPTS = Object.freeze([
    { width: 2560, height: 1440, quality: 0.82 },
    { width: 1920, height: 1080, quality: 0.78 },
    { width: 1440, height: 900, quality: 0.74 },
    { width: 1024, height: 640, quality: 0.7 },
  ]);

  /** Error with a stable `code`: "type", "read", "encode", or "large". */
  class ImageError extends Error {
    /**
     * @param {"type"|"read"|"encode"|"large"} code
     * @param {string} message
     * @param {ErrorOptions} [options]
     */
    constructor(code, message, options) {
      super(message, options);
      this.name = "ImageError";
      this.code = code;
    }
  }

  /**
   * Largest size that fits the given bounds without ever upscaling.
   *
   * @param {number} width Natural width in pixels.
   * @param {number} height Natural height in pixels.
   * @param {number} maxWidth
   * @param {number} maxHeight
   * @returns {{ width: number, height: number }}
   */
  function fitImage(width, height, maxWidth, maxHeight) {
    const scale = Math.min(1, maxWidth / width, maxHeight / height);
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    };
  }

  /**
   * Decode a File or Blob into an HTMLImageElement via an object URL.
   *
   * @param {Blob} file
   * @returns {Promise<HTMLImageElement>}
   * @throws {ImageError} With code "read" when the image cannot be decoded.
   */
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        if (!image.naturalWidth || !image.naturalHeight) {
          reject(
            new ImageError("read", "The image has no readable dimensions."),
          );
          return;
        }
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new ImageError("read", "The image could not be decoded."));
      };
      image.src = objectUrl;
    });
  }

  /**
   * Draw a decoded image on a canvas once per attempt until the encoded data
   * URL fits `maxLength`.
   *
   * @param {HTMLImageElement} image Already decoded image.
   * @param {object} [options]
   * @param {ReadonlyArray<{width: number, height: number, quality?: number}>} [options.attempts]
   * @param {string} [options.mimeType] Encoding format. Defaults to "image/webp".
   * @param {number} [options.maxLength] Maximum data URL length in characters,
   *   matching what the storage quota can hold. Defaults to Infinity.
   * @returns {string|null} Data URL, or null when no attempt fits.
   * @throws {ImageError} With code "encode" when the canvas cannot produce one.
   */
  function encodeImage(
    image,
    {
      attempts = DEFAULT_IMAGE_ATTEMPTS,
      mimeType = "image/webp",
      maxLength = Infinity,
    } = {},
  ) {
    for (const attempt of attempts) {
      const size = fitImage(
        image.naturalWidth,
        image.naturalHeight,
        attempt.width,
        attempt.height,
      );
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;

      const context = canvas.getContext("2d");
      if (!context) {
        throw new ImageError("encode", "A 2D canvas context is unavailable.");
      }
      context.drawImage(image, 0, 0, size.width, size.height);

      let dataUrl;
      try {
        dataUrl = canvas.toDataURL(mimeType, attempt.quality);
      } catch (error) {
        throw new ImageError("encode", "The image could not be encoded.", {
          cause: error,
        });
      }

      // A canvas that is too large yields "data:," rather than an image.
      if (dataUrl.startsWith("data:image/") && dataUrl.length <= maxLength) {
        return dataUrl;
      }
    }
    return null;
  }

  /**
   * Decode, downscale, and encode a user-picked image in one call.
   *
   * @param {File|Blob} file
   * @param {object} [options]
   * @param {ReadonlyArray<{width: number, height: number, quality?: number}>} [options.attempts]
   * @param {string} [options.mimeType]
   * @param {number} [options.maxLength]
   * @returns {Promise<string>} Data URL of the encoded image.
   * @throws {ImageError} With code "type", "read", "encode", or "large".
   */
  async function imageFileToDataUrl(file, options = {}) {
    if (
      !file || typeof file.type !== "string" || !file.type.startsWith("image/")
    ) {
      throw new ImageError("type", "The selected file is not an image.");
    }

    const image = await loadImage(file);
    const dataUrl = encodeImage(image, options);
    if (!dataUrl) {
      throw new ImageError(
        "large",
        "The image is too large to encode within the size limit.",
      );
    }
    return dataUrl;
  }

  return {
    createJsonStorage,
    normalizeUrl,
    faviconCandidates,
    imageFileToDataUrl,
    ImageError,
  };
})();
