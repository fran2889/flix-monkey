/**

- SPDX-FileCopyrightText: 2026 Fran
- SPDX-License-Identifier: GPL-3.0-only
  */

# IMDb ID Override Feature Design

**Date**: 2026-09-25
**Status**: Draft
**Type**: Architectural
**Author**: Mistral Vibe (with human partner)

---

## 1. Purpose and Scope

### Purpose

Allow users to correct IMDb search mismatches by manually specifying the correct IMDb ID for a title. This addresses cases where the automatic search returns the wrong movie or show due to similar names, remakes, or regional variations.

### Scope

- Add per-title IMDb ID override storage
- Add UI trigger (✏️ emoji on hover) to set or update overrides
- Modify fetch flow to use override ID when available, bypassing search
- Add refresh trigger (↻ emoji) to re-fetch ratings without changing override

### Out of Scope

- Bulk override management UI
- Override sync across devices (handled by platform storage)
- Override import or export functionality
- Clear override functionality - overrides can only be updated, not removed

---

## 2. User Experience

### Discovery

The feature reveals itself naturally through interaction:

1. User notices an incorrect rating on a Netflix thumbnail
2. Hovers over the IMDb rating badge
3. After a one-second delay, two icons appear next to the badge:
    - ✏️ (pencil emoji in square badge) - Edit IMDb ID
    - ↻ (rightwards arrow with hook in square badge) - Refresh ratings

### Edit Override Interaction

1. User clicks the ✏️ icon
2. Browser-native prompt opens with title: "IMDb ID for [Title Name]:"
3. Prompt is pre-filled with the current override if one exists for this title
4. User pastes either:
    - An IMDb ID (e.g., `tt0133093`)
    - An IMDb URL (e.g., `https://www.imdb.com/title/tt0133093/`)
5. On submit:
    - Input is validated and IMDb ID is extracted
    - Override is stored
    - Cache for this title is cleared
    - Thumbnail is re-decorated with new ratings
6. On cancel: Dialog closes, no changes are made

### Refresh Interaction

1. User clicks the ↻ icon
2. Cache entry for this title is cleared
3. Thumbnail is re-decorated, triggering a fresh fetch:
    - If override exists: fetches by override ID
    - If no override: performs search then fetch

### Feedback

- **Success**: Badge updates with new ratings within approximately 2-3 seconds
- **Validation error**: Browser shows native alert: "Invalid IMDb ID. Must be tt followed by numbers (e.g., tt0133093)"
- **Fetch error with override**: Badge shows link icon (we have the ID, fetch failed)
- **Fetch error without override**: Badge shows search icon (🔍)

### Styling

Both ✏️ and ↻ icons are rendered inside square badges matching the existing rating badge style, with consistent background, border-radius, and padding. Icons appear horizontally aligned next to the IMDb badge.

---

## 3. Architecture

### New Component

**IdImdbIdManager**

- Responsibility: Storage-only class for per-title IMDb ID overrides
- Methods:
    - `getImdbId(displayTitle): Promise<string | null>` - Retrieve stored IMDb ID for a title
    - `setImdbId(displayTitle, imdbId): Promise<void>` - Store IMDb ID override for a title
- Storage: Uses platform adapter storage with key format `fm-imdbid:{slugifiedTitle}`
- Dependencies: PlatformAdapter

### Modified Components

1. **BaseApiClient**
    - Add `overrideManager` parameter to constructor
    - Modify `fetch(displayTitle)` method:
        - Check for override using `overrideManager.getImdbId(displayTitle)`
        - If override exists: create Title with displayTitle + override imdbId, call `getDetails()` directly
        - If no override: proceed with normal search → getDetails flow

2. **ApiClientManager**
    - Add `overrideManager` parameter to constructor
    - Pass `overrideManager` to client constructors

3. **OverlayRenderer**
    - Add hover timer and icon creation to `injectOverlay()`
    - Create ✏️ and ↻ icons in square badges on 1s hover
    - Add click handlers for both icons

4. **FlixMonkeyApp**
    - Instantiate `IdImdbIdManager` with adapter
    - Pass `overrideManager` to ApiClientManager and OverlayRenderer
    - Handle override submission: validate, store, trigger refetch
    - Handle refresh: clear cache, trigger re-decorate

5. **startApp()**
    - Create `IdImdbIdManager` instance
    - Inject into ApiClientManager

### Unchanged Components

- CacheManager
- Title
- SurfaceManager
- RequestQueue
- DisabledClientsManager

---

## 4. Data Flow

### Override Set/Update Flow

