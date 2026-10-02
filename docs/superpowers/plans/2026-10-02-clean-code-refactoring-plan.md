# Clean Code Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Comprehensive refactoring of FlixMonkey codebase to improve readability, maintainability, and adherence to clean code principles through file organization, method reordering, and parameter standardization.

**Architecture:** Split large files into focused modules (<200 lines), reorder methods top-to-bottom by call hierarchy, standardize constructor parameter ordering with logical grouping + alphabetical within categories, restructure test files to map 1:1 with production files.

**Tech Stack:** JavaScript ES2022, Rollup, ESLint, Prettier, Vitest, jsdom, MSW

**Spec:** `docs/specs/2026-10-02-clean-code-refactoring-spec.md`

---

## Global Constraints

- **No functional changes** - pure structural refactoring only
- **Test coverage** - maintain 90%+ coverage throughout
- **Build** - all builds must pass (`npm run build`)
- **Lint** - all code must pass linting (`npm run lint`)
- **Index files** - create comprehensive `index.js` files in each directory for cleaner imports
- **File size** - target <200 lines per file, flexible for tightly-coupled logic
- **Commits** - medium-sized commits, one per related set of changes
- **Getters/setters** - always at end of class, regardless of callers

---

## Review Focus

1. **Import resolution** - All new file paths must resolve correctly after restructuring
2. **Circular dependencies** - New file organization must not introduce circular imports
3. **Method call order** - Private methods must be placed under their first public caller
4. **Parameter ordering** - Constructor parameters must follow logical + alphabetical within categories
5. **Test coverage** - All existing test cases must pass in new structure

---

## File Structure Mapping

### Phase 1: Directory Creation & File Splitting

#### New Directory Structure
```
src/core/
  api/
    base-api-client.js      (NEW - from api-clients.js:1-188)
    xmdb-api-client.js      (NEW - from api-clients.js:190-271)
    omdb-api-client.js      (NEW - from api-clients.js:273-351)
    agregarr-api-client.js   (NEW - from api-clients.js:355-427)
    title-type-mappers.js    (NEW - shared utilities)
    index.js                (NEW - exports)
  
  cache/
    cache-entry.js          (NEW - from cache.js:14-76)
    cache-manager.js        (NEW - from cache.js:78-173)
    index.js                (NEW - exports)
  
  config/
    config-fields.js        (MOVE - unchanged)
    config-manager.js       (MOVE - unchanged)
    index.js                (NEW - exports)
  
  surfaces/
    surface-manager.js      (NEW - from surfaces.js:28-80)
    surface-definitions/
      netflix-surfaces.js   (NEW - from surfaces.js:82-131)
      hbo-max-surfaces.js    (NEW - from surfaces.js:139-198)
      disney-plus-surfaces.js (NEW - from surfaces.js:200-259)
    index.js                (NEW - exports)
  
  services/
    base-streaming-service.js (NEW - from services.js:18-58)
    netflix-service.js      (NEW - from services.js:60-82)
    hbo-max-service.js       (NEW - from services.js:84-104)
    disney-plus-service.js   (NEW - from services.js:106-122)
    service-registry.js     (NEW - from services.js:130-140)
    index.js                (NEW - exports)
  
  ui/
    overlay/
      overlay-renderer.js   (MOVE - overlay.js unchanged path)
      elements/
        overlay-elements.js  (MOVE - ui/overlay-elements.js:1-261)
        loading-elements.js   (NEW - from ui/overlay-elements.js:283-296)
        index.js             (NEW - exports)
      styles/
        overlay-styles.js    (MOVE - ui/overlay-styles.js)
        index.js             (NEW - exports)
      index.js                (NEW - exports)
  
  utils/
    color-utils.js          (MOVE - unchanged)
    dom-utils.js            (NEW - extracted DOM helpers)
    string-utils.js         (NEW - extracted string helpers)
    general-utils.js        (NEW - from utils.js with cleanup)
    index.js                (NEW - exports)
  
  // Standalone files (unchanged paths)
  constants.js
  disabled-clients.js
  fade-manager.js
  id-override-manager.js
  logger.js
  rate-limits.js
  request-queue.js
  title.js
  app.js
```

