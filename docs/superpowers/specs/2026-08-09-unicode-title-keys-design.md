# Unicode Title Keys Design

## Goal

Prevent non-ASCII streaming-service titles from sharing an empty cache, in-flight, and fade-override key while retaining compatibility with existing ASCII keys.

## Current Behavior

`slugify()` removes every character outside `[a-z0-9]`. A title composed solely of non-ASCII characters therefore produces an empty string. Cache entries, in-flight lookups, and fade overrides all use this result as their key, so unrelated titles can share state.

## Design

`slugify()` remains the shared title-key function.

- For ASCII-only input, it keeps the existing lowercasing and punctuation-to-underscore behavior exactly. Existing ASCII cache and fade-override keys remain readable.
- For input containing one or more non-ASCII characters, it returns a versioned, Unicode-safe key: `u:` followed by the percent-encoded normalized title.
- Unicode input is trimmed, normalized with NFKC, and lowercased before encoding. This makes equivalent presentation forms produce the same key without discarding title identity.
- The encoded form is deterministic and reversible, so it does not introduce hash collisions.

## Legacy Data

Existing non-ASCII entries are stored under ambiguous legacy keys, commonly the empty slug. The new key format will not read or migrate them. They remain harmless unreachable storage until their configured expiry or a user cache clear. The same rule applies to legacy fade overrides.

## Error Handling

The key function remains synchronous and accepts the same string input contract. It adds no I/O, migration, or failure path.

## Tests

Add tests that prove:

- Existing ASCII title keys are unchanged.
- Distinct Korean and Japanese titles generate distinct, non-empty keys.
- Mixed ASCII and Unicode titles preserve their Unicode distinction.

## Scope

The change is limited to title-key generation and its regression tests. It does not migrate storage, alter rate limiting, or modify provider lookup behavior.
