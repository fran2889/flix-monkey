# TypeScript Migration Tracker

**Goal**: Convert flix-monkey from JavaScript to TypeScript with strict type safety.

**Philosophy**: Use `null`, not `undefined`. All code paths must return explicitly.
**Type Precision**: Use precise types - `string | null` or `number | null` for stored properties, only `string | number | null` for input parameters that get normalized. Nullability only where properties can actually be null.

---

## Phases

### Phase 0: Infrastructure (Pre-migration Setup)

- [x] Remove unused MSW from tests/setup.js and package.json
- [x] Add TypeScript and related devDependencies (commit: 634298e)
- [x] Add tsconfig.json with strict settings (commit: 634298e)
- [x] Update Rollup config to support TypeScript (commit: 634298e)
- [x] Update ESLint config for TypeScript (commit: ea9a592 + 73af925)
- [x] Create pre-typescript-migration branch as rollback point

### Phase 1: Foundation (Low risk - pure data and utilities)

- [x] src/core/constants.js → constants.ts (commit: d6bffab)
- [x] tests/unit/core/constants.test.js → constants.test.ts (commit: d6bffab)

- [x] src/core/title.js → title.ts (commit: 73af925)
- [x] tests/unit/core/title.test.js → title.test.ts (commit: 73af925)
- [x] tests/mocks/title.js → title.ts (commit: 73af925)

- [x] src/core/utils/color-utils.js → color-utils.ts (commit: 3d3f743)
- [x] tests/unit/core/utils/color-utils.test.js → color-utils.test.ts (commit: 3d3f743)

- [x] src/core/utils/general-utils.js → general-utils.ts (commit: 3d3f743)
- [x] tests/unit/core/utils/general-utils.test.js → general-utils.test.ts (commit: 3d3f743)

- [x] src/core/utils/string-utils.js → string-utils.ts (commit: 3d3f743)
- [x] tests/unit/core/utils/string-utils.test.js → string-utils.test.ts (commit: 3d3f743)

- [x] src/core/utils/url-utils.js → url-utils.ts (commit: 3d3f743)
- [x] tests/unit/core/utils/url-utils.test.js → url-utils.test.ts (commit: 3d3f743)

- [x] src/core/utils/index.js → index.ts (barrel) (commit: 3d3f743)

- [x] src/core/rate-limits.js → rate-limits.ts (commit: 3d3f743)

### Phase 2: Services & Managers (Medium risk)

- [x] src/core/api-manager.js → api-manager.ts (commit: 2cb2b2b)
- [x] tests/unit/core/api-manager.test.js → api-manager.test.ts (commit: 2cb2b2b)
    - **Status**: COMPLETED - Unblocked by API Clients (Task 7.1) completion in commit 344b9e6

- [x] src/core/services/base-streaming-service.js → base-streaming-service.ts (commit: 18ff681)
- [x] tests/unit/core/services/services.test.js → services.test.ts (commit: 18ff681)

- [x] src/core/services/netflix-service.js → netflix-service.ts (commit: 18ff681)

- [x] src/core/services/disney-plus-service.js → disney-plus-service.ts (commit: 18ff681)

- [x] src/core/services/hbo-max-service.js → hbo-max-service.ts (commit: 18ff681)

- [x] src/core/services/service-registry.js → service-registry.ts (commit: 18ff681)

- [x] src/core/services/index.js → index.ts (barrel) (commit: 18ff681)

- [x] src/core/cache/cache-entry.js → cache-entry.ts (commit: ad058dc)
- [x] src/core/cache/cache-manager.js → cache-manager.ts (commit: ad058dc)
- [x] src/core/cache/index.js → index.ts (barrel) (commit: ad058dc)
- [x] tests/unit/core/cache/cache.test.js → cache.test.ts (commit: ad058dc)
- [x] tests/mocks/cache.js → cache.ts (commit: ad058dc)

- [x] src/core/config/config-fields.js → config-fields.ts (commit: ad058dc)
- [x] src/core/config/config-manager.js → config-manager.ts (commit: ad058dc)
- [x] src/core/config/index.js → index.ts (barrel) (commit: ad058dc)
- [x] tests/unit/core/config/config-manager.test.js → config-manager.test.ts (commit: 0fe5bb7)

- [x] src/core/disabled-clients.js → disabled-clients.ts (commit: 2206bf2)
- [x] tests/unit/core/disabled-clients.test.js → disabled-clients.test.ts (commit: 2206bf2)

- [x] src/core/fade-manager.js → fade-manager.ts (commit: 344b9e6)
- [x] tests/unit/core/fade-manager.test.js → fade-manager.test.ts (commit: 349f2e3)

