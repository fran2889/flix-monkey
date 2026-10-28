# AGENTS.md

Instructions for AI agents working in this repository. Human contributor guidance lives in [CONTRIBUTING.md](./CONTRIBUTING.md).

**FlixMonkey** is a browser extension and userscript that overlays IMDb, Metacritic, and Rotten Tomatoes ratings on Netflix, HBO Max, and Disney+ thumbnails and banners. A shared TypeScript codebase in `src/` is bundled by Rollup into three targets: a userscript (`dist/FlixMonkey.user.js`), a Firefox MV3 extension (`dist/firefox/`), and a Chrome MV3 extension (`dist/chrome/`). Platform differences are hidden behind a `PlatformAdapter` abstraction.

Stack: TypeScript (ES2022, ESM), Node.js >= 24, Rollup, ESLint, Prettier, Vitest + jsdom.

## Commands

- Install: `npm install`
- Build: `npm run build` (all three targets)
- Lint and format (report): `npm run lint && npm run format:check`
- Lint and format (auto-fix): `npm run lint:fix && npm run format`
- Type check: `npm run type-check`
- Test: `npm test`
- Full local check before a PR: `npm run type-check && npm run lint && npm run format:check && npm run audit && npm run build && npm run test:coverage`

Other npm scripts and their exact definitions live in `package.json`. Read it rather than trusting a copy.

### Chromium debugging

Attach Chrome DevTools CLI to Chromium launched from the repository root with a persistent profile:

```bash
chromium --remote-debugging-port=9222 --user-data-dir="$PWD/.chromium-debug-profile"
```

Reuse that profile. Do not use fresh or temporary user-data directories.

## Hard constraints

- All platform-specific I/O goes through the `adapter` (`adapter.httpFetch()`, `adapter.storage*`, `adapter.configGet()`). Never call `fetch`, `GM_*`, or `browser.*` from platform-agnostic code.
- Streaming-service pages block direct `fetch()` to external APIs. Extensions proxy through the background page or service worker via `browser.runtime.sendMessage`; userscripts use `GM_xmlhttpRequest`.
- `src/targets/extension/domains.ts` (`ALLOWED_DOMAINS`, `validateDomain()`) gates every proxied request. Adding an API endpoint requires adding its host there.
- In extensions, config changes arrive asynchronously via `browser.storage.onChanged`. Do not assume a config value read at init stays current.
- `PlatformAdapter.configGet()` has no no-op default. Unlike `registerMenuCommand` and `setConfigData`, every adapter must implement it.
- Manifest fields with `__...__` placeholders (for example `__NAME__`, `__VERSION__`) are injected at build time from `package.json`. Do not hardcode them in `manifest.json`.
- Do not claim a change has shipped. GitHub releases are cut automatically from `main`; store publishing is a separate manual step (see Releases).
- Do not edit generated output under `dist/` or `coverage/`.
- Preserve unrelated working-tree changes in any file you edit.

### Persistent storage migrations

Stored data carries an `fm_data_version`. When changing a persisted shape, append a new migration to `MIGRATIONS` (`src/core/migrations.ts`) with the next integer version, and add tests for transformed, already-current, and malformed data. Never edit or reuse a released version. `runMigrations()` advances the stored version even when a migration fails, on purpose, so a broken migration cannot trap startup.

## Superpowers plans

Plans live in [`docs/superpowers/plans/`](docs/superpowers/plans/) and track work with `- [ ]` checkboxes. Tick a step only when it is complete: verification steps once they pass, and artifact steps once the file, commit, branch, or tag exists. Do not leave finished work unchecked or batch the updates at the end.

## Conventions

- License header: every `{src,tests}/**/*.ts` and `scripts/**/*.{js,ts}` file starts with the SPDX header matching `LICENSE_HEADER.template`. ESLint enforces this; `src/targets/userscript/metadata.ts` is exempt from the rule because it is a comment-only template, but it still carries the header. Do not hand-add headers to generated bundles.
- Exports are the boundary: ESLint requires a description plus `@param` and `@returns` where applicable on exported functions and classes, exported arrow and function constants, abstract members, and interface method signatures. Destructured options are documented as one root object. Class methods, constructors, fields, and object function properties are not lint-enforced; document them when a caller cannot infer the contract. See `eslint.config.js` for the exact rules.
- Declare exports at their declaration site (`export function`, `export class`, `export const`). Local export lists in `src/`, including `export type { ... }`, are rejected because the JSDoc rule cannot see the exported declaration through them.
- Document what a caller must understand to use the export safely: abstract and cross-platform contracts, injected dependencies, and persistence, messaging, HTTP, and external-data behavior. Use `unknown` for untrusted input and named `@typedef`s for reused shapes.
- Omit JSDoc for private helpers, non-exported DOM and UI glue, concrete getters and setters, and self-evident signatures. Keep an accessor comment only when it explains behavior a caller cannot see, such as a fallback. The lint rule checks exported declarations, abstract members, and interface signatures, and it checks that documentation exists rather than that it is warranted.
- Relative imports name a file. Directory modules go through their `index.ts` barrel with an explicit extensionless path (`../core/config/index`), never as a bare directory or with a `.ts` suffix.
- Strict TypeScript: no `any`, explicit return types, sorted imports. Full rule set in `eslint.config.js`.
- Use `src/core/logger.ts` for application logging in `src/`; raw `console` is limited to the logger itself and platform bootstrap error paths.
- ASCII only, unless a test case or user-facing string needs otherwise.
- Prose: no em-dashes; use a colon, a semicolon, or two sentences. Use the Oxford comma.
- Conventional Commits (`type(scope)?: description`, imperative, lowercase, no trailing period). Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert. Enforced by commitlint via a Husky `commit-msg` hook.
- Update [`README.md`](README.md) when a change is user-facing.
- Do not include `Generated by ...` or `Co-Authored-By:` footers in commit messages. A configured global hook may strip them; do not rely on it.

