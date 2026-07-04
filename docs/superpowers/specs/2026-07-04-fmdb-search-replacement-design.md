# Design Spec: Replace IMDb Suggestions API with FM-DB for Agregarr Client

**Date:** 2026-07-04
**Author:** Mistral Vibe (with user input)
**Status:** Draft
**Related Issue:** Replace IMDb suggestions API with FM-DB API

---

## Summary

Replace the IMDb suggestions API (`v3.sg.media-imdb.com`) used by `AgregarrApiClient` for title search with the FM-DB API (`imdb.iamidiotareyoutoo.com`). The client will use FM-DB to retrieve title metadata (name, year, IMDb ID) and continue using the Agregarr API (`api.agregarr.org`) for IMDb ratings only. This creates a hybrid approach where metadata comes from FM-DB and ratings from Agregarr.

The identifier for this client remains `agregarr` throughout the codebase (class name, `ApiSource` constant, config values), but the settings UI label will display as "FM-DB + Agregarr" to reflect the dual-source nature.

---

## Goals

1. Replace IMDb suggestions API with FM-DB for title search operations
2. Maintain Agregarr for ratings lookup
3. Adapt code to FM-DB's native response format (no transformation to mimic old API)
4. Complete cleanup: remove all references to `v3.sg.media-imdb.com`
5. Update settings label to reflect the hybrid source

---

## Non-Goals

1. Do not refactor `getDetails` method signature in `BaseApiClient`
2. Do not rename class names or constants (keep `AgregarrApiClient`, `ApiSource.AGREGARR`, etc.)
3. Do not change the identifier string `'agregarr'` used in config and client selection

---

## Architecture

### Current Flow

```
AgregarrApiClient.fetch(displayTitle)
  → AgregarrApiClient.search(displayTitle) → IMDb suggestions API (v3.sg.media-imdb.com)
    → returns match { id, l, qid, y }
  → AgregarrApiClient.getDetails(match, displayTitle) → Agregarr ratings API (api.agregarr.org)
    → returns Title with rating
```

### New Flow

```
AgregarrApiClient.fetch(displayTitle)
  → AgregarrApiClient.search(displayTitle) → FM-DB API (imdb.iamidiotareyoutoo.com/search)
    → returns FM-DB result: { "#IMDB_ID": "tt...", "#TITLE": "...", "#YEAR": 2008, ... }
  → AgregarrApiClient.getDetails(match, displayTitle)
    → extracts: match["#IMDB_ID"], match["#TITLE"], match["#YEAR"]
    → calls Agregarr ratings API with IMDb ID
    → returns Title with all metadata + rating
```

### Key Design Decisions

1. **Hybrid source**: FM-DB provides title metadata; Agregarr provides ratings only
2. **Native format**: Adapt to FM-DB's response format with `#` prefixed keys; do not transform to mimic IMDb suggestions API format
3. **Missing type field**: FM-DB does not provide a type/title kind field; `Title.type` will be `null` for all results from this client
4. **Client identity preserved**: Class name remains `AgregarrApiClient`, source identifier remains `agregarr`

---

## FM-DB API Details

### Endpoint

```
GET https://imdb.iamidiotareyoutoo.com/search?q={query}
```

### Request Parameters

| Parameter | Type   | Required | Description               |
| --------- | ------ | -------- | ------------------------- |
| `q`       | string | Yes      | Search query (title name) |

### Response Format

```json
{
  "ok": true,
  "description": [
    {
      "#TITLE": "The Dark Knight",
      "#YEAR": 2008,
      "#IMDB_ID": "tt0468569",
      "#RANK": 164,
      "#ACTORS": "Christian Bale, Heath Ledger",
      "#AKA": "The Dark Knight (2008) ",
      "#IMDB_URL": "https://imdb.com/title/tt0468569",
      "#IMDB_IV": "https://IMDb.iamidiotareyoutoo.com/title/tt0468569",
      "#IMG_POSTER": "https://m.media-amazon.com/images/...",
      "photo_width": 1383,
      "photo_height": 2048
    },
    ...
  ],
  "error_code": 200
}
```

### Field Mapping

| FM-DB Field | Internal Field | Notes                                  |
| ----------- | -------------- | -------------------------------------- |
| `#IMDB_ID`  | `imdbId`       | IMDb ID (e.g., `tt0468569`)            |
| `#TITLE`    | `apiTitle`     | Canonical title from API               |
| `#YEAR`     | `year`         | Release year                           |
| (none)      | `rating`       | Fetched from Agregarr ratings API      |
| (none)      | `type`         | Always `null` (FM-DB does not provide) |

---

## File Changes

### 1. `src/core/api-clients.js`

**AgregarrApiClient class:**

- **`search(displayTitle)` method:**
    - Change endpoint from `https://v3.sg.media-imdb.com/suggestion/titles/x/{encoded}.json` to `https://imdb.iamidiotareyoutoo.com/search?q={encoded}`
    - Remove `AGREGARR_TITLE_TYPES` filter (no longer needed as FM-DB returns all types)
    - Return first result from `data.description` array (FM-DB native format)
    - Update logging to reference FM-DB instead of Agregarr for search

