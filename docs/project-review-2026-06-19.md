# FlixMonkey Project Review — 2026-06-19

A consolidated review of the FlixMonkey codebase, conducted by three parallel reviews covering (1) source code architecture & quality, (2) testing, build & CI/CD, and (3) security, dependencies & documentation. This is a review-only report; no files were modified.

## Executive Summary

FlixMonkey is in **strong overall shape**. The Platform Adapter pattern is applied cleanly, the multi-target build works, the full test suite passes (**384 tests green, ~40s**), and `npm audit` reports **0 vulnerabilities**. There is **no XSS exposure** — all DOM is built via `createElement`/`textContent`, never `innerHTML` — and the extension follows least-privilege manifest principles.

There are **no Critical findings**. The most material issues are:

- A **cross-tab rate-limit race** and an **in-flight dedup key mismatch** in the core request path (real correctness bugs).
- **Integration tests hit live third-party APIs unconditionally**, coupling CI merge-ability to an external service.
- A **rate-limit constant vs. documentation mismatch** (`4000` in code, `1000` in docs).
- Several **documentation inaccuracies** (Node version, changelog section) and **lockfile drift** vs. declared dependency ranges.

### Findings by severity

| Severity | Count | Areas                                                                          |
| -------- | ----- | ------------------------------------------------------------------------------ |
| Critical | 0     | —                                                                              |
| High     | 4     | Request-queue race, dedup key mismatch, rate-limit mismatch, live-API CI tests |
| Medium   | ~10   | Config reactivity, cache coupling, CI redundancy, doc accuracy, lockfile drift |
| Low      | ~15   | Naming/convention consistency, defensive hardening, housekeeping               |

---

## 1. Source Code Architecture & Quality

The `src/` codebase demonstrates a mature understanding of the Platform Adapter pattern. Platform I/O is fully abstracted behind `PlatformAdapter`, `core/` logic is platform-agnostic, and `startApp` is a clear composition root. Dependency injection, private fields (`#field`), and JSDoc coverage are used consistently.

**Strengths**

- Clean Platform Adapter abstraction; abstract methods throw `FlixMonkeyError`, optional methods default to no-ops (`adapter.js`).
- Template-method pattern in `BaseApiClient` (search → getDetails) keeps providers small (`api-clients.js`).
- SPA navigation handling patches `pushState`/`replaceState` and restores originals on `disconnect()` (`app.js:126-173`).
- In-flight request dedup + timeout race avoids hung overlays (`app.js:96-105`).
- Cache TTL tiering by rating/age (`cache.js:41-51`).
- Surface discovery with `seen` set + priority order (`surfaces.js:24-99`).

**High**

- **Cross-tab rate-limit race** — `request-queue.js:51-86`. On the no-wait path, `fm_last_req` is read-modify-written non-atomically across tabs. Two tabs can both compute `wait === 0` and fire simultaneously, violating the global rate limit and tripping 429s (XMDB at 1.5s is most exposed). Re-read `fm_last_req` immediately before firing on the no-wait path; accept residual raciness as a documented limitation.
- **In-flight dedup key ≠ cache key** — `app.js:85` vs `cache.js:33-38`. Dedup uses `displayTitle.toLowerCase()`; the cache slugifies (`[^a-z0-9]+` → `_`). Titles differing only by punctuation/whitespace bypass dedup yet collide in the cache → duplicate concurrent lookups and a possible double-write race. Share one slug function across both layers.
- **Rate limit doc/code mismatch** — `constants.js:33` (`4000`) vs `AGENTS.md:232` (`1000`). Reconcile and confirm intended value; 4s/request makes large browse grids very slow to decorate.

**Medium**