- [x] src/core/id-override-manager.js → id-override-manager.ts (commit: 344b9e6)
- [x] tests/unit/core/id-override-manager.test.js → id-override-manager.test.ts (commit: 349f2e3)

- [x] src/core/request-queue.js → request-queue.ts (commit: 344b9e6)
- [x] tests/unit/core/request-queue.test.js → request-queue.test.ts (commit: 349f2e3)

- [x] src/core/logger.js → logger.ts (commit: ad058dc)
- [x] tests/unit/core/logger.test.js → logger.test.ts (commit: 349f2e3)

- [x] src/core/migrations.js → migrations.ts (commit: 349f2e3)
- [x] tests/unit/core/migrations.test.js → migrations.test.ts (commit: 349f2e3)

### Phase 3: Core Application (Higher risk)

- [x] src/core/app.js → app.ts (commit: 516168e)
- [x] tests/unit/core/app.test.js → app.test.ts (commit: 476908a)

- [x] src/core/overlay.js → overlay.ts (commit: 1f76b22)
- [x] tests/unit/core/overlay.test.js → overlay.test.ts (commit: 1f76b22)

- [x] src/core/surfaces/surface-manager.js → surface-manager.ts (commit: e7f28f3)
- [x] tests/unit/core/surfaces/surface-manager.test.js → surface-manager.test.ts (commit: e7f28f3)

