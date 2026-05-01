# Multi-Target Build: Userscript + Firefox Addon + Chrome Extension

**Date:** 2026-05-01
**Status:** Approved

## Goal

Refactor FlixMonkey from a single-file Tampermonkey userscript into three
distribution targets built from shared source:

1. Greasemonkey/Tampermonkey/Violentmonkey userscript (existing behaviour preserved)
2. Firefox WebExtension (MV3)
3. Chrome Extension (MV3)

All three targets must be feature-equivalent. TypeScript is explicitly out of
scope for this refactor.

---

## Section 1: Directory Structure & Build Pipeline

```
src/
  core/
    constants.js          — DAYS_TO_MS, HTTP_TIMEOUT, ApiSource, RATE_LIMITS, USER_AGENTS
    title.js              — Title class (pure, no platform deps)
    cache.js              — CacheManager (async, takes adapter)
    request-queue.js      — RequestQueue (async, takes adapter)
    disabled-clients.js   — DisabledClientsManager (async, takes adapter)
    api-clients.js        — BaseApiClient + XmdbApiClient, OmdbApiClient, ImdbApiDevClient
    api-manager.js        — ApiClientManager
    overlay.js            — OverlayRenderer
    surfaces.js           — SurfaceManager
    app.js                — FlixMonkeyApp
    config.js             — CONFIG object + initConfig()
    config-fields.js      — shared field definitions (labels, types, defaults)

  platform/
    adapter.js            — PlatformAdapter base class
    userscript.js         — UserscriptAdapter (GM_* implementations)
    webextension.js       — WebExtensionAdapter (browser.storage + sendMessage)

  targets/
    userscript/
      entry.js            — GM_config wiring, GM_registerMenuCommand, startApp()
    firefox/
      manifest.json       — MV3, background.scripts
      content.js          — entry: new WebExtensionAdapter(), initConfig(), startApp()
      background.js       — HTTP proxy (~30 lines)
      options.html        — settings page (Netflix dark theme)
      options.js          — reads/writes browser.storage.local
    chrome/
      manifest.json       — MV3, background.service_worker
      content.js          — identical to firefox/content.js
      service-worker.js   — identical logic to background.js
      options.html        — identical to firefox/options.html
      options.js          — identical to firefox/options.js

dist/                     — gitignored
  FlixMonkey.user.js
  firefox/
    manifest.json
    content.js            ← bundled by Rollup
    background.js         ← copied as-is
    options.html          ← copied
    options.js            ← copied
  chrome/
    manifest.json
    content.js            ← bundled by Rollup
    service-worker.js     ← copied as-is
    options.html          ← copied
    options.js            ← copied
```

### Build scripts

```
npm run build:userscript  → dist/FlixMonkey.user.js
npm run build:firefox     → dist/firefox/
npm run build:chrome      → dist/chrome/
npm run build             → all three
```

Rollup config: single `rollup.config.js` exporting three configurations.

- **Userscript:** IIFE output, `UserscriptAdapter` bundled in, `webextension-polyfill`
  excluded. `==UserScript==` header injected as a Rollup `banner`.
- **Firefox/Chrome:** ESM or IIFE content script bundle with `webextension-polyfill`
  inlined. Background/service-worker scripts are copied as-is (no imports).

**Version:** A small Rollup plugin reads `"version"` from `package.json` and
injects it into the userscript `@version` banner and both `manifest.json` files
at build time. `package.json` is the single source of version truth.

**New dev dependencies:** `rollup`, `@rollup/plugin-node-resolve`,
`@rollup/plugin-commonjs`, `webextension-polyfill`.

---

## Section 2: Platform Adapter Layer

### Interface (`src/platform/adapter.js`)

```js
export class PlatformAdapter {
  async storageGet(key)         { throw new Error('Not implemented'); }
  async storageSet(key, value)  { throw new Error('Not implemented'); }
  async httpFetch(url, options)  { throw new Error('Not implemented'); }
  registerMenuCommand(label, fn) {}  // noop default
}
```

### UserscriptAdapter (`src/platform/userscript.js`)

- `storageGet` / `storageSet`: wrap synchronous `GM_getValue` / `GM_setValue` in
  `Promise.resolve()`.
- `httpFetch`: the existing `gmFetch()` body moved here verbatim.
- `registerMenuCommand`: calls `GM_registerMenuCommand`.

### WebExtensionAdapter (`src/platform/webextension.js`)

- `storageGet`: `await browser.storage.local.get(key)` → returns `result[key] ?? null`.
- `storageSet`: `await browser.storage.local.set({ [key]: value })`.
- `httpFetch`: `await browser.runtime.sendMessage({ type: 'FM_FETCH', url, options })`.
  Throws if `response.error` is set.
- `registerMenuCommand`: noop (extensions use the options page).

`webextension-polyfill` is bundled into the extension content scripts so both
Firefox and Chrome use `browser.*` uniformly. The adapter never branches on
browser.

### Background HTTP proxy

Both `background.js` (Firefox) and `service-worker.js` (Chrome) are identical:

- Listen for `{ type: 'FM_FETCH', url, options }` messages.
- Perform `fetch(url)` with a random `User-Agent` header. `USER_AGENTS` is
  inlined here — background scripts have no module imports and are copied as-is.
