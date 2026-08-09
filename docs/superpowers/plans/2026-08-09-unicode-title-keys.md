# Unicode Title Keys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate distinct, Unicode-safe title keys without invalidating existing ASCII cache and fade-override data.

**Architecture:** Keep `slugify()` as the sole title-key boundary used by cache, in-flight deduplication, and fade overrides. Preserve its exact legacy output for ASCII-only input. Route input containing non-ASCII code points through a `u:`-prefixed, NFKC-normalized, lowercased `encodeURIComponent()` representation.

**Tech Stack:** JavaScript ES2022, Vitest, jsdom.

## Global Constraints

- Preserve current `slugify()` output exactly for ASCII-only input.
- New non-ASCII keys must be non-empty, deterministic, reversible, and distinct for different normalized titles.
- Do not migrate or read ambiguous legacy non-ASCII entries.
- Do not alter API lookup, rate limiting, or storage adapter behavior.
- Every changed source and test file retains its GPL-3.0 header.
- Do not modify the existing user change in `docs/STORE_PUBLISHING.md`.

---

### Task 1: Add Unicode-safe key regression coverage and implementation

**Files:**

- Modify: `tests/unit/core/utils.test.js:116-133`
- Modify: `src/core/utils.js:40-45`

**Interfaces:**

- Consumes: `slugify(str: string): string` from `src/core/utils.js`.
- Produces: Legacy ASCII slugs for ASCII input and `u:${encodeURIComponent(normalizedTitle)}` for non-ASCII input.
- Used by: `CacheManager`, `FlixMonkeyApp`, and `FadeManager` through their existing calls to `slugify()`.

- [x] **Step 1: Write failing utility and cache tests**

Add these cases to the existing `describe('slugify', ...)` block in `tests/unit/core/utils.test.js`:

```js
it('preserves legacy ASCII title keys', () => {
    expect(slugify("Schitt's Creek")).toBe('schitt_s_creek');
    expect(slugify('Test: Movie')).toBe('test_movie');
});

it('returns distinct non-empty keys for non-ASCII titles', () => {
    const korean = slugify('\uAE30\uC0DD\uCDA9');
    const japanese = slugify('\u5BC4\u751F\u7345');

    expect(korean).toMatch(/^u:/);
    expect(japanese).toMatch(/^u:/);
    expect(korean).not.toBe(japanese);
    expect(korean).not.toBe('');
    expect(japanese).not.toBe('');
});

it('normalizes equivalent Unicode title forms', () => {
    expect(slugify('Caf\u00E9')).toBe(slugify('Cafe\u0301'));
});
```

- [x] **Step 2: Run the focused tests and verify they fail**

Run: `npx vitest run tests/unit/core/utils.test.js`

Expected: the new Unicode assertions fail because both non-ASCII titles currently produce an empty slug and the Unicode normalization assertion cannot pass.

- [x] **Step 3: Implement the minimal key branch**

Replace `slugify()` in `src/core/utils.js` with:

```js
export function slugify(str) {
    if (/^[\x00-\x7F]*$/.test(str)) {
        return str
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '');
    }

    return `u:${encodeURIComponent(str.trim().normalize('NFKC').toLowerCase())}`;
}
```

- [x] **Step 4: Run focused tests and verify they pass**

Run: `npx vitest run tests/unit/core/utils.test.js`

Expected: all focused tests pass, including the new ASCII-compatibility, Unicode-distinction, and Unicode-normalization cases.

- [x] **Step 5: Run the complete validation suite**

Run: `npm run lint && npm run format:check && npm test && npm run test:coverage`

Expected: all commands exit zero and coverage thresholds remain satisfied.

- [x] **Step 6: Commit the implementation**

Run:

```bash
git add src/core/utils.js tests/unit/core/utils.test.js
git commit -m "fix(cache): isolate unicode title keys"
```

Expected: one commit contains only the Unicode title-key implementation and its tests.
