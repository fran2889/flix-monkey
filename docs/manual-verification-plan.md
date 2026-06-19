# Manual Verification Plan

**Goal:** Cover all surfaces, integration points, and behavioral contracts that automated tests cannot adequately verify: live browser interactions, cross-tab coordination, platform-specific APIs, and real-world API responses.

---

## Environment Setup

1. Run `npm run build` to generate all distribution targets.
2. **Chrome**: Load `dist/chrome/` via `chrome://extensions` in developer mode.
3. **Firefox**: Load `dist/firefox/` via `about:debugging#/runtime/this-firefox`.
4. **Userscript**: Install `dist/FlixMonkey.user.js` via Tampermonkey or Violentmonkey.
5. Have valid API keys ready for each provider (XMDB, OMDB, IMDb API Dev).
6. Open DevTools (Console + Network tabs) before starting.

---

## 1. Extension Loading & Permissions

**Verifies:** manifest declarations, content script injection, background/service worker lifecycle, permissions granted at install time.

### 1.1 Chrome

- [ ] Install extension; verify no install-time permission errors.
- [ ] Navigate to `netflix.com`; verify no CSP or CORS errors in the Console.
- [ ] Click the extension icon; verify options page opens inline (not a new tab).
- [ ] Open DevTools → Application → Service Workers; verify `service-worker.js` is registered and active.
- [ ] Leave the Netflix tab idle for 10+ minutes; scroll a carousel; verify overlays still appear (service worker woke up correctly).

### 1.2 Firefox

- [ ] Install extension; verify no install-time permission errors.
- [ ] Navigate to `netflix.com`; verify no CSP or CORS errors in the Console.
- [ ] Click the extension icon; verify options page opens (in a tab per Firefox manifest).
- [ ] Verify the background script is listed as active in `about:debugging`.
- [ ] Reload the Netflix tab; verify overlays appear on the reloaded page.

### 1.3 Userscript

- [ ] Install in Tampermonkey; verify the script is listed and enabled.
- [ ] Navigate to `netflix.com`; verify no errors in the Console.
- [ ] Open the Tampermonkey menu; verify "FlixMonkey Settings", "Clear Cache", and "Reset Disabled Clients" commands are listed.

---

## 2. Settings UI

**Verifies:** form rendering, validation, save flow, reset behavior, and cross-tab config propagation.

### 2.1 Form Population & Validation

- [ ] Open the options/settings UI.
- [ ] Verify all fields are populated with their current (or default) values.
- [ ] Clear an API key field and save; verify a validation error appears below the field.
- [ ] Enter an out-of-range value for the fade threshold (e.g., `-1`, `11`, `abc`); verify a validation error.
- [ ] Enter an invalid value for a cache TTL field; verify a validation error.
- [ ] Fill all required fields correctly and save; verify a "Saved!" (green) status message.
- [ ] Verify the Save button is disabled during save and re-enabled after.

### 2.2 Action Buttons

- [ ] Click "Clear Cache"; verify a confirmation dialog appears; confirm and verify cache is cleared (reload Netflix and confirm API requests fire for previously cached titles).
- [ ] Trigger a disabled API client (e.g., configure an invalid key, browse Netflix to generate 4xx errors, then open settings); verify "Reset Disabled Clients" button re-enables the client.

### 2.3 Cross-Tab Config Sync (Extensions Only)

- [ ] Open three Netflix tabs.
- [ ] In tab 1, change the overlay corner to a different position and save.
- [ ] Verify tabs 2 and 3 update their overlay positions **without a page reload** (within ~1 second).
- [ ] In tab 1, toggle the fade effect; verify tabs 2 and 3 reflect the change.

### 2.4 Userscript Save & Reload

- [ ] Open the FlixMonkey Settings modal via the Tampermonkey menu.
- [ ] Change a setting and save.
- [ ] Verify the page reloads automatically.
- [ ] Verify the changed setting persists after reload.
- [ ] Press Escape while the modal is open; verify the modal closes.

---

## 3. Overlay Rendering: UI Surfaces

**Verifies:** DOM injection, positioning, visual correctness, and deduplication across all Netflix surfaces.