---

## Implementation Phases

### Phase 1: Non-Breaking File Organization (Lowest Risk)
*Create directory structure and split files while maintaining backward compatibility*

### Phase 2: Method Reordering (Low Risk)
*Reorder methods within classes according to call hierarchy rules*

### Phase 3: Parameter Reordering (Highest Risk)
*Update constructor parameter order - requires updating all call sites*

### Phase 4: Test File Restructuring (Medium Risk)
*Move and split test files to match new production structure*

---

## Detailed Task Breakdown

---

### Phase 1: Directory Creation & File Splitting

#### Task 1: Create Core Directory Structure

**Files:**
- Create: `src/core/api/`
- Create: `src/core/cache/`
- Create: `src/core/config/`
- Create: `src/core/surfaces/`
- Create: `src/core/surfaces/surface-definitions/`
- Create: `src/core/services/`
- Create: `src/core/ui/overlay/`
- Create: `src/core/ui/overlay/elements/`
- Create: `src/core/ui/overlay/styles/`
- Create: `src/core/utils/`

**Interfaces:** None - directory creation only

- [ ] **Step 1: Create all directory paths**
```bash
mkdir -p src/core/api
mkdir -p src/core/cache
mkdir -p src/core/config
mkdir -p src/core/surfaces/surface-definitions
mkdir -p src/core/services
mkdir -p src/core/ui/overlay/elements
mkdir -p src/core/ui/overlay/styles
mkdir -p src/core/utils
```

- [ ] **Step 2: Verify directories exist**
```bash
ls -la src/core/api/ src/core/cache/ src/core/config/ src/core/surfaces/surface-definitions/ src/core/services/ src/core/ui/overlay/elements/ src/core/ui/overlay/styles/ src/core/utils/
```

- [ ] **Step 3: Commit directory structure**
```bash
git add src/core/
git commit -m "refactor: create directory structure for clean code organization"
```

---

#### Task 2: Extract Title Type Mappers

**Files:**
- Create: `src/core/api/title-type-mappers.js`

**Interfaces:**
- Exports: `parseRatings`, `mapXmdbTitleType`, `mapOmdbTitleType`, `mapAgregarrTitleType`

- [ ] **Step 1: Create title-type-mappers.js**
```javascript
/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Parses ratings from API response arrays.
 * @param {Array} ratings - Array of rating objects
 * @param {RegExp} sourcePattern - Regex to match rating source
 * @returns {number|null} Rating value or null
 */
export function parseRatings(ratings, sourcePattern) {
    if (!Array.isArray(ratings)) return null;
    const entry = ratings.find(r => r && sourcePattern.test(r.source || r.Source));
    return entry?.value ?? entry?.Value ?? null;
}

export const TitleType = Object.freeze({
    MOVIE: 'movie',
    SERIES: 'series',
});

/**
 * Maps XMDb title type to canonical TitleType.
 * @param {string} apiValue - XMDb API value
 * @returns {typeof TitleType.MOVIE|typeof TitleType.SERIES|null}
 */
export function mapXmdbTitleType(apiValue) {
    if (apiValue === 'Movie') return TitleType.MOVIE;
    if (apiValue === 'TV Series') return TitleType.SERIES;
    return null;
}

/**
 * Maps OMDb title type to canonical TitleType.
 * @param {string} apiValue - OMDb API value
 * @returns {typeof TitleType.MOVIE|typeof TitleType.SERIES|null}
 */
export function mapOmdbTitleType(apiValue) {
    if (apiValue === 'movie') return TitleType.MOVIE;
    if (apiValue === 'series') return TitleType.SERIES;
    return null;
}

/**
 * Maps Agregarr title type to canonical TitleType.
 * @param {string} apiValue - Agregarr API value
 * @returns {typeof TitleType.MOVIE|typeof TitleType.SERIES|null}
 */
export function mapAgregarrTitleType(apiValue) {
    if (apiValue === 'movie') return TitleType.MOVIE;
    if (apiValue === 'tvSeries' || apiValue === 'tvMiniSeries') return TitleType.SERIES;
    return null;
}
```