- [x] src/core/surfaces/*.js → *.ts (remaining surface definitions) (commit: e7f28f3)

### Phase 4: Platform Adapters

- [x] src/platform/adapter.js → adapter.ts (commit: ad058dc)
- [x] tests/mocks/adapter.js → adapter.ts (commit: ad058dc, updated in 344b9e6)

- [x] src/platform/userscript.js → userscript.ts (commit: f2cc712)
- [x] tests/mocks/userscript.js → userscript.ts (commit: f2cc712)

- [x] src/platform/webextension.js → webextension.ts (commit: f2cc712)
- [x] tests/mocks/webextension.js → webextension.ts (commit: f2cc712)

### Phase 5: UI Components

- [x] src/core/ui/modal.js → modal.ts (commit: 4c49812)
- [x] tests/unit/core/ui/modal.test.js → modal.test.ts (commit: 4c49812)

- [x] src/core/ui/settings-ui.js → settings-ui.ts (commit: 4c49812)

- [x] src/core/ui/settings-view.js → settings-view.ts (commit: 4c49812)

- [x] src/core/ui/overlay-elements.js → overlay-elements.ts (commit: 4c49812)

- [x] src/core/ui/overlay-styles.js → overlay-styles.ts (commit: 4c49812)

- [x] src/core/ui/styles.js → styles.ts (commit: 4c49812)
- [x] tests/unit/core/ui/settings-ui.test.js → settings-ui.test.ts (commit: 4c49812)
- [x] tests/unit/core/ui/settings-view.test.js → settings-view.test.ts (commit: 4c49812)
- [x] tests/unit/core/ui/elements/overlay-elements.test.js → overlay-elements.test.ts (commit: 4c49812)
- [x] tests/unit/core/ui/styles/overlay-styles.test.ts → overlay-styles.test.ts (commit: 4c49812)

### Phase 6: API Clients

- [x] src/core/api/base-api-client.js → base-api-client.ts (commit: 344b9e6)
- [x] tests/unit/core/api/base-api-client.test.js → base-api-client.test.ts (commit: 344b9e6)

- [x] src/core/api/xmdb-api-client.js → xmdb-api-client.ts (commit: 344b9e6)
- [x] tests/unit/core/api/xmdb-api-client.test.js → xmdb-api-client.test.ts (commit: 344b9e6)

- [x] src/core/api/omdb-api-client.js → omdb-api-client.ts (commit: 344b9e6)
- [x] tests/unit/core/api/omdb-api-client.test.js → omdb-api-client.test.ts (commit: 344b9e6)

- [x] src/core/api/agregarr-api-client.js → agregarr-api-client.ts (commit: 344b9e6)
- [x] tests/unit/core/api/agregarr-api-client.test.js → agregarr-api-client.test.ts (commit: 344b9e6)

- [x] src/core/api/title-type-mappers.js → title-type-mappers.ts (commit: 344b9e6)
- [x] tests/unit/core/api/title-type-mappers.test.js → title-type-mappers.test.ts (commit: 344b9e6)

- [x] src/core/api/index.js → index.ts (barrel) (commit: 344b9e6)

### Phase 7: Target Entry Points

- [ ] src/targets/extension/content.js → content.ts
- [ ] src/targets/extension/options.js → options.ts
- [ ] src/targets/extension/fetch-proxy.js → fetch-proxy.ts
- [ ] src/targets/extension/domains.js → domains.ts

- [ ] src/targets/firefox/manifest.json → (keep as JSON)
- [ ] src/targets/firefox/background.js → background.ts

- [ ] src/targets/chrome/manifest.json → (keep as JSON)
- [ ] src/targets/chrome/service-worker.js → service-worker.ts

- [ ] src/targets/userscript/entry.js → entry.ts
- [ ] src/targets/userscript/metadata.js → metadata.ts

### Phase 8: Test Infrastructure

- [ ] tests/mocks/chrome.js → chrome.ts
- [x] tests/mocks/config.js → config.ts (commit: ad058dc)
- [x] tests/mocks/logger.js → logger.ts (commit: ad058dc)
- [ ] tests/mocks/platform.js → platform.ts
- [ ] tests/mocks/webextension.js → webextension.ts
- [ ] tests/setup.js → setup.ts (already cleaned of MSW)

### Phase 8.5: Cache Tests

- [x] tests/mocks/cache.js → cache.ts (commit: ad058dc)
- [x] tests/unit/core/cache/cache.test.js → cache.test.ts (commit: ad058dc)

### Phase 9: UI Tests

- [ ] tests/ui/netflix.ui.test.js → netflix.ui.test.ts
- [ ] tests/ui/hbomax.ui.test.js → hbomax.ui.test.ts
- [ ] tests/ui/disneyplus.ui.test.ts → disneyplus.ui.test.ts

---

## Migration Instructions

1. **Before starting each file**: Check its dependencies - migrate leaf modules first
2. **Migrate in pairs**: Source file + its test + corresponding mock (if exists)
3. **Commit format**: `feat(ts-migration): migrate <module> to TypeScript`
4. **Verify**:
    - `npm run build` succeeds
    - `npm run lint` passes
    - `npm test` passes (all tests)
    - `npm run type-check` passes (once tsconfig is added)

## TypeScript Settings (tsconfig.json)

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "strict": true,
        "noImplicitAny": true,
        "strictNullChecks": true,
        "strictFunctionTypes": true,
        "noUnusedLocals": true,
        "noUnusedParameters": true,
        "noImplicitReturns": true,
        "exactOptionalPropertyTypes": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true
    }
}
```

## Rollback

- **Per file**: `git checkout HEAD~1 -- <file>`
- **Full rollback**: `git checkout pre-typescript-migration`

## Notes

- Use `null` instead of `undefined` throughout
- All functions must explicitly return on all code paths
- Optional properties are truly optional (no `undefined` values)
- Add JSDoc types for complex return types to help with migration

## Current Blockers

- **None** - API Manager (Task 3.3) unblocked by API Clients (Task 7.1) completion in commit 344b9e6

### Phase 0.5: Type Definitions

- [x] src/types/services.js → services.ts (commit: 18ff681)
- [x] src/types/overlay.js → overlay.ts (commit: 18ff681)
- [x] src/types/extension.js → extension.ts (commit: 18ff681)
- [x] src/types/index.js → index.ts (commit: 18ff681)
- [x] src/types/migrations.js → migrations.ts (commit: 18ff681)
- [x] src/types/platform.js → platform.ts (commit: 18ff681)
- [x] src/types/surfaces.js → surfaces.ts (commit: 18ff681)
- [x] src/types/title.js → title.ts (commit: 18ff681)

## Next Steps

1. ✅ **API Clients** (Task 7.1) - COMPLETED in commit 344b9e6
2. ✅ **API Manager** (Task 3.3) - COMPLETED in commit 2cb2b2b
3. ✅ **Services** (Task 3.4) - COMPLETED in commit 18ff681
4. ✅ **Remaining Managers** (Task 3.5) - COMPLETED in commit 349f2e3
5. ✅ **Cache** (Task 3.1) - COMPLETED in commit ad058dc
6. ✅ **App & Overlay** (Task 4.1-4.3) - COMPLETED in commits 1f76b22, 516168e, 476908a
7. ✅ **Platform Adapters** (Task 5.2) - COMPLETED in commit f2cc712
8. ✅ **UI Components** (Task 6.1) - COMPLETED in commit 4c49812
9. **Target Entry Points** (Tasks 8.1-8.4) - NEXT: Migrate content.js, options.js, fetch-proxy.js, domains.js, background.js, service-worker.js, entry.js, metadata.js
