# TypeScript and ESLint hardening follow-up

Status as of 2026-10-20. Work is on branch `chore/typescript-lint-hardening`.

## Context

A low-risk TypeScript and lint cleanup pass is complete:

- `npm run lint` passes with `--max-warnings=0`.
- `npm run type-check` passes.
- `npm test` passes: 802 tests across 42 files.
- `npm run format:check` passes.
- `npm run build` passes for userscript, Firefox, and Chrome.

The integration suite is separate from `npm test`. An exploratory run hit external DNS
(`xmdbapi.com`), so it was not used as a gate. Run it with `npm run test:integration` when
`XMDB_API_KEY` and `OMDB_API_KEY` are available.

Completed in this pass:

- Config discovery, global ignores, unused-directive reporting, and unused-import ownership.
- Logger boundary lint rules and trimmed console exceptions.
- Type-only imports and `verbatimModuleSyntax`.
- Promise handling rules and fixes.
- `@ts-ignore` and `as never` bans in application code.
- Removal of unused type stubs.
- JSDoc type removal and required parameter/return descriptions.
- `noImplicitOverride`, shadowing, fallthrough, and unreachable-code checks.
- `Title` immutability and `ServiceSurfaceManager` typing.
- Typed config select allowlist and `RequestQueue` guards.
- Warnings promoted to errors.

## Remaining work

### P1: Validate untrusted data boundaries

- [ ] Enable `@typescript-eslint/no-unsafe-type-assertion` (63 findings today).
    - Replace response casts with runtime guards or small decoders:
        - `src/core/api/xmdb-api-client.ts`
        - `src/core/api/omdb-api-client.ts`
        - `src/core/api/agregarr-api-client.ts`
        - `src/core/api/base-api-client.ts`
    - Validate cache and storage payloads at their boundaries:
        - `src/core/cache/cache-entry.ts`
        - `src/core/cache/cache-manager.ts`
        - `src/platform/adapter.ts`
        - `src/targets/extension/content.ts`
    - Replace untyped error casts with `instanceof Error` narrowing.
    - Acceptance: rule enabled as an error, no disable comments added for new code, and existing
      API/cache tests extended with malformed-payload cases.

- [ ] Enable `noUncheckedIndexedAccess` in `tsconfig.json` (63 errors today).
    - Add explicit index guards, helper accessors, or `for...of` iteration instead of unchecked
      indexing.
    - Do not silence errors with non-null assertions.
    - Acceptance: `npm run type-check` passes with the flag enabled.

### P2: Structural TypeScript cleanup

- [ ] Make `PlatformAdapter` and `StreamingService` abstract.
    - Move "must be implemented by subclass" throws from runtime to compile time.
    - Files: `src/platform/adapter.ts`, `src/core/services/base-streaming-service.ts`.
    - Audit tests and mocks for members that are only partially implemented.

- [ ] Turn `ConfigField` into a discriminated union.
    - Select fields should require `options`; action fields should not accept a stored default.
    - Remove remaining casts and optional-property checks that depend on `type`.
    - File: `src/core/config/config-fields.ts`.

- [ ] Extract duplicated inline structural types from `settings-view.ts`.
    - Share the action, field, and storage shapes with `settings-ui.ts`.
    - Keep view code free of repeated object literals in callback signatures.

- [ ] Rename `_`-prefixed parameters that are actually used.
    - Examples: `RequestQueue.enqueue(_url, _priority)`, `NetflixService.isEnabled(_configManager)`,
      `ConfigField.validate` callbacks.
    - Keep the underscore only for parameters that are intentionally unused.

### P3: Test typing and remaining lint style

- [ ] Remove `@ts-nocheck` from:
    - `tests/unit/core/api-manager.test.ts`
    - `tests/unit/core/services/services.test.ts`
    - The test override currently allows these with a description. Fixing them requires fully
      typing the partial mock collaborators.
    - Acceptance: remove the test-specific `ban-ts-comment` override or narrow it further.

- [ ] Replace the 12 `as never` assertions in `tests/unit/core/app.test.ts`.
    - Use typed mock factories or `Partial<T>` helpers instead of forcing constructor arguments.
    - The `no-restricted-syntax` ban is currently scoped to `src/`.

- [ ] Decide whether to enable `@typescript-eslint/consistent-type-definitions`.
    - 9 findings today. This is a style choice, not a correctness rule.
    - If enabled, prefer `interface` for extensible object shapes and keep `type` for unions,
      intersections, tuples, and mapped types.

- [ ] Decide whether to enforce a lower `@typescript-eslint/max-params`.
    - 8 findings with a maximum of 4 parameters.
    - Prefer parameter objects for constructors and functions that already carry several
      collaborators.

## Verification checklist

Run before merging any follow-up:

```bash
npm run type-check
npm run lint
npm run format:check
npm test
npm run build
```

Run when API keys and network access are available:

```bash
npm run test:integration
```

## Notes

- Do not edit `dist/` or `coverage/`; both are generated.
- Preserve unrelated working-tree changes.
- Do not enable a rule and then add broad disable comments to get green. Either fix the
  underlying code or scope the rule with a documented reason.