Netflix's UI surfaces are decorated in priority order: title card → standard card → bob → preview modal → jaw bone. Only the first matched surface per title is decorated.

### 3.1 Browse Page: Title Cards

- [ ] Navigate to the Netflix browse page.
- [ ] Verify rating overlays appear on carousel title card thumbnails.
- [ ] Inspect an overlay element; verify it has class `fm-rating-overlay` and the container has `data-fm-injected="1"`.
- [ ] Verify the overlay is visually correct: dark semi-transparent background, IMDb label in gold, RT in red, MC in cyan.
- [ ] Click an IMDb badge; verify `imdb.com` opens in a new tab and Netflix does not navigate.

### 3.2 Overlay Positions

Test all four positions via the settings overlay corner option:

- [ ] **Top-left**: overlay appears at top-left of the thumbnail; no clipping.
- [ ] **Top-right**: overlay appears at top-right; no clipping.
- [ ] **Bottom-left**: overlay appears at bottom-left; no clipping.
- [ ] **Bottom-right**: overlay appears at bottom-right; no clipping.

### 3.3 Top 10 Badges

Netflix Top 10 carousels render a large badge on the left side of tiles. For left-corner overlay positions, the overlay must shift right to avoid collision.

- [ ] Find a Top 10 carousel.
- [ ] Set overlay corner to bottom-left (or top-left).
- [ ] Verify the overlay shifts right and does not overlap the Top 10 badge.
- [ ] Set overlay corner to bottom-right; verify no shift occurs (right-side corners are unaffected).

### 3.4 Fade Effect

- [ ] Enable the fade effect in settings; set the threshold to `7.0`.
- [ ] Browse carousels and find titles with ratings below 7.0; verify those thumbnails are faded (~30% opacity).
- [ ] Verify titles with ratings ≥ 7.0 are not faded.
- [ ] Hover over a faded thumbnail; verify it returns to full opacity during hover.
- [ ] Set threshold to `5.0`; verify fewer titles are faded.

### 3.5 Search Results

- [ ] Use Netflix search and search for a known title.
- [ ] Verify an overlay appears on the search result thumbnail.
- [ ] Navigate away from search; verify overlays appear on the browse page (not duplicated from search).

### 3.6 Preview Modal (Bob)

- [ ] Hover over a tile until the preview modal expands.
- [ ] Verify an overlay appears within the preview modal.
- [ ] Verify the overlay is **not** faded in the preview modal even if fade is enabled.

### 3.7 Detail View (Jaw Bone)

- [ ] Click a title tile to open its detail view (jaw bone).
- [ ] Verify an overlay appears within the detail view.
- [ ] Verify the overlay is **not** faded in the detail view.

### 3.8 Loading State

- [ ] Throttle the network to "Slow 3G" in DevTools.
- [ ] Scroll a carousel; verify tiles briefly show `IMDb ⏳` (loading placeholder).
- [ ] Verify the loading placeholder is replaced by the real rating badge (not stuck).
- [ ] Restore network speed.

### 3.9 Deduplication

- [ ] Inspect the same title that appears in multiple carousels or surfaces.
- [ ] Verify only one surface receives an overlay (priority order enforced).
- [ ] Verify the overlay container has `data-fm-injected="1"` and no duplicate overlays are injected.

---

## 4. API Integration

**Verifies:** end-to-end data flow from Netflix DOM → request queue → fetch proxy → external API → overlay.

### 4.1 XMDB API Client

- [ ] Select XMDB as the API provider in settings; enter a valid XMDB API key.
- [ ] Browse Netflix; verify rating overlays appear with IMDb scores.
- [ ] In DevTools Network tab, verify requests go to `xmdbapi.com`.
- [ ] Enter an invalid API key and browse; verify no overlays appear and no console errors crash the extension.
- [ ] After the client is disabled (following a 4xx error), use "Reset Disabled Clients" to re-enable; verify overlays start appearing again.

### 4.2 OMDB API Client

- [ ] Select OMDB as the provider; enter a valid OMDB API key.
- [ ] Browse Netflix; verify IMDb, MC, and RT ratings appear (OMDB returns all three).
- [ ] Verify requests go to `www.omdbapi.com` in the Network tab.
- [ ] Enter an invalid key; verify the client disables gracefully.