- **`getInt`/`getFloat` can return a non-numeric fallback** — `config-manager.js:39-49`. An invalid TTL can flow to `getTtlMs(undefined)` → `NaN` → entry **never expires**. Harden to guarantee a numeric return independent of validators.
- **Cross-provider rating blending** — `cache.js:62`. Rated entries from a previously-selected provider are served regardless of `activeSource` (e.g. OMDB RT/MC ratings persist after switching to imdbapi until TTL expiry). Document or make source-aware.
- **Divergent config reactivity** — userscript reads config live via `GM_getValue` (`userscript.js:83-85`) but reloads on save; WebExtension reads a snapshot (`webextension.js:76-79`) kept current by `storage.onChanged`. The `content.js:32-39` listener only re-renders for `overlayCorner` — other live changes update state but don't re-decorate existing tiles.
- **Redundant disabled-client gating** — `api-manager.js:52-58` checks `getStatus()` then `client.fetch` re-checks `isDisabled`, straddling an `await` (TOCTOU). Clarify ownership of the disabled gate.
- **`disable()` purge is incomplete** — `api-clients.js:127-133` clears pending queue items but not the already-shifted in-flight request.
- **`storageGet` returns `null`, contract says `undefined`** — `userscript.js:23`, `webextension.js:34` vs `adapter.js:39`. Align contract and implementations.

**Low**

- `Title` documented "immutable-style" but mutated post-construction (`title.js:30`); `type` field missing from `TitleOptions` typedef (`title.js:18-28`).
- `overlay.js:158,170,177` use truthiness checks that drop legitimate `0`/`0%` ratings — use `!= null`.
- `SettingsUI` mixes `#private` and public fields plus `_underscore` method convention (`settings-ui.js:21-32`).
- Duplicated TTL validator across three config fields (`config-fields.js:81-109`) — extract a helper.
- `runIdle` references `window` unguarded (`utils.js:55`); `Modal.open` uses `crypto.randomUUID()` (`modal.js:25`) — minor userscript-host portability risk.
- `parseRatings` can throw on a `null` array element (`api-clients.js:37`).

---

## 2. Testing, Build & CI/CD

`npm test` passes cleanly (**384 tests, 32 files, ~40s**) and `npm run build` succeeds, producing all three targets plus the Chrome `.zip` and Firefox `.xpi`.

**Strengths**

- Unit tests mirror `src/` 1:1; UI tests use real Netflix DOM fixtures; 90% line/function coverage enforced.
- MSW for HTTP mocking; `createMockAdapter` extends the real `PlatformAdapter` so abstract-method contracts stay honest.
- Multi-target Rollup config is clean; manifest metadata injected from `package.json`; icons resized from one source via `sharp`; userscript non-ASCII escaped and license headers stripped.
- `scripts/package.js` verifies required dist files before zipping and excludes `.map` files.
- CI: all actions SHA-pinned, `permissions: contents: read` default, `npm ci --ignore-scripts` (supply-chain hardening), dependency-review fails on moderate+, `.npmrc` `min-release-age=5`.

**High**

- **Integration tests hit live APIs unconditionally in CI** — `tests/integration/api-clients.test.js:121,152,173,188,226,259`. IMDBAPI tests have no `hasCredentials` guard (the API needs no key) and assert exact IMDb IDs/years. The file already fights Cloudflare rate limits with a 4s manual throttle. CI merge-ability is coupled to imdbapi.dev uptime/data. Gate behind an env flag (e.g. `RUN_LIVE_TESTS`) or move to a nightly cron.

**Medium**

- **`npm test` includes integration tests** — `package.json:20`. Bare `npm test` (the documented pre-submission step) fires live-API tests; offline/firewalled contributors get spurious failures. Exclude `tests/integration` from the default `test` script.
- **CI re-installs deps 6× with no shared artifact** — `ci.yml`. `test-coverage` is a superset of `test-unit`/`test-ui`. Consolidate or share a build artifact.
- **Coverage thresholds lack `branches`/`statements`** — `vitest.config.js:9-11`. Branch coverage is unmeasured.
- **Userscript lacks `@updateURL`/`@downloadURL`** — `src/targets/userscript/metadata.js`. Installed userscripts won't auto-update; point at the release asset.