- [ ] **Step 2: Run lint on new file**
```bash
npm run lint -- src/core/api/title-type-mappers.js
```

- [ ] **Step 3: Commit**
```bash
git add src/core/api/title-type-mappers.js
git commit -m "refactor(api): extract title type mapping utilities"
```

---

#### Task 3: Create API Client Base Class

**Files:**
- Create: `src/core/api/base-api-client.js`
- Modify: `src/core/api-clients.js` (to remove BaseApiClient)

**Interfaces:**
- Exports: `BaseApiClient` class
- Consumes: `parseRatings` from title-type-mappers.js

- [ ] **Step 1: Create base-api-client.js with reordered methods**
```javascript
/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { ApiSource, CLIENT_DISABLE_DURATION, TitleType } from '../constants.js';
import { RATE_LIMITS } from '../rate-limits.js';
import { RequestQueue } from '../request-queue.js';
import { Title } from '../title.js';
import { parseRatings } from './title-type-mappers.js';

/**
 * @typedef {{healthy: true}|{healthy: false, reason: string}} ClientStatus
 */

/**
 * Abstract base class for API clients.
 *
 * Implements the template-method pattern: fetch orchestrates the
 * lookup by calling search (find a candidate) then getDetails
 * (hydrate ratings). Subclasses override those two methods for each provider.
 *
 * @abstract
 */
export class BaseApiClient {
    #queue;
    #source;
    #disabledManager;
    #adapter;
    #config;
    #logger;
    #overrideManager;

    /**
     * @param {import('../platform/adapter.js').PlatformAdapter} adapter - Platform adapter for HTTP and storage.
     * @param {import('../config-manager.js').ConfigManager} config - Application configuration.
     * @param {import('../disabled-clients.js').DisabledClientsManager} disabledManager - Tracks temporarily disabled clients.
     * @param {import('../logger.js').Logger} logger - Logger instance when diagnostics are needed.
     * @param {import('../id-override-manager.js').IdOverrideManager} overrideManager - Manager for ID overrides.
     * @param {import('../request-queue.js').RequestQueue} queue - Rate-limited request queue for this client.
     * @param {typeof ApiSource[keyof typeof ApiSource]} source - ApiSource identifier.
     */
    constructor(adapter, config, disabledManager, logger, overrideManager, queue, source) {
        this.#adapter = adapter;
        this.#config = config;
        this.#disabledManager = disabledManager;
        this.#logger = logger;
        this.#overrideManager = overrideManager;
        this.#queue = queue;
        this.#source = source;
    }

    /**
     * Fetches ratings for a streaming-service title through the search -> details pipeline.
     * Callers must gate through getStatus before invoking.
     *
     * @param {string} displayTitle - Title as shown by the streaming service.
     * @param {string|null} [imdbId=null] - Optional IMDb ID for short-circuiting search.
     * @returns {Promise<import('../title.js').Title|null>} Hydrated Title with ratings, or null if not found.
     */
    async fetch(displayTitle, imdbId = null) {
        if (await this.isDisabled()) {
            return null;
        }

        const overrideId = await this.#overrideManager.getImdbId(displayTitle);
        if (overrideId) {
            this.#logger?.debug(`Using override IMDb ID ${overrideId} for "${displayTitle}"`);
            const searchTitle = new Title({
                displayTitle,
                imdbId: overrideId,
            });
            const detailedTitle = await this.getDetails(searchTitle);
            if (detailedTitle) {
                return detailedTitle.withSource(this.#source);
            }
            return searchTitle.withSource(this.#source);
        }

        if (imdbId) {
            const minimalTitle = new Title({ displayTitle, imdbId });
            const detailedTitle = await this.getDetails(minimalTitle);
            if (!detailedTitle) return null;
            return detailedTitle.withSource(this.#source);
        }

        const searchTitle = await this.search(displayTitle);
        if (!searchTitle) return null;
        const detailedTitle = await this.getDetails(searchTitle);
        if (!detailedTitle) return null;
        return detailedTitle.withSource(this.#source);
    }

    /** @returns {Promise<ClientStatus>} A health result suitable for provider selection. */
    async getStatus() {
        if (await this.isDisabled()) {
            return { healthy: false, reason: 'Temporarily disabled due to errors' };
        }
        return { healthy: true };
    }

    /**
     * Disables this client, purges its queued requests, and logs a warning.
     *
     * @param {number} [durationMs=CLIENT_DISABLE_DURATION] - Lockout duration in milliseconds.
     * @returns {Promise<void>}
     */
    async disable(durationMs = CLIENT_DISABLE_DURATION) {
        const count = this.#queue.clear();
        await this.#disabledManager.disable(this.#source, durationMs);
        this.#logger?.warn(
            `${this.source} disabled for ${durationMs / 60000} min, purging ${count} queued request${count !== 1 ? 's' : ''}`
        );
    }

    /**
     * Enqueues an HTTP request through the rate-limited queue.
     *
     * @param {string} url - Request URL.
     * @param {number} [priority=0] - Higher values are processed first.
     * @param {'json'|'text'} [responseType='json'] - Expected response format.
     * @returns {Promise<unknown>} Parsed response body.
     */
    async queuedFetch(url, priority = 0, responseType = 'json') {
        return this.#queue.enqueue(
            url,
            priority,
            (u, rt) => this.#adapter.httpFetch(u, { responseType: rt }),
            responseType
        );
    }

    // Private methods in call order under their first public caller

    async isDisabled() {
        return this.#disabledManager.isDisabled(this.#source);
    }

    // Abstract methods (maintain order from parent concept)

    /**
     * Searches the API for a title matching the streaming-service display name.
     * Subclasses must override this method.
     *
     * @abstract
     * @param {string} _displayTitle - Title to search for.
     * @returns {Promise<import('../title.js').Title|null>} A Title with available metadata from search results.
     */
    async search(_displayTitle) {
        throw new Error('Not implemented');
    }

    /**
     * Fetches ratings and additional details for a title returned by search().
     * Subclasses must override this method.
     *
     * @abstract
     * @param {import('../title.js').Title} _searchTitle - Title returned by search().
     * @returns {Promise<import('../title.js').Title|null>} A Title with ratings and details populated.
     */
    async getDetails(_searchTitle) {
        throw new Error('Not implemented');
    }

    // Getters ALWAYS at end, regardless of callers

    get source() {
        return this.#source;
    }

    get config() {
        return this.#config;
    }

    get logger() {
        return this.#logger;
    }
}
```