- **`getDetails(match, displayTitle)` method:**
    - Update extraction to use FM-DB field names: `match["#IMDB_ID"]`, `match["#TITLE"]`, `match["#YEAR"]`
    - Set `type: null` (FM-DB does not provide type information)
    - Keep Agregarr ratings API call unchanged

### 2. `src/core/rate-limits.js`

- FM-DB calls go through the same `AgregarrApiClient` queue, so no new entry needed
- The existing `[ApiSource.AGREGARR]: 250` covers both FM-DB search and Agregarr ratings calls

### 3. `src/targets/extension/domains.js`

- Remove `'v3.sg.media-imdb.com'` from `ALLOWED_DOMAINS` array
- Add `'imdb.iamidiotareyoutoo.com'` to `ALLOWED_DOMAINS` array

### 4. `src/core/config-fields.js`

- Update the `apiClient` select options label from `'Agregarr'` to `'FM-DB + Agregarr'`
- Keep the value as `'agregarr'` (identifier unchanged)

### 5. `src/targets/chrome/manifest.json`

- Remove `"https://v3.sg.media-imdb.com/*"` from `host_permissions` array
- Add `"https://imdb.iamidiotareyoutoo.com/*"` to `host_permissions` array

### 6. `src/targets/firefox/manifest.json`

- Remove `"https://v3.sg.media-imdb.com/*"` from `host_permissions` array
- Add `"https://imdb.iamidiotareyoutoo.com/*"` to `host_permissions` array

### 7. `src/targets/userscript/metadata.js`

- Remove `// @connect v3.sg.media-imdb.com`
- Add `// @connect imdb.iamidiotareyoutoo.com`

---

## Error Handling

### Search Failures

| Scenario                                | Behavior                                              |
| --------------------------------------- | ----------------------------------------------------- |
| FM-DB returns `ok: false`               | Return `null` from `search()`, logged as info         |
| FM-DB returns empty `description` array | Return `null` from `search()`, logged as info         |
| Network error to FM-DB                  | Propagated up, caught by `ApiClientManager.getData()` |

### Details Failures

| Scenario                   | Behavior                                                           |
| -------------------------- | ------------------------------------------------------------------ |
| Agregarr ratings API fails | Return `Title` with metadata but `rating: null`, logged as warning |
| Invalid IMDb ID from FM-DB | Agregarr call fails gracefully, `rating: null`                     |

### Client Disable Logic

- HTTP 4xx errors from FM-DB or Agregarr → client disabled for 1 hour via existing `disable()` mechanism
- 5xx or network errors → not auto-disabled, retry allowed on next request

---

## Testing

### Unit Tests

**File:** `tests/unit/core/api-clients.test.js`

**Updates needed:**

1. Update `AgregarrApiClient` search tests to expect FM-DB format:
    - Mock FM-DB response with `#` prefixed fields
    - Verify `search()` returns first result from `description` array
    - Test empty response handling
    - Test `ok: false` handling

2. Update `AgregarrApiClient` getDetails tests:
    - Mock match object uses FM-DB format (`{ "#IMDB_ID": "...", "#TITLE": "...", "#YEAR": ... }`)
    - Verify extraction of FM-DB fields
    - Verify `type` is `null` in returned `Title`
    - Verify rating is populated from Agregarr mock

3. Add new tests:
    - Test that `type` is `null` when not provided by FM-DB
    - Test graceful handling of missing optional fields (`#YEAR`, `#TITLE`)

### Integration Tests

**File:** `tests/integration/api-clients.test.js`

- Existing Agregarr integration tests continue to work
- They test the ratings endpoint which remains unchanged
- FM-DB search is not tested in integration tests (no API key required for FM-DB)

---

## Migration & Backward Compatibility

### Cache

- No migration needed
- Existing cache entries for `agregarr` source will naturally refresh as users browse
- Old entries referencing IMDb suggestions API will be replaced with FM-DB data

### Configuration

- No config migration needed
- Users with `apiClient: 'agregarr'` will automatically use the new hybrid flow

### Breaking Changes

- None. The change is transparent to users.
- The only user-visible change is the settings label ("FM-DB + Agregarr" instead of "Agregarr")

---

## Open Questions

None at this time. All requirements have been clarified.

---

## Success Criteria

- [ ] `AgregarrApiClient` uses FM-DB for search
- [ ] `AgregarrApiClient` uses Agregarr for ratings
- [ ] FM-DB response format is handled natively (no transformation to old format)
- [ ] `v3.sg.media-imdb.com` is completely removed from all domain allowlists
- [ ] `imdb.iamidiotareyoutoo.com` is added to all domain allowlists
- [ ] Settings label shows "FM-DB + Agregarr"
- [ ] All existing tests pass
- [ ] New tests added for FM-DB search handling
- [ ] Client identifier remains `'agregarr'` throughout codebase
