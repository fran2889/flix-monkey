# API response parsing: throw ParseError from a single request path

**Date:** 2026-11-03

**Status:** accepted

**Size:** small change

## Intent

Replace the `Decoded<T>` result object in the API response parsers with a
throwing `ParseError` model, and make parsing part of the single request entry
point. Validation then has one failure path, one log point, and far fewer
per-field checks.

## Context

The branch `refactor/decode-api-responses` added `decode-utils.ts` with
`Decoded<T>` (`{ ok: true; value: T } | { ok: false }`), `isRecord`, and
`read*` helpers. Each client fetches raw JSON, calls a decoder, and logs a
warning when the decoder returns `undefined`.

Three problems remain:

- `{ ok: false }` carries no reason, so the log cannot say which field failed.
- There are about 30 `if (!x.ok) return undefined` checks across the three
  clients.
- Fetch and parse are separate calls, so a future client can skip validation.

This design also adopts one vocabulary. The module becomes `parse-utils.ts`,
the field readers lose their `read` prefix, the client functions become
`parse*`, and the request method becomes `fetchParsed`. The branch name and
commit history keep the old `decode` wording.

## Goals

- One failure model: readers throw `ParseError`; only `parseValidItems` and
  `fetchParsed` catch it.
- One public HTTP entry point per client: `fetchParsed`.
- Malformed responses log once, with provider context, the raw body, and the
  field message.
- Valid but empty or not-found payloads keep their existing no-results logs
  and are never reported as malformed.
- Valid payloads produce the same `Title` values as before for the wire
  shapes the parsers accept. OMDb rating entries are narrowed to the
  capitalized `Source` and `Value` keys.

## Non-goals

- No schema library (Zod, Valibot) and no new dependency.
- No change to endpoints, rate limits, queue scheduling, cache, or
  `ApiClientManager`.
- No change to `Title` or the public `ApiClient` interface.
- No raw HTTP escape hatch for subclasses.
- No new feature behavior.

## Anti-goals

- Swallowing programmer errors as malformed responses.
- Logging one malformed response twice.
- Treating an expected not-found payload as an exception.
- Keeping both `queuedFetch` and `fetchParsed` as public request paths.

## Constraints

- `strict` and `exactOptionalPropertyTypes` are enabled. Optional fields that
  are always written need `| undefined`.
- ESLint complexity is capped at 10. Flattening the parsers must stay under
  it without a disable comment.
- `max-params` is 4, so `fetchParsed(url, priority, parse, label)` fits
  exactly.
- Private methods use `#`. The codebase has no `protected` members today.
- License headers, JSDoc for exports, sorted imports, ASCII only, and no
  em-dashes.
- Unit tests use the adapter mock and make no live API calls. The separate
  `tests/integration/` suite may add live wire-shape checks; it runs only via
  `npm run test:integration` and the Nightly Integration workflow.

## Approaches considered

1. **Keep `Decoded<T>` (current).** Failure stays in the type system, there is
   no hidden control flow, and bugs cannot be swallowed. The costs are no
   reason on failure, 30 checks, and validation that is optional at each call
   site.
2. **Throwing readers with a catch in each client method.** Removes the field
   checks, but adds six copies of `try`/`catch` and repeated logging.
3. **Throwing readers with a shared `fetchParsed` (chosen).** One catch, one
   log, validation is mandatory, and clients keep provider context by passing
   a label. A dedicated `ParseError` plus a rethrow keeps bugs visible.

Option 3 is chosen because it fixes the diagnostics and the boilerplate without
turning parse failures into fetch failures.

## Decisions

- **`ParseError`.** Add it to `parse-utils.ts` and export it so
  `BaseApiClient` can catch it. It extends `Error` and names the field or path
  in its message, for example `expected string at "title", got null`.
  Parsers that reject a value without a reader, such as an unknown OMDb
  `Response`, throw it directly. It does not extend `FlixMonkeyError`, which
  carries HTTP request metadata and is treated as a request failure.