**Low**

- `npm rebuild sharp` required in two workflows due to `--ignore-scripts` (`ci.yml:37`, `release-please.yml:30`) — correct but fragile.
- Dead MSW import in `tests/setup.js:21`.
- `tests/integration/setup.js` is imported manually per file rather than registered as a setupFile (`vitest.config.js:8`).
- release-please bumps only `package.json` — correct here, since manifest/userscript versions are injected at build time (no drift).

---

## 3. Security, Dependencies & Documentation

`npm audit` reports **0 vulnerabilities**. No Critical or High findings. The main issues are documentation inaccuracies and minor hardening gaps.

**Strengths**

- **No XSS**: `overlay.js` and `settings-ui.js` build all DOM via `createElement` + `textContent`; no `innerHTML`/`insertAdjacentHTML`/`outerHTML` in `src/`.
- **Safe links**: `Title.imdbUrl` (`title.js:96-100`) hardcodes scheme/host and `encodeURIComponent`s input; links use `rel="noopener noreferrer"` (`overlay.js:153`).
- **Sender validation**: both background handlers verify `sender.id === runtime.id` (`background.js:23`, `service-worker.js:21`).
- **Not an open proxy**: `validateDomain()` (`domains.js:20-30`) checks `hostname` against an exact allowlist; proxy forces `GET` only.
- **Least-privilege manifests**: only `storage` permission; host scope limited to Netflix + three API hosts; no `<all_urls>`/`tabs`/`webRequest`/`scripting`.
- **Userscript scope**: `@connect` and `@grant` list exactly what's used.

**Medium**

- **Docs state Node >= 22, project requires >= 24** — `README.md:127`, `CONTRIBUTING.md:20` vs `package.json:53`/`.nvmrc`/CI (`24.x`). Fix both docs.

**Low**

- No explicit `content_security_policy.extension_pages` in either manifest (relies on MV3 default `script-src 'self'`) — add for defense-in-depth/documented intent.
- Fetch proxy forwards full caller-supplied URL (path/query) for allowlisted hosts; URLs are internally generated and GET-only, so risk is low — add a trust-boundary comment in `fetch-proxy.js`/`domains.js`.
- **Lockfile drift** — installed `@commitlint/cli`/`config-conventional` (20.5.3) and `lint-staged` (16.4.0) don't satisfy declared `^21`/`^17` ranges. Run `npm install` to reconcile. Other minor lags: `eslint`, `rollup`, `sharp`.
- README changelog section (`README.md:108-109`) says the changelog "will be auto-generated upon first release" but `CHANGELOG.md` already exists — update to link it.
- API keys sent as URL query params (`api-clients.js:226,244,286`) — inherent to upstream OMDB/XMDB APIs; keys stored locally only. Nothing actionable.

---

## Prioritized Action List

1. **Fix the request-queue cross-tab race** by re-reading `fm_last_req` before firing (§1 High).
2. **Unify the in-flight dedup and cache key** behind a shared slug function (§1 High).
3. **Gate live integration tests** behind an env flag and remove them from the default `npm test` (§2 High / Medium).
4. **Reconcile the IMDBAPI rate limit** between `constants.js` and `AGENTS.md` (§1 High).
5. **Harden `getInt`/`getFloat`** to guarantee a numeric return (fixes the never-expires cache edge case) (§1 Medium).
6. **Fix documentation**: Node `>= 24` in README/CONTRIBUTING; update the README changelog section (§3 Medium/Low).
7. **Reconcile `package-lock.json`** with declared dependency ranges via `npm install` (§3 Low).
8. **Use `!= null`** for rating presence in `overlay.js` so `0`/`0%` scores render (§1 Low).
9. **Housekeeping**: consolidate redundant CI jobs, add `@updateURL`/`@downloadURL`, add explicit manifest CSP, tidy naming/convention inconsistencies (§§1–3 Low).