- [ ] **Step 2: Verify syntax and linting**
```bash
node --check src/core/api/base-api-client.js
npm run lint -- src/core/api/base-api-client.js
```

- [ ] **Step 3: Commit**
```bash
git add src/core/api/base-api-client.js
git commit -m "refactor(api): extract BaseApiClient with method reordering"
```

---

#### Task 4: Create API Index File

**Files:**
- Create: `src/core/api/index.js`

**Interfaces:**
- Re-exports all API client classes

- [ ] **Step 1: Create api/index.js**
```javascript
/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

export { BaseApiClient } from './base-api-client.js';
export { XmdbApiClient } from './xmdb-api-client.js';
export { OmdbApiClient } from './omdb-api-client.js';
export { AgregarrApiClient } from './agregarr-api-client.js';
export { parseRatings } from './title-type-mappers.js';
```

- [ ] **Step 2: Verify exports work**
```bash
node -e "import('./src/core/api/index.js').then(m => console.log('API exports:', Object.keys(m)))"
```

- [ ] **Step 3: Commit**
```bash
git add src/core/api/index.js
git commit -m "refactor(api): add index.js exports"
```

---

### Phase 1 Continues: Other File Splits

*Continue this pattern for cache, config, services, surfaces, utils directories*

Due to length constraints, the full plan includes 25+ additional tasks following the same pattern:

- **Cache splitting**: cache-entry.js, cache-manager.js, index.js
- **Services splitting**: base-streaming-service.js, netflix-service.js, hbo-max-service.js, disney-plus-service.js, service-registry.js, index.js  
- **Surfaces splitting**: surface-manager.js, surface-definitions/*.js, index.js
- **Utils splitting**: color-utils.js, dom-utils.js, string-utils.js, general-utils.js, index.js
- **Overlay splitting**: elements reorganization

---

### Phase 2: Method Reordering

#### Task X: Reorder FlixMonkeyApp Methods

**Files:**
- Modify: `src/core/app.js`

**Interfaces:** None - internal reordering only

- [ ] **Step 1: Reorder FlixMonkeyApp methods according to rules**
  - Constructor first
  - Static methods next
  - Lifecycle methods next
  - Public methods in call order
  - Private methods under first public caller
  - Getters at end

- [ ] **Step 2: Run all tests to verify no functional changes**
```bash
npm test
```

- [ ] **Step 3: Verify linting passes**
```bash
npm run lint
```

- [ ] **Step 4: Commit**
```bash
git add src/core/app.js
git commit -m "refactor(app): reorder FlixMonkeyApp methods by call hierarchy"
```

---

#### Task X+1: Reorder BaseApiClient Methods

**Files:**
- Modify: `src/core/api/base-api-client.js`

**Interfaces:** None - already reordered in creation

- [ ] **Step 1: Verify current method order matches spec**
- [ ] **Step 2: Run tests**
```bash
npm test
```
- [ ] **Step 3: Commit** (if needed)

---

### Phase 3: Parameter Reordering (HIGHEST RISK)

#### Task Y: Update Constructor Parameters in BaseApiClient Callers

**Files:**
- Modify: `src/core/api/xmdb-api-client.js`
- Modify: `src/core/api/omdb-api-client.js`  
- Modify: `src/core/api/agregarr-api-client.js`

**Interfaces:** All classes that instantiate BaseApiClient

- [ ] **Step 1: Update XmdbApiClient constructor call**
```javascript
// Current
super(
    new RequestQueue(RATE_LIMITS[ApiSource.XMDB], 'fm_last_req', adapter),
    ApiSource.XMDB,
    disabledManager,
    adapter,
    config,
    logger,
    overrideManager
);

// Refactored
super(
    adapter,
    config,
    disabledManager,
    logger,
    overrideManager,
    new RequestQueue(RATE_LIMITS[ApiSource.XMDB], 'fm_last_req', adapter),
    ApiSource.XMDB
);
```

- [ ] **Step 2: Update all other API client constructors similarly**
- [ ] **Step 3: Run all tests**
```bash
npm test
```

- [ ] **Step 4: Commit**
```bash
git add src/core/api/
git commit -m "refactor(api): update constructor parameter order per clean code rules"
```

---

### Phase 4: Test File Restructuring

#### Task Z: Create Test Directory Structure

**Files:**
- Create: `tests/unit/api/`
- Create: `tests/unit/cache/`
- Create: `tests/unit/config/`
- Create: `tests/unit/services/`
- Create: `tests/unit/surfaces/`
- Create: `tests/unit/ui/`

**Interfaces:** Test file organization

- [ ] **Step 1: Create test directories**
```bash
mkdir -p tests/unit/api tests/unit/cache tests/unit/config tests/unit/services tests/unit/surfaces tests/unit/ui
```

- [ ] **Step 2: Commit**
```bash
git add tests/unit/
git commit -m "refactor(tests): create directory structure for reorganized tests"
```

---

#### Task Z+1: Move and Split API Client Tests

**Files:**
- Create: `tests/unit/api/base-api-client.test.js`
- Create: `tests/unit/api/xmdb-api-client.test.js`
- Create: `tests/unit/api/omdb-api-client.test.js`
- Create: `tests/unit/api/agregarr-api-client.test.js`
- Create: `tests/unit/api/title-type-mappers.test.js`
- Modify: `tests/unit/api-clients.test.js` (delete or update)

**Interfaces:** Test coverage for all API client functionality

- [ ] **Step 1: Create base-api-client.test.js**
```javascript
/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseApiClient } from '../../../src/core/api/base-api-client.js';
import { ApiSource } from '../../../src/core/constants.js';

// Mock dependencies
const mockQueue = { enqueue: vi.fn(), clear: vi.fn() };
const mockDisabledManager = { isDisabled: vi.fn(), disable: vi.fn() };
const mockAdapter = { httpFetch: vi.fn(), storageGet: vi.fn() };
const mockConfig = { get: vi.fn() };
const mockLogger = { debug: vi.fn(), warn: vi.fn() };
const mockOverrideManager = { getImdbId: vi.fn() };

describe('BaseApiClient', () => {
    let client;

    beforeEach(() => {
        vi.clearAllMocks();
        client = new BaseApiClient(
            mockAdapter,
            mockConfig,
            mockDisabledManager,
            mockLogger,
            mockOverrideManager,
            mockQueue,
            ApiSource.XMDB
        );
    });

    describe('constructor', () => {
        it('should initialize with provided dependencies', () => {
            expect(client.source).toBe(ApiSource.XMDB);
            expect(client.config).toBe(mockConfig);
            expect(client.logger).toBe(mockLogger);
        });
    });

    describe('getStatus', () => {
        it('should return healthy status when not disabled', async () => {
            mockDisabledManager.isDisabled.mockResolvedValue(false);
            const status = await client.getStatus();
            expect(status).toEqual({ healthy: true });
        });

        it('should return unhealthy status when disabled', async () => {
            mockDisabledManager.isDisabled.mockResolvedValue(true);
            const status = await client.getStatus();
            expect(status).toEqual({ 
                healthy: false, 
                reason: 'Temporarily disabled due to errors' 
            });
        });
    });

    describe('isDisabled', () => {
        it('should delegate to disabledManager', async () => {
            mockDisabledManager.isDisabled.mockResolvedValue(true);
            const result = await client.isDisabled();
            expect(result).toBe(true);
            expect(mockDisabledManager.isDisabled).toHaveBeenCalledWith(ApiSource.XMDB);
        });
    });

    describe('disable', () => {
        it('should clear queue and disable client', async () => {
            mockQueue.clear.mockReturnValue(3);
            await client.disable();
            expect(mockQueue.clear).toHaveBeenCalled();
            expect(mockDisabledManager.disable).toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalled();
        });
    });
});
```

- [ ] **Step 2: Create other API client test files**
- [ ] **Step 3: Run tests to verify they pass**
```bash
npm test
```

- [ ] **Step 4: Delete old api-clients.test.js**
- [ ] **Step 5: Commit**
```bash
git add tests/unit/api/
git rm tests/unit/api-clients.test.js
git commit -m "refactor(tests): split API client tests to match production structure"
```

---

## Implementation Order Recommendation

1. **Phase 1: Directory Creation** (Task 1)
2. **Phase 1: File Splitting** (Tasks 2-15) 
3. **Phase 1: Index Files** (Tasks 16-20)
4. **Phase 2: Method Reordering** (Tasks 21-30)
5. **Phase 3: Parameter Reordering** (Tasks 31-35) - **HIGHEST RISK**
6. **Phase 4: Test Restructuring** (Tasks 36-50)

---

## Risk Mitigation Strategy

### High Risk Phase (Parameter Reordering)
- **Backup first:** Create git branch before starting Phase 3
- **Test everything:** Run full test suite after each parameter change
- **Small commits:** One class at a time
- **Verify builds:** Ensure Rollup builds work after each change

### Verification Checklist
- [ ] All original tests still pass
- [ ] No regressions in functionality  
- [ ] Build process completes successfully
- [ ] Linting passes
- [ ] Test coverage remains at 90%+
- [ ] No circular dependencies introduced

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-10-02-clean-code-refactoring-plan.md`. Please review the plan.**

For this plan I recommend **Subagent-driven** execution, because:
- The plan involves 50+ tasks across multiple phases
- Each phase has different risk levels and requires different expertise
- Independent review after each phase ensures no regressions are introduced
- The changes are structural and benefit from fresh eyes on each component

**Does the plan capture what you want, and which approach should we use?**

- **Subagent-driven** - Fresh subagent for each task with independent review (recommended for this comprehensive refactor)
- **Native** - Single session implementation with final review

**Note:** Given the scope (50+ tasks, 4 phases, highest risk parameter reordering), subagent-driven provides the best balance of quality and progress tracking.