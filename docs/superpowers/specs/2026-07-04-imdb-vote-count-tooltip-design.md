# IMDb Vote Count in Tooltip Design

> **Resolves #74**

## Summary

Add IMDb vote count display to the rating overlay tooltip. The tooltip format changes from `"IMDb: 8.5 · RT: 92% · MC: 78 – click to open IMDb"` to `"IMDb: 8.5 (250k votes) - Open IMDb"`. Other ratings (RT, MC) are removed from the tooltip but remain visible as badges in the overlay UI.

## Motivation

Vote counts provide additional context for IMDb ratings, helping users gauge the reliability and popularity of a rating. This is especially useful for distinguishing between well-rated content with many votes versus niche content with fewer ratings.

## Current State

- Tooltip is built in `overlay.js` via `#buildTooltip(titleParts, imdbId)`
- Shows all available ratings: IMDb, RT, MC
- Format: `"IMDb: 8.5 · RT: 92% · MC: 78 – click to open IMDb"`
- `Title` class has `rating`, `rtRating`, `mcRating` properties but no vote count

## New Tooltip Format

```
"IMDb: 8.5 (250k votes) - Open IMDb"
```

Variations:

- With votes: `"IMDb: 8.5 (250k votes) - Open IMDb"`
- Without votes: `"IMDb: 8.5 - Open IMDb"`
- No rating, has imdbId: `"No rating - Open IMDb"`
- No rating, no imdbId: `"Not found - Search IMDb"`

## Files Changed

### `src/core/title.js`

- Add `imdbVotes` property to `Title` class (type: `number|null`)
- Add `imdbVotes` to `TitleOptions` typedef
- Update constructor to accept and normalize `imdbVotes`
- Update `fromJSON()` to handle `imdbVotes` field from cached entries
- `hasRating` getter remains unchanged (votes alone does not constitute a rating)

Normalization rules for `imdbVotes`:

- `null`, `undefined`, empty string, `"N/A"` → `null`
- Numeric strings are parsed to integers
- Non-numeric values → `null`

### `src/core/api-clients.js`

Extract `imdbVotes` from each API client's response:

| Client              | Source Field       | Extraction Logic                                                                        |
| ------------------- | ------------------ | --------------------------------------------------------------------------------------- |
| `AgregarrApiClient` | `votes`            | `entry?.votes ?? null` (already in response, not currently extracted)                   |
| `OmdbApiClient`     | `imdbVotes`        | `json.imdbVotes ? Number.parseInt(String(json.imdbVotes).replace(/,/g, ''), 10) : null` |
| `ImdbApiDevClient`  | `rating.voteCount` | `detailsJson.rating?.voteCount ?? null`                                                 |
| `XmdbApiClient`     | `vote_count`       | `detailsJson.vote_count ?? null`                                                        |

Each client passes `imdbVotes` to the `Title` constructor in its `getDetails()` method.

### `src/core/overlay.js`

- Add `#formatVoteCount(count)` helper method:
    - Returns empty string if `count` is `null` or `undefined`
    - Returns string representation for valid numbers:
        - `< 1000`: `String(Math.round(count))` (e.g., `"1234"`)
        - `< 1000000`: `${Math.round(count/1000)}k` (e.g., `"250k"`)
        - `>= 1000000`: `${Math.round(count/1000000)}M` (e.g., `"1M"`)

- Update `#buildTooltip(titleParts, imdbId)`:
    - Remove RT and MC from `titleParts` array construction
    - For IMDb rating, append formatted vote count: `"IMDb: {formattedRating}({formattedVotes})"`
    - Change suffix from `" – click to open IMDb"` to `" - Open IMDb"`

- Update `#createOverlay(titleObj)`:
    - Pass `imdbVotes` from `titleObj` to the tooltip building logic
    - RT and MC badges remain in the visual overlay (unchanged)

## Backwards Compatibility

- **Cache**: Old cache entries lack `imdbVotes`. `Title.fromJSON()` treats missing fields as `null`, so vote count simply won't display. No cache invalidation required.
- **Breaking changes**: None. The `rating` property is retained; `imdbVotes` is a new, optional field.

## Testing Strategy

### Unit Tests

- `tests/unit/core/title.test.js`:
    - Test `imdbVotes` normalization (null, numeric, string, invalid)
    - Test `fromJSON()` with and without `imdbVotes` field

- `tests/unit/core/overlay.test.js`:
    - Test `#formatVoteCount()` with edge cases (null, 0, 999, 1000, 1500, 999999, 1000000, 1500000)
    - Test `#buildTooltip()` with various combinations (rating only, rating + votes, no rating)

- `tests/unit/core/api-clients.test.js`:
    - Verify each client extracts `imdbVotes` correctly from mock responses

### UI Tests

- Existing surface discovery and injection tests continue to pass (tooltip content is not asserted in UI tests per project conventions)

### Integration Tests

- Add assertions in `tests/integration/api-clients.test.js` to verify that `imdbVotes` is populated from real API responses for each provider that supports it (Agregarr, OMDB, IMDb API Dev, XMDB)

## Verification Commands

```bash
npm run lint
npm run format
npm test
npm run build
```

## Out of Scope

- Adding vote counts for RT or MC ratings
- Adding a config toggle for vote count visibility
- Displaying vote counts in the visual badge (not just tooltip)
- Batch processing of vote counts