- **Readers throw.** `requiredString` throws on absent, empty, or wrong type.
  `optionalString`, `optionalNumber`, and `optionalArray` return `undefined`
  for absent or null and throw only on a wrong type. The short names replace
  `readRequiredString`, `readOptionalString`, `readOptionalNumber`, and
  `readOptionalArray`.
- **`assertRecord`.** Replace `isRecord` with
  `assertRecord(value): asserts value is Record<string, unknown>`. It throws
  `ParseError('expected an object')`. The name matches TypeScript's `asserts`
  vocabulary and signals that it throws.
- **`parseValidItems`.** Add
  `parseValidItems<T>(values: unknown[], parseItem: (value: unknown) => T)`.
  It calls `parseItem` for each item, catches only `ParseError`, drops that
  item, and returns the rest. `parseItem` returns `T` and throws on an invalid
  item. One bad item does not fail the response, item failures are not logged
  individually, and an all-invalid input returns an empty array.
  Non-`ParseError` values rethrow.
- **`parseRequiredItems`.** Add
  `parseRequiredItems<T>(values, parseItem, label)`. It delegates to
  `parseValidItems` and throws `ParseError` with the label when the input is
  non-empty and every item is invalid. Primary result arrays (XMDb `results`,
  IMDb Suggestions `d`, and the Agregarr ratings array) use it so a provider
  shape change is not reported as an empty result. Optional secondary arrays
  keep the lenient `parseValidItems` behavior: an all-invalid OMDb `Ratings`
  array leaves the RT and MC ratings absent without failing the title.
- **`fetchParsed`.** Add it to `BaseApiClient` as a public method:

    ```ts
    async fetchParsed<T>(
        url: string,
        priority: number,
        parse: (raw: unknown) => T,
        label: string
    ): Promise<T | undefined>
    ```

    It calls `#queuedFetch`, then runs `parse` inside a `try`. On
    `ParseError`, it logs a warning with the label, raw body, and message,
    then returns `undefined`. Anything else rethrows. The `try` wraps only the
    parse, never the queue.

- **Private `#queuedFetch`.** Rename the current `queuedFetch` to
  `#queuedFetch`. It stays the single place that wires `#queue`, `#adapter`,
  and the priority. No public raw request method remains.
- **Client call sites.** Replace the fetch, parse, and warn block with:

    ```ts
    const response = await this.fetchParsed(url, priority, parseX, label);
    if (!response) return undefined;
    ```

    Labels include the provider, operation, and title or ID, for example
    `XMDb details for "Some Title" (ID: tt123)`.

- **Logging split.** `fetchParsed` logs malformed payloads only. Clients keep
  their existing no-results logs for decoded empty or not-found results such
  as `Response: 'False'`, an empty search results array, or an empty Agregarr
  ratings array. Clients do not log when `fetchParsed` returns `undefined`,
  because the helper already logged the malformed case. The XMDb details
  not-found payloads (an `error` field, or a `title` of `null`) return
  `undefined` without a warning; remove the current "details request failed"
  warning on that path. The Agregarr details empty-array case logs at `info`
  ("No Agregarr ratings found"), not at `warn`.
- **Collapse the XMDb split.** Inline the details-fields parsing into
  `parseXmdbDetailsResponse`. Merge `XmdbDetailsFields` into
  `XmdbDetailsResponse`: required `id` and `title` first, then `rating`,
  `release_year`, `metascore`, `title_type`, and `vote_count`, each optional
  with `| undefined`.
- **Identity fields.** The Agregarr ratings entry and the XMDb details response
  are the canonical source of the IMDb ID. Build the resulting `Title` with
  `entry.imdbId` and `details.id` rather than copying the ID from the search
  result. Search results still provide the display title for both providers
  and the API title, year, and title type for Agregarr.