- Return `{ data }` on success or `{ error, status }` on failure.
- Do not implement business logic — 4xx → disable-client decisions stay in
  `BaseApiClient`, which reads the error and status from the response object.

---

## Section 3: Core Async Migration

Classes that currently call `GM_getValue`/`GM_setValue` synchronously must
become async and accept an `adapter` in their constructor.

### `CacheManager`

- Constructor takes `adapter`.
- `#loadCacheData()` becomes `async`; `GM_getValue` → `await this.#adapter.storageGet(...)`.
- `read()` and `write()` become `async`.
- `clear()` becomes `async`; `GM_setValue` → `await this.#adapter.storageSet(...)`.
- All callers are already in async methods — add `await` at call sites.

### `RequestQueue`

- Constructor takes `adapter`.
- Two lines in `#process()` using `GM_getValue`/`GM_setValue` for cross-tab rate
  limit sync become `await this.#adapter.storageGet(...)` /
  `await this.#adapter.storageSet(...)`.
- Rest of the class is unchanged.

### `DisabledClientsManager`

- Constructor takes `adapter`.
- `isDisabled()`, `disable()`, and `resetAll()` become `async`.
- Three `GM_getValue`/`GM_setValue` call sites are straight swaps.

### `BaseApiClient`

- Constructor takes `adapter`; passes it down to `RequestQueue` and
  `DisabledClientsManager`.
- `gmFetch()` is removed; replaced by `this.#adapter.httpFetch()`.
- `isDisabled` getter becomes `async isDisabled()` method (JS does not support
  async getters); all call sites updated to `await client.isDisabled()`.

### Unchanged

`Title`, `OverlayRenderer`, `SurfaceManager` — already pure and platform-agnostic.
No changes required.

### Adapter threading

`startApp()` constructs the adapter and passes it into `CacheManager`,
`DisabledClientsManager`, and `ApiClientManager`. Adapter flows top-down from
the entry point only — no class reaches for a global.

---

## Section 4: Config & Settings System

### Shared field definitions (`src/core/config-fields.js`)

A single exported array/object listing every setting: key, label, type, default,
description. Both `GM_config.init()` (userscript) and the options page form
(extensions) are generated from this. No duplication of labels or defaults.

### Config access in core (`src/core/config.js`)

`CONFIG` object and `configGet()` move here. The `configGet` implementation is
injected at startup via `initConfig(getterFn)` before `startApp()` runs:

```js
let _configGet = (key, fallback) => fallback;

export function initConfig(getterFn) {
  _configGet = getterFn;
}

export const CONFIG = {
  get omdbApiKey() { return _configGet('omdbApiKey', 'YOUR_OMDB_API_KEY'); },
  // ... all existing getters unchanged
};
```

### Userscript entry point

```js
// GM_config.init fires its `init` event once values are loaded from GM storage.
GM_config.init({
  fields: buildGmConfigFields(CONFIG_FIELDS),  // generated from config-fields.js
  events: {
    init: () => {
      initConfig((key, fallback) => { try { return GM_config.get(key); } catch { return fallback; } });
      startApp(adapter);
    },
  },
});
```

### Extension entry point

```js
const stored = await browser.storage.local.get(null);
initConfig((key, fallback) => stored[key] ?? fallback);
browser.storage.onChanged.addListener(changes => {
  Object.entries(changes).forEach(([k, v]) => { stored[k] = v.newValue; });
});
startApp(adapter);
```

Config changes from the options page propagate to open tabs immediately via
`storage.onChanged` — no reload required.

### Options page

- `options.html`: styled HTML form (Netflix dark theme), visually equivalent to the
  current `GM_config` dialog. Generated from `CONFIG_FIELDS`.
- `options.js`: reads `browser.storage.local` on load, writes on save.
- Three action buttons replacing `GM_registerMenuCommand`: **Save**, **Clear Cache**,
  **Reset Disabled Clients**. Core logic behind each is unchanged.
- Firefox and Chrome share identical `options.html` and `options.js`.

---

## Section 5: Extension Manifests & Build Artifacts

### Manifest differences

| Key | Firefox | Chrome |
|---|---|---|
| `background` | `{ "scripts": ["background.js"] }` | `{ "service_worker": "service-worker.js" }` |
| `browser_specific_settings` | `{ "gecko": { "id": "flixmonkey@fran" } }` | omitted |

All other keys are identical: `manifest_version: 3`, `permissions: ["storage"]`,
`host_permissions` covering the three API domains + Netflix,
`content_scripts: [{ matches: ["*://*.netflix.com/*"], js: ["content.js"] }]`,
`options_ui: { "page": "options.html" }`.

### `host_permissions`

```json
[
  "https://www.netflix.com/*",
  "https://xmdbapi.com/*",
  "https://www.omdbapi.com/*",
  "https://api.imdbapi.dev/*"
]
```

### Linting

ESLint `sourceType: 'script'` applies to the built userscript output only.
Source files in `src/` use `sourceType: 'module'`. The ESLint flat config is
updated to handle both.

---

## Out of Scope

- TypeScript migration (separate effort after this refactor stabilises)
- Publishing to Chrome Web Store or Firefox Add-ons (manual step)
- Test suite (project has none; not introduced here)