### 4.3 IMDb API Dev Client

- [ ] Select IMDb API Dev as the provider (no API key required).
- [ ] Browse Netflix; verify IMDb and MC ratings appear.
- [ ] Verify requests go to `api.imdbapi.dev` in the Network tab.

### 4.4 Title Matching

- [ ] Search for a title with special characters: e.g., "Spider-Man: Far From Home".
- [ ] Verify the correct title is matched (not a different movie).
- [ ] Search for a non-existent or very obscure title.
- [ ] Verify the overlay shows "N/A" (not an error crash).
- [ ] Test a title with a year ambiguity: "The Office" (multiple versions); verify the correct year is used.

### 4.5 Fetch Proxy Security (Extensions)

The background script validates that only whitelisted API domains can be proxied.

- [ ] In the Netflix page console, try sending a message to fetch a non-whitelisted domain:
    ```js
    chrome.runtime.sendMessage({ type: 'FM_FETCH', url: 'https://example.com/test' });
    ```
- [ ] Verify the request is rejected with a "Domain not allowed" error (check the console or the promise rejection).
- [ ] Try sending an invalid URL:
    ```js
    chrome.runtime.sendMessage({ type: 'FM_FETCH', url: 'javascript://alert(1)' });
    ```
- [ ] Verify rejection with an "Invalid URL" error.

---

## 5. Request Queue & Rate Limiting

**Verifies:** per-provider rate limits are enforced and cross-tab coordination works for XMDB.

### 5.1 Single-Tab Rate Limiting

- [ ] Select OMDB (250ms limit); open Netflix; scroll rapidly through 10+ tiles.
- [ ] In DevTools Network tab, verify requests to `omdbapi.com` are spaced at least ~250ms apart.
- [ ] Switch to XMDB (1500ms limit); repeat; verify requests are spaced at least ~1500ms apart.

### 5.2 Cross-Tab Rate Limiting (XMDB)

- [ ] Select XMDB; open three Netflix tabs simultaneously.
- [ ] Scroll rapidly in all three tabs at the same time.
- [ ] In each tab's Network tab, verify XMDB requests across all three tabs are collectively spaced ~1500ms apart (the shared `fm_last_req` key is coordinating them).
- [ ] Verify OMDB and IMDb API Dev are **not** globally rate-limited (each tab operates independently).

### 5.3 Queue Recovery After Idle

- [ ] Leave a Netflix tab idle for 5+ minutes.
- [ ] Scroll a carousel; verify overlays still load (queue resumes correctly; rate limit timestamp does not block requests indefinitely).

---

## 6. Cache Behavior

**Verifies:** cache hit/miss logic, TTL enforcement, and slug generation.

### 6.1 Cache Hit

- [ ] Browse Netflix and load overlays for a carousel.
- [ ] Reload the page; verify overlays appear significantly faster (served from cache, no API requests in the Network tab).

### 6.2 Cache Miss After Clearing

- [ ] Use "Clear Cache" in settings.
- [ ] Reload Netflix; verify API requests fire again for previously cached titles.

### 6.3 Cache Key Slug Generation

- [ ] Find a title with special characters or punctuation: e.g., "Spider-Man: Far From Home".
- [ ] Load the overlay; reload the page.
- [ ] Verify the overlay appears from cache (slug generation is consistent across page loads).
- [ ] Optionally inspect `browser.storage.local` in DevTools to verify the key follows the `fmc:spider_man_far_from_home` pattern.

### 6.4 Corrupt Cache Entry Handling

- [ ] In the extension's storage context (DevTools → Application → Local Storage or `chrome.storage.local`), manually insert a corrupt entry:
    ```js
    chrome.storage.local.set({ 'fmc:corrupt_title_2000': 'not_valid_json' });
    ```
- [ ] Search for "Corrupt Title" on Netflix (or any title whose slug would match).
- [ ] Verify the extension handles the corrupt entry gracefully (falls back to API, no crash).

---

## 7. Chrome vs. Firefox Behavioral Differences

**Verifies:** platform-specific message passing, service worker lifecycle, and options page behavior.