- **Details require an IMDb ID.** XMDb and Agregarr return `undefined` from
  `getDetails` before enqueuing a request when the incoming title has no
  `imdbId`. This avoids a request with an empty `id` parameter; the queue
  itself is unchanged.
- **XMDb search fields.** Normalize XMDb search results from `type`, `id`,
  `name`, and `year`. The `name` and `year` fields are the live API shape; do
  not fall back to `title` or `release_year`.
- **OMDb response union.** Model `OmdbResponse` as a discriminated union on
  `Response`. `OmdbSuccessResponse` carries required `Title` and `imdbID`
  fields; `OmdbFailureResponse` carries only `Response: 'False'`. This makes the
  invariant explicit and removes the optional identity fields from the success
  path. Build the `Title` in a module-level `titleFromOmdbSuccessResponse`
  function so the name cannot shadow the module-level parser.
- **OMDb rating keys.** OMDb `Ratings` entries use the capitalized `Source` and
  `Value` keys. Accept only that wire shape; do not add lowercase fallbacks.
- **No redundant fallbacks.** Parsers already normalize absent and null values
  to `undefined`, so call sites pass those fields through directly. Do not add
  `?? undefined` or fall back to a search value for a field the parser requires.
- **Title builders.** Build `Title` values in module-level `titleFrom*`
  functions beside the parsers, not in private methods, because they do not
  use instance state. The functions are `titleFromImdbSuggestionsResult`,
  `titleFromRatingsEntry`, `titleFromSearchResult`,
  `titleFromDetailsResponse`, and `titleFromOmdbSuccessResponse`.
- **Parser names.** Rename the client functions to `parseOmdbResponse`,
  `parseOmdbSuccessResponse`, `parseOmdbRating`, `parseAgregarrRatings`,
  `parseAgregarrRatingEntry`, `parseImdbSuggestionsResponse`,
  `parseImdbSuggestionsResult`, `parseXmdbSearchResponse`,
  `parseXmdbSearchResult`, and `parseXmdbDetailsResponse`.
- **Tests.** Rewrite the three OMDb tests that assign `client.queuedFetch` to
  assert through the adapter instead. Add unit coverage for `assertRecord`,
  the throwing readers, per-item drops, and `fetchParsed`: valid parse,
  `ParseError` logs and returns `undefined`, and non-`ParseError` rethrows.
  Keep the existing parser coverage that goes through the adapter.

## Verification

- `npm run type-check`, `npm run lint`, `npm run format:check`, and `npm test`
  pass.
- `rg "Decoded<|decode-utils|fetchDecoded|readRequiredString|readOptional"` in
  `src/` finds nothing.
- `rg "queuedFetch"` finds only the private `#queuedFetch`.
- A malformed response logs one warning containing the label, raw body, and
  field message.
- A non-`ParseError` thrown by a parser propagates to `ApiClientManager`,
  which handles it as before.
- Valid responses produce the same `Title` values as the branch did before
  this change for the wire shapes the parsers accept.
- The three OMDb tests no longer touch `queuedFetch` and assert through
  `adapter.httpFetch`.

## Risks and maintenance

- A future parser could throw a non-`ParseError`. That propagates, which is
  intentional, but every validation helper must use `ParseError`.
- `fetchParsed` returns `undefined` for both malformed and not-found. The log
  is the only distinction; do not add caller-side logging for `undefined`.
- `ParseError` messages need the field path to be useful. If nested array
  errors become hard to diagnose, `parseValidItems` can add the index.
- A public `fetchParsed` is a test seam. If tests move fully to the adapter,
  it can become `protected`.
- No raw request method remains. If a future endpoint needs the raw body, add
  a separate method with a clear reason instead of reopening `queuedFetch`.

## What is left to the builder

- The exact `ParseError` message and label wording.
- Whether `parseValidItems` includes an array index in its messages.
- Test names and placement under `tests/unit/core/api/`.