```
User hovers IMDb badge (1s)
    ↓
✏️ and ↻ icons appear
    ↓
User clicks ✏️
    ↓
Prompt opens (pre-filled if override exists)
    ↓
User submits "tt1234567" or URL
    ↓
Parse → validate → extract ID
    ↓
IdImdbIdManager.setImdbId(slugifiedTitle, imdbId)
    ↓
CacheManager.delete(slugifiedTitle)
    ↓
Trigger re-decorate for this container
    ↓
ApiClientManager.getData(displayTitle)
    ↓
Cache miss (we just cleared it)
    ↓
BaseApiClient.fetch(displayTitle)
    ↓
IdImdbIdManager.getImdbId(displayTitle) → returns imdbId
    ↓
Create Title with displayTitle + override imdbId
    ↓
client.getDetails(title)  ← Direct fetch by ID, bypass search
    ↓
Cache write
    ↓
Overlay updated with new ratings
```

### Normal Flow (No Override)

```
ApiClientManager.getData(displayTitle)
    ↓
Cache miss
    ↓
BaseApiClient.fetch(displayTitle)
    ↓
IdImdbIdManager.getImdbId(displayTitle) → null
    ↓
client.search(displayTitle)
    ↓
client.getDetails(searchResult)
    ↓
Cache write
```

### Refresh Flow

```
User clicks ↻
    ↓
CacheManager.delete(slugifiedTitle)
    ↓
Trigger re-decorate for this container
    ↓
Same flow as initial decoration:
    - If override exists: fetch by ID
    - If no override: search → fetch
```

---

## 5. Storage

### Mechanism

Platform adapter storage (same as cache and fade overrides):

- Userscript: `GM_setValue` / `GM_getValue`
- WebExtension: `browser.storage.local`

### Key Format

`fm-imdbid:{slugifiedTitle}`

- Example: `fm-imdbid:the-matrix`
- Uses the same `slugify()` utility as cache keys for consistency

### Value

IMDb ID string (e.g., `"tt0133093"`)

### Lifetime

Persistent - survives page refreshes and browser restarts. No TTL; overrides are user-set and permanent until updated.

### Future-Proofing

The `fm-imdbid:` prefix reserves the namespace for potential other ID type overrides in the future (e.g., `fm-tmdbid:`).

---

## 6. Error Handling

### Input Validation

- Prompt input must resolve to `tt` + digits pattern
- Invalid input: show browser alert "Invalid IMDb ID. Must be tt followed by numbers (e.g., tt0133093)"
- URL parsing: extract `tt\d+` from `imdb.com/title/tt1234567/` or return validation error

### Fetch Errors

- Network failure with override ID: show link icon (we have the ID, fetch failed)
- 404/Not found with override ID: show link icon (IMDb: No rating)
- Client disabled: show search icon (🔍) - fallback behavior

### Storage Errors

- Storage write failure: log error, do not retry
- Storage read failure: treat as no override, proceed with normal flow

### No Override Fallback

If `IdImdbIdManager` fails to read, treat as no override and proceed with normal search flow.

---

## 7. Testing

### Unit Tests

- `IdImdbIdManager`: get/set with various title strings including edge cases (empty, special characters, Unicode)
- ID parsing: validate extraction from `tt1234567` format and various URL formats
- `BaseApiClient.fetch()`: verify override path bypasses search, normal path uses search

### UI Tests (using fixtures)

- ✏️ and ↻ icons appear after 1s hover on IMDb badge
- Icons remain hidden before 1s hover
- Click ✏️ opens prompt with correct pre-fill behavior
- Click ↻ triggers cache clear and re-decorate
- Prompt pre-fills with existing override when present

### Integration Tests

- Override set → cache cleared → refetch uses override ID
- Override set → page refresh → override persists
- Refresh without override → refetch uses search

---

## 8. Open Questions

None at this time. All architectural decisions have been resolved through the design process.

---

## Appendix A: File Changes Summary

**New Files**:

- `src/core/id-imdbid-manager.js`

**Modified Files**:

- `src/core/api-clients.js` (BaseApiClient)
- `src/core/api-manager.js` (ApiClientManager)
- `src/core/overlay.js` (OverlayRenderer)
- `src/core/app.js` (FlixMonkeyApp, startApp)
- `src/core/ui/overlay-elements.js` (icon creation and styling)

**No Changes Required**:

- `src/core/cache.js`
- `src/core/title.js`
- `src/core/surfaces.js`
- `src/core/fade-manager.js`
- Platform adapters
- Build configuration