### Code ordering

Apply these rules when adding or moving code; do not reorder untouched code to satisfy them. ESLint enforces group order through `@typescript-eslint/member-ordering`; step-down order inside a group is a review convention. The same group order applies to every class.

- Class groups, in order: index signatures; static fields and static blocks; instance and abstract fields; constructor; static methods; instance and abstract methods; getters, setters, and auto-accessors.
- Order members inside a group by step-down order: callers before callees, regardless of visibility. Put the primary entry point or primary operation first, then its helpers in the order it first encounters them, then secondary workflows and their helpers, then teardown. A helper shared by several callers follows the first caller in reading order. Never group by `public`, `protected`, `private`, or `#private`.
- Abstract methods are methods, not a separate group. Abstract fields belong with instance fields.
- Accessors are the one deliberate exception to step-down order: getters, setters, and auto-accessors stay last. Pair each getter with its setter and order the pairs by first use.
- Fields keep their source order within the static and instance groups. Do not reorder initialized fields or static blocks; only the static-versus-instance split is enforced. `Title` and `CacheEntry` are the reference pattern for data classes.
- Overrides keep the relative order the base class defines.
- Interfaces and type literals, in order: index signatures, fields, methods. Dependency-object fields are alphabetical with no category grouping; other interface members follow parameter or consumption order. This alphabetical exception is not lint-enforced.
- Module-level declarations are not lint-enforced. Order them as imports, types and interfaces, constants, the primary export, then helpers in step-down order. Do not alphabetize.
- Constructors with more than four injected dependencies take one dependency object. Order its fields alphabetically and do not group them by category; `ApiClientDeps` is the pattern.
- Positional parameters, within the `max-params` limit: platform adapter and other infrastructure dependencies first, then the subject or data the function acts on, then configuration values, then callbacks and optional arguments.

## Testing

- Add or update tests for every business-logic change.
- Location rule: a test belongs in `tests/ui/` if it loads a streaming-service surface fixture from `tests/fixtures/`; otherwise `tests/unit/`. Integration tests are separate (see below). The deciding question is whether the assertion needs real service markup. If it would pass against a synthetic `<div>`, it is a unit test.
- Fixtures are TypeScript modules exporting `{name, html, expected}` entries, one surface per entry. Shared assertions live in `tests/helpers/surface-tests.ts`; mock factories live in `tests/mocks/`.
- Do not duplicate coverage across layers.
- `tests/integration/` hits live APIs. It runs only via `npm run test:integration` and the Nightly Integration workflow, needs `XMDB_API_KEY` and `OMDB_API_KEY`, and fails fast when a key is missing. Do not mock HTTP there.
- Coverage thresholds and the jsdom environment are configured in `vitest.config.js`.

## GitHub

Issue and PR body shape is defined by the templates in [`.github/`](.github/), not by this file. Read the relevant template and follow its HTML comment. `gh pr create` does not apply the template; pass a filled copy with `--body-file`.

- Branches: `type/kebab-case-slug`, 2 to 4 words, where `type` matches the PR title type. Match the prefix to the title (`refactor/`, not `feat/`, for a `refactor:` PR).
- PR titles are squash-merged and parsed by release-please, so they use Conventional Commits. Match the scope to the changed directory's final name (`src/core/cache/` becomes `cache`, `src/core/services/` becomes `services`).
- CI enforces six merge-gate jobs: type-check, lint-and-audit, build, test-unit, test-ui, and test-coverage. Run the equivalent commands locally first.
- Issue titles: imperative, descriptive, no trailing period. Issue templates apply `bug` and `enhancement`; add other labels deliberately, and never apply Dependabot's automation labels by hand.

### Releases

release-please runs on pushes to `main`. It authenticates with a short-lived installation access token for the GitHub App installed on this repository (`RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY`), not `GITHUB_TOKEN`, so CI runs automatically on its release PR. It cuts the release as a draft so the same workflow can build the distribution artifacts, attach them with `gh release upload`, and then finalize the release with `gh release edit --draft=false`. Publishing to the Chrome Web Store and Firefox Add-ons is a separate manual step: `.github/workflows/publish-to-stores.yml` is `workflow_dispatch` only and downloads the attached assets for the chosen tag.

## Where to look

Read these instead of a copy in this file:

- `package.json`: scripts and `lint-staged` globs.
- `eslint.config.js`: lint, TypeScript, JSDoc, and header rules.
- `vitest.config.js`, `vitest.integration.config.js`: test environment and coverage.
- `rollup.config.js`: build targets, manifest injection, icon generation.
- `src/core/`: business logic (`app.ts`, `api-manager.ts`, `overlay.ts`, `services/`, `surfaces/`, `ui/`).
- `src/platform/`: the `adapter.ts` contract plus the userscript and WebExtension implementations.
- `src/targets/`: entry points, the fetch proxy, and per-browser manifests and background scripts.
- `tests/`: `unit/`, `ui/`, `fixtures/`, `helpers/`, `mocks/`, `integration/`.
- `src/core/constants.ts`, `src/core/rate-limits.ts`: timing and rate-limit values.
- `src/core/config/config-fields.ts`: the single source of truth for settings.
- `src/targets/extension/domains.ts`: allowed external hosts.
- [`.github/`](.github/): templates and workflows.
- [`CONTRIBUTING.md`](CONTRIBUTING.md), [`docs/STORE_PUBLISHING.md`](docs/STORE_PUBLISHING.md): human and store-publishing guidance.