### 7.1 Chrome Service Worker Lifecycle

- [ ] Verify the service worker is listed as active in DevTools → Application → Service Workers.
- [ ] Use DevTools to force the service worker to stop (`Stop` button).
- [ ] Scroll a Netflix carousel; verify the service worker restarts and requests are proxied.
- [ ] After 10 minutes of inactivity, verify the service worker unloads; browse Netflix and verify it restarts and handles the request.

### 7.2 Firefox Async Message Handling

- [ ] On Firefox, browse Netflix and trigger overlays for 10+ titles.
- [ ] Verify no message timeout errors in the Firefox extension console.
- [ ] Verify responses arrive for all tiles (none silently dropped).

### 7.3 Options Page Behavior

- [ ] **Chrome**: Clicking the extension icon should open options **inline** (within the toolbar popup or as an embedded page), not in a separate tab.
- [ ] **Firefox**: Clicking the extension icon should open options **in a new tab**.
- [ ] Both: Verify settings saved in the options page are immediately reflected in open Netflix tabs.

---

## 8. Userscript-Specific Behaviors

**Verifies:** GM API integration, modal UI, and menu commands.

- [ ] Open the "FlixMonkey Settings" menu command; verify the settings modal opens centered on the page.
- [ ] Verify the modal is accessible: Tab cycles through fields; Escape closes without saving.
- [ ] Change a setting and save; verify the page reloads and the setting persists.
- [ ] Open "Clear Cache" from the menu; verify cache is cleared (subsequent overlay loads trigger API requests).
- [ ] Open "Reset Disabled Clients" from the menu; verify disabled API clients are re-enabled.
- [ ] Test with Tampermonkey; then reinstall under Violentmonkey; verify all functionality works in both.

---

## 9. Edge Cases

**Verifies:** resilience to unusual titles, network conditions, and UI state.

### 9.1 Unusual Titles

- [ ] Titles with non-ASCII characters: "La Casa de Papel", "Børn".
- [ ] Titles with year disambiguation: "The Office (2001)" vs "The Office (2005)".
- [ ] Very long titles: verify the overlay badge does not overflow its container.
- [ ] Titles with no API match: verify "N/A" is displayed gracefully.

### 9.2 Rapid Navigation

- [ ] Rapidly browse forward and back through Netflix rows for 30 seconds.
- [ ] Verify no zombie overlays are left on tiles (no duplicates with `data-fm-injected` on the same container).
- [ ] Verify no console errors or unhandled promise rejections.

### 9.3 Netflix UI Changes (Graceful Degradation)

- [ ] Inspect the Netflix page DOM; if Netflix has updated selectors (e.g., `.title-card` no longer exists), verify the extension degrades silently (no overlays, no console crashes).

### 9.4 MC/RT Toggle

- [ ] In settings, disable the "Show Rotten Tomatoes" option; save.
- [ ] Verify RT score is no longer shown in overlays.
- [ ] Disable MC; verify MC score is no longer shown.
- [ ] Re-enable both; verify all scores return.

### 9.5 Debug Logging

- [ ] Enable "Debug Logging" in settings.
- [ ] Browse Netflix; verify the browser Console shows verbose FlixMonkey log output.
- [ ] Disable "Debug Logging"; verify logs disappear.

---

## Estimated Effort

| Session                         | Scope                                 | Time         |
| ------------------------------- | ------------------------------------- | ------------ |
| Extension install & loading     | Chrome + Firefox + userscript         | 30 min       |
| UI surfaces & overlay rendering | All Netflix surfaces, positions, fade | 45 min       |
| API integration & fallback      | XMDB, OMDB, IMDb API Dev, security    | 60 min       |
| Rate limiting & multi-tab       | Cross-tab coordination                | 30 min       |
| Cache behavior                  | Hit/miss, TTL, slugs                  | 20 min       |
| Settings UI                     | Validation, save, sync                | 20 min       |
| Platform-specific behaviors     | Chrome vs Firefox differences         | 20 min       |
| Userscript behaviors            | GM APIs, modal, menu commands         | 20 min       |
| Edge cases                      | Unusual titles, rapid nav             | 20 min       |
| **Total**                       |                                       | **~4 hours** |
