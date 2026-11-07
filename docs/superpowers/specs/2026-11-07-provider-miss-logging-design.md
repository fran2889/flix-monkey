# Provider miss logging: one convention across API clients

**Date:** 2026-11-07

**Status:** accepted

**Size:** small change

## Intent

Make OMDb, Agregarr, and XMDb log HTTP-200 miss and error payloads the same
way, and keep the provider-supplied message in the log line. Today XMDb details
misses are silent, OMDb drops its `Error` text and omits the display title on
details misses, and the three clients phrase the same event differently. A
missing rating therefore looks different depending on which provider is active.

This also resolves GitHub issue #275.

## Goals

- Every provider miss or in-body error at HTTP 200 logs exactly one `info`
  line from the client that owns the request.
- Details miss lines name the display title and the IMDb ID.
- Provider-supplied messages are appended when the body carries one.
- The three clients share one message template per event.
- `undefined` from `fetchParsed` means malformed only, never not-found.

## Non-goals

- HTTP status handling. `ApiClientManager` keeps logging `error` for 400 and
  above and `warn` otherwise, and keeps disabling on 4xx.
- Malformed-body handling. `fetchParsed` keeps logging `warn` with the raw
  body and field error.
- Agregarr's empty-ratings behavior. It already logs `info` and is handled by
  a separate cleanup.
- Caching, the overlay, and which rating fields each provider parses.
- Treating a found title with no rating as an error. Only miss and error
  payloads are in scope.

## Anti-goals

- Logging from a parser. Parsers stay pure, so a line cannot be emitted twice.
- Returning `undefined` from a parser for a valid not-found body. That is what
  makes a miss indistinguishable from a malformed response.
- Logging a miss at `warn` or `error`. A miss is not a client failure.
- Adding provider-message parsing beyond the fields the API already returns.

## Constraints

- `fetchParsed` is the only malformed-body logger.
- `ApiClientManager` is the only HTTP-status logger.
- One line per lookup. The parser must not log, and the client must not log
  again after `fetchParsed` already logged a malformed body.
- ASCII only, SPDX headers, sorted imports, and the repository's JSDoc rules.
- Preserve the untracked `docs/reviews/` directory.

## Message convention

`<label>` is the service the request actually hits. OMDb uses `OMDb`, the
Agregarr search uses `IMDb Suggestions`, and the Agregarr details request uses
`Agregarr`. XMDb uses `XMDb`.

| Event                         | Line                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------ |
| Search miss                   | `info` `No search results found in <label> for "<displayTitle>"`               |
| Search with no supported type | `info` `No supported title-type results found in <label> for "<displayTitle>"` |
| Details miss                  | `info` `No <provider> <noun> found for "<displayTitle>" (ID: <id>)`            |

`<noun>` is `results` for OMDb, `ratings` for Agregarr, and `details` for
XMDb. When the body carries a provider message, append `: <message>` to the
line. No other punctuation or wording is added.

Examples:

- `No search results found in OMDb for "Unknown": Movie not found!`
- `No OMDb results found for "Unknown" (ID: tt1): Incorrect IMDb ID.`
- `No XMDb details found for "Test" (ID: tt1): Movie not found`
- `No XMDb details found for "Test" (ID: tt1)`
- `No Agregarr ratings found for "Test" (ID: tt1)`
- `No supported title-type results found in XMDb for "Test"`

## Approaches

1. **Discriminated union plus client logging (chosen).** Model XMDb not-found
   as a member of `XmdbDetailsResponse`, mirroring the existing OMDb union. The
   parser always returns a member; `getDetails` narrows on `status`, logs once,
   and returns `undefined`. OMDb's failure type gains an optional `Error`.
   Type-safe, keeps parsers pure, and leaves malformed handling untouched.
2. **Parser logs and returns `undefined`.** Rejected: it puts a side effect in
   a pure function, risks duplicate lines when a caller also logs, and keeps
   the not-found and malformed cases indistinguishable by type.
3. **Return a generic result object.** A `{ found: boolean; message?: string }`
   shape would work, but it loses the discriminated-union narrowing the OMDb
   client already uses and weakens the found response type. Rejected for
   inconsistency with the existing pattern.

## Decisions

- XMDb details response becomes:

    ```ts
    interface XmdbDetailsFound {
        status: 'found';
        id: string;
        title: string;
        rating?: number | undefined;
        release_year?: number | undefined;
        metascore?: number | undefined;
        title_type?: string | undefined;
        vote_count?: number | undefined;
    }

    interface XmdbDetailsNotFound {
        status: 'not-found';
        error?: string | undefined;
    }

    type XmdbDetailsResponse = XmdbDetailsFound | XmdbDetailsNotFound;
    ```

- `parseXmdbDetailsResponse` returns `{ status: 'not-found', error }` for an
  `error` body and `{ status: 'not-found' }` for `title: null`. It never
  returns `undefined`.
- `titleFromDetailsResponse` accepts `XmdbDetailsFound`.
- OMDb `OmdbFailureResponse` gains `Error?: string | undefined`, parsed with
  `optionalString`. Search and details failure paths append it.
- OMDb search wording changes to `No search results found in OMDb for "<title>"`.
- OMDb details wording changes to `No OMDb results found for "<title>" (ID: <id>)`.
- OMDb debug wording changes to `Fetching OMDb details for ID: <id> ("<title>")`.
- XMDb type-filter wording gains `supported`.
- Agregarr needs no source change. Its lines already match the convention and
  are the reference for the details template.
- The provider-message suffix may be a small local helper or an inline
  conditional. The builder decides, provided the format is identical at every
  call site.

## Tests

- XMDb: update the two existing no-warning tests to assert the exact `info`
  line and no `warn`, one per not-found shape.
- XMDb: add coverage that the `error` body keeps the provider message and that
  the `title: null` body logs the display title and IMDb ID.
- XMDb: keep the malformed-body warning tests unchanged.
- OMDb: rename the stale "log warn with error message" test, assert `info`,
  and assert the provider message is present.
- OMDb: update the `Response: "False"` search test for the new wording.
- OMDb: add a details miss test that asserts the display title, IMDb ID, and
  provider message.
- Agregarr: no test changes expected.
- Keep one-line-per-lookup assertions: `info` called once, `warn` not called.

## Documentation

- Update the "Logging split", "Collapse the XMDb split", and "OMDb response
  union" bullets in
  `docs/superpowers/specs/2026-11-03-api-response-parsing-design.md` to match
  this convention and the new types.
- Leave the historical plan document unchanged.

## Verification

- `npm run type-check`, `npm run lint`, `npm run format:check`, and
  `npm test` pass.
- No parser calls the logger.
- `undefined` from `fetchParsed` is only produced by the `ParseError` path.
- Each miss shape logs exactly one `info` line and no `warn` or `error`.
- HTTP-status behavior and logging are unchanged.

## Left to the builder

- Whether to add a shared message-suffix helper or use an inline conditional.
- Exact test names, following the existing file style.
- Whether the XMDb union members live beside the response type or below it.
