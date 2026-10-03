# Clean Code Refactoring Specification

**Date:** 2026-10-02  
**Author:** FlixMonkey Refactoring  
**Status:** Draft  
**Type:** Architectural  

---

## Executive Summary

This specification defines a comprehensive refactoring of the FlixMonkey codebase to improve code readability, maintainability, and adherence to clean code principles. The refactoring focuses on **structural improvements only** - no functional changes will be made.

### Primary Objectives

1. **Manageable Sizes**: Split large files into smaller, focused modules (<200 lines where possible)
2. **Readable Call Order**: Reorganize methods top-to-bottom by call hierarchy
3. **Consistent Parameter Order**: Standardize constructor and method parameter ordering
4. **Maintainable Structure**: Prepare for potential TypeScript migration

### Non-Objectives

- No functional behavior changes
- No performance optimizations
- No new features
- No breaking changes to public APIs

---

## Method Ordering Rules

### Core Principle: Top-to-Bottom Call Order

Methods are ordered based on their **call hierarchy**, not alphabetically or by visibility.

### Specific Rules

1. **Constructor** - Always first in class
2. **Static Methods** - Grouped immediately after constructor (no instance dependencies)
3. **Lifecycle Methods** - Grouped after static methods, before other public methods
4. **Public Methods** - Ordered by first call appearance in the class
5. **Private Methods** - Placed directly under the **first** public method that calls them, in call order
6. **Getter/Setter Methods** - **Always at the end of the class, regardless of callers**
7. **Inherited/Overridden Methods** - Maintain relative position to parent class

### Primary Caller Rule (Critical Clarification)

When a private method is called by multiple public methods, it is placed under its **first** public method in call order:

```javascript
class Example {
    constructor() {}
    
    publicMethodA() { this.#shared(); }  // First to call #shared()
    #shared() { /* used by A and D */ }
    publicMethodD() { this.#shared(); }  // References #shared() above
}
```

### Example Pattern

```javascript
class Example {
    constructor() { /* ... */ }
    
    // Static methods (no instance dependencies)
    static utilityMethod() { /* ... */ }
    
    // Lifecycle methods
    init() { /* ... */ }
    destroy() { /* ... */ }
    
    // Public method A calls private method b
    publicMethodA() { 
        this.#b(); 
    }
    
    // Private method b calls private method c  
    #b() { 
        this.#c(); 
    }
    
    #c() { /* ... */ }
    
    // Public method D (doesn't depend on A/b/c hierarchy)
    publicMethodD() { /* ... */ }
    
    // Getters/setters ALWAYS at end, regardless of callers
    get someProperty() { /* ... */ }
    set anotherProperty(value) { /* ... */ }
}
```

### Visual Flow

```
┌─────────────────┐
│   constructor    │ ← Always first
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  publicMethodA   │
│  calls: #b()     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     #b()        │ ← Private method used by publicMethodA
│  calls: #c()     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     #c()        │ ← Private method used by #b()
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  publicMethodD   │ ← Next public method
└─────────────────┘
         │
         ▼
┌─────────────────┐
│   get property  │ ← Getters/setters last
└─────────────────┘
```

---

## Constructor Parameter Ordering Rules

### Logical Grouping with Alphabetical Sorting Within Groups

Parameters are organized into **logical categories**, with **alphabetical ordering within each category**.

### Parameter Categories (in order)

1. **Core Infrastructure** (platform abstraction, fundamental services)
   - `adapter` - Platform adapter for storage/HTTP
   - `config` - Configuration manager  
   - `logger` - Logging service

2. **Domain-Specific Dependencies** (business logic components)
   - `cache` - Cache management
   - `disabledManager` - Client disable tracking
   - `overrideManager` - ID override management
   - `surfaces` - Surface discovery
   - `renderer` - UI rendering
   - `fadeManager` - Fade state management

3. **Client/Service Dependencies** (API clients, external services)
   - `api` - API client manager
   - `client` - Specific API client
   - `queue` - Request queue

4. **Optional Parameters**
   - `options` - Configuration object
   - `...rest` - Additional parameters

### Examples

```javascript
// Current (inconsistent)
constructor(disabledManager, adapter, config, logger, overrideManager)

// Refactored (logical + alphabetical within categories)
constructor(
    // Core Infrastructure (alphabetical: adapter, config, logger)
    adapter,
    config, 
    logger,
    
    // Domain Dependencies (alphabetical: disabledManager, overrideManager)
    disabledManager,
    overrideManager
)
```

```javascript
// Current FlixMonkeyApp constructor
constructor(cache, api, renderer, surfaces, fadeManager, config, logger, overrideManager)

// Refactored
constructor(
    // Core Infrastructure
    config,
    logger,
    
    // Domain Dependencies (alphabetical)
    cache,
    fadeManager,
    overrideManager,
    renderer,
    surfaces,
    
    // Client/Service Dependencies
    api
)
```

---

## File Organization Strategy

### Directory Structure Changes

#### Current Structure
```
src/core/
  api-clients.js          (427 lines - TOO LARGE)
  api-manager.js          (98 lines)
  app.js                  (351 lines - TOO LARGE)  
  cache.js                (175 lines)
  config-manager.js       (64 lines)
  surfaces.js             (259 lines - TOO LARGE)
  overlay.js              (113 lines)
  utils.js                (54 lines)
  color-utils.js           (96 lines)
  request-queue.js         (106 lines)
  disabled-clients.js      (45 lines)
  fade-manager.js          (40 lines)
  id-override-manager.js   (56 lines)
  logger.js               (33 lines)
  services.js              (140 lines)
  title.js                (149 lines)
  ui/
    overlay-elements.js    (296 lines - TOO LARGE)
    overlay-styles.js
```

#### Target Structure
```
src/core/
  api/
    base-api-client.js     (~180 lines)
    xmdb-api-client.js     (~80 lines)
    omdb-api-client.js     (~80 lines)  
    agregarr-api-client.js  (~80 lines)
    title-type-mappers.js   (~30 lines)
    index.js               (exports)
  
  cache/
    cache-entry.js         (~75 lines)
    cache-manager.js       (~100 lines)
    index.js
    
  config/
    config-fields.js       (unchanged)
    config-manager.js      (unchanged)
    index.js
    
  services/
    service-registry.js    (~60 lines)
    base-streaming-service.js (~40 lines)
    netflix-service.js     (~30 lines)
    hbo-max-service.js      (~30 lines)
    disney-plus-service.js  (~30 lines)
    index.js
    
  surfaces/
    surface-manager.js     (~50 lines)
    surface-definitions/
      netflix-surfaces.js  (~80 lines)
      hbo-max-surfaces.js   (~80 lines)
      disney-plus-surfaces.js (~80 lines)
    index.js
    
  ui/
    overlay/
      overlay-renderer.js  (~80 lines)
      elements/
        overlay-elements.js (~200 lines)
        loading-elements.js (~50 lines)
      styles/
        overlay-styles.js   (~60 lines)
      index.js
    
  utils/
    color-utils.js         (unchanged)
    dom-utils.js           (new - ~40 lines)
    string-utils.js        (new - ~30 lines)  
    general-utils.js       (~40 lines)
    index.js
    
  constants.js            (unchanged)
  disabled-clients.js     (unchanged)
  fade-manager.js         (unchanged)
  id-override-manager.js  (unchanged)
  logger.js              (unchanged)
  rate-limits.js          (unchanged)
  request-queue.js        (unchanged)
  title.js               (unchanged)
  app.js                 (~250 lines - reduced)
```

### File Splitting Strategy

#### 1. `api-clients.js` → `api/` directory

**Rationale:** 427 lines with base class + 3 implementations + shared utilities

**Splitting:**
- `base-api-client.js`: `BaseApiClient` class only
- `xmdb-api-client.js`: `XmdbApiClient` class only  
- `omdb-api-client.js`: `OmdbApiClient` class only
- `agregarr-api-client.js`: `AgregarrApiClient` class only
- `title-type-mappers.js`: Shared `#mapTitleType` logic

**Shared utilities extraction:**
```javascript
// Current: parseRatings function at top of api-clients.js
// Refactored: Move to title-type-mappers.js or create utilities file
```

#### 2. `app.js` → Partial extraction

**Rationale:** 351 lines with multiple responsibilities

**Extract:**
- Keep `FlixMonkeyApp` in `app.js` (reduced)
- Move `createApiClient` to `api/factory.js`
- Keep `startApp` factory function

#### 3. `surfaces.js` → `surfaces/` directory

**Rationale:** 259 lines with surface definitions for 3 services

**Splitting:**
- `surface-manager.js`: `SurfaceManager` base class
- `surface-definitions/`: Each service's surface definitions
- Extract helper functions to utility files

#### 4. `overlay-elements.js` → `ui/overlay/elements/` directory

**Rationale:** 296 lines with many helper functions

**Splitting:**
- Group related element creators
- Extract color calculation logic
- Separate loading vs. complete overlay elements

---

## Detailed File-by-File Refactoring

### 1. `api/base-api-client.js`

**Current:** Lines 1-188 in `api-clients.js`

**Method Order Analysis:**
```
Current order:
- constructor
- fetch() [public] 
- getStatus() [public]
- isDisabled() [public]
- search() [public, abstract]
- getDetails() [public, abstract]
- queuedFetch() [public]
- disable() [public]
- source [getter]
- config [getter] 
- logger [getter]

Call hierarchy:
- fetch() calls: isDisabled(), search(), getDetails(), overrideManager.getImdbId(), queuedFetch()
- getStatus() calls: isDisabled()
- disable() calls: queue.clear(), disabledManager.disable()
- queuedFetch() calls: queue.enqueue(), adapter.httpFetch()
```

**Refactored Order:**
```javascript
class BaseApiClient {
    // 1. Constructor
    constructor(adapter, config, disabledManager, logger, overrideManager, queue, source) {}
    
    // 2. Static methods (none in this class)
    
    // 3. Lifecycle methods (none in this class)
    
    // 4. Public methods in call order
    async fetch(displayTitle, imdbId = null) {}
    async getStatus() {}
    async disable(durationMs = CLIENT_DISABLE_DURATION) {}
    async queuedFetch(url, priority = 0, responseType = 'json') {}
    
    // 5. Abstract methods (maintain order from parent concept)
    async search(_displayTitle) {}
    async getDetails(_searchTitle) {}
    
    // 6. Private methods in call order under their first public caller
    async isDisabled() {}  // Used by fetch() and getStatus() - goes under fetch()
    
    // 7. Getters ALWAYS at end, regardless of callers
    get source() {}
    get config() {}
    get logger() {}
}
```

**Parameter Reordering:**
```javascript
// Current
constructor(queue, source, disabledManager, adapter, config, logger, overrideManager)

// Refactored (logical + alphabetical within categories)
constructor(
    // Core Infrastructure
    adapter,
    config,
    logger,
    
    // Domain Dependencies  
    disabledManager,
    overrideManager,
    
    // Client/Service Dependencies
    queue,
    source
)
```

### 2. `api/xmdb-api-client.js`

**Current:** Lines 190-271 in `api-clients.js`

**Method Order Analysis:**
- constructor calls super()
- getStatus() calls super.getStatus() and config.get()
- search() calls queuedFetch(), logger.debug/info()
- getDetails() calls queuedFetch(), logger.debug/warn()
- #mapTitleType() called by getDetails()

**Refactored Order:**
```javascript
class XmdbApiClient extends BaseApiClient {
    constructor(adapter, config, disabledManager, logger, overrideManager) {}
    
    async getStatus() {}
    async search(displayTitle) {}
    
    // Private method used by search/getDetails
    #mapTitleType(apiValue) {}
    
    async getDetails(searchTitle) {}
}
```

**Parameter Reordering:**
```javascript
// Current
constructor(disabledManager, adapter, config, logger, overrideManager)

// Refactored
constructor(
    adapter,
    config, 
    disabledManager,
    logger,
    overrideManager
)
```

### 3. `app.js` Refactoring

**Current Method Order Issues:**
- `#handleFadeToggleClick` (line 258) used by `#renderTitle` (line 237)
- `#getTitleRequest` (line 223) used by `#decorateContainer` (line 192)
- `#getFadeOverride` (line 219) used by `#decorateContainer`
- Many private methods scattered

**Refactored Method Order:**
```javascript
class FlixMonkeyApp {
    constructor(cache, api, renderer, surfaces, fadeManager, config, logger, overrideManager) {}
    
    // Static methods
    static createApiClient(config, disabledManager, adapter, logger, overrideManager) {}
    
    // Lifecycle methods
    init() {}
    disconnect() {}
    
    // Public methods in call order
    decorateRoot(root) {}
    redecorate() {}
    async clearCache() {}
    async resetDisabledClients() {}
    
    // Private methods in call order under their first public caller
    
    // Under init() - lifecycle setup
    #initNavigationObservers() {}
    
    // Under decorateRoot() - decoration flow
    async #decorateContainer(container, displayTitle, fadeable, showFadeToggle) {}
    #getFadeOverride(dedupKey) {}
    #getTitleRequest(dedupKey, displayTitle) {}
    #renderTitle(container, data, options) {}
    
    // Under #renderTitle() - rendering flow
    async #handleFadeToggleClick(dedupKey, imdbRating, toggleBadgeEl) {}
    
    // Under handleEditClick (public method)
    handleEditClick(displayTitle, imdbId) {}
    #extractImdbId(input) {}
    #redecorateTitle(dedupKey, displayTitle) {}
    
    handleRefreshClick(displayTitle) {}
    
    // Getters ALWAYS at end, regardless of callers
    get cacheManager() {}
    get disabledManager() {}
}

// Factory function (stays at bottom)
function startApp(adapter) {}
```

**Parameter Reordering for FlixMonkeyApp:**
```javascript
// Current
constructor(cache, api, renderer, surfaces, fadeManager, config, logger, overrideManager)

// Refactored (logical + alphabetical within categories)
constructor(
    // Core Infrastructure
    config,
    logger,
    
    // Domain Dependencies
    cache,
    fadeManager,
    overrideManager,
    renderer,
    surfaces,
    
    // Client/Service Dependencies
    api
)
```

### 4. Method Ordering for All Classes

The following tables show the **current order** vs **refactored order** for each class that needs reordering.

#### `CacheManager` (cache.js)

**Current:** constructor, read(), #getCacheKey(), write(), #calculateTtl(), clear(), delete()

**Call hierarchy:**
- read() calls #getCacheKey()
- write() calls #getCacheKey(), #calculateTtl()
- clear() calls adapter methods
- delete() calls #getCacheKey()

**Refactored:**
```javascript
class CacheManager {
    constructor(adapter, config, logger) {}
    
    // Static methods (none)
    
    // Lifecycle methods (none)
    
    // Public methods in call order
    async read(displayTitle) {}
    #getCacheKey(displayTitle) {}
    
    async write(displayTitle, titleObj) {}
    #calculateTtl(titleObj) {}
    
    async clear() {}
    async delete(displayTitle) {}
    
    // Getters ALWAYS at end, regardless of callers
    // (none in this class)
}
```

#### `RequestQueue` (request-queue.js)

**Current:** constructor, enqueue(), #process(), #getLastGlobalRequestTime(), #claimNextRequestSlot(), #syncClaimedRequestSlot(), #dispatchNextRequest(), clear()

**Call hierarchy:**
- enqueue() calls #process()
- #process() calls #getLastGlobalRequestTime(), #claimNextRequestSlot(), #syncClaimedRequestSlot(), #dispatchNextRequest()

**Refactored:**
```javascript
class RequestQueue {
    constructor(minInterval, globalSyncKey, adapter) {}
    
    // Static methods (none)
    
    // Lifecycle methods (none)
    
    // Public methods in call order
    enqueue(url, priority, fetchFn, responseType) {}
    
    // Private methods in call order under their first public caller
    async #process() {}
    async #getLastGlobalRequestTime() {}
    #claimNextRequestSlot() {}
    async #syncClaimedRequestSlot() {}
    async #dispatchNextRequest() {}
    
    clear() {}
    
    // Getters ALWAYS at end, regardless of callers
    // (none in this class)
}
```

#### `OverlayRenderer` (overlay.js)

**Current:** constructor, injectStyles(), hasOverlay(), isLoading(), ensureRelative(), injectLoadingOverlay(), injectOverlay(), removeLoadingOverlay(), applyFade(), clearAllOverlays()

**Analysis:** Methods are generally well-grouped by functionality. No major reordering needed, but apply call order.

**Call hierarchy:**
- injectOverlay() uses overlayClass, corner, config
- injectStyles() called by app.init()
- ensureRelative() called by #decorateContainer in app.js

**Refactored:**
```javascript
class OverlayRenderer {
    constructor(config, serviceConstants, onEditClick, onRefreshClick) {}
    
    // Static methods (none)
    
    // Lifecycle methods (none)
    
    // Public methods in call order
    injectStyles() {}
    
    hasOverlay(container) {}
    isLoading(container) {}
    ensureRelative(container) {}
    
    injectLoadingOverlay(container) {}
    removeLoadingOverlay(container) {}
    
    injectOverlay(container, titleObj, fadeToggleState, onFadeToggleClick, onEditClick, onRefreshClick, displayTitle) {}
    
    applyFade(container, shouldFade) {}
    clearAllOverlays() {}
    
    // Getters ALWAYS at end, regardless of callers
    // (none in this class)
}
```

#### `SurfaceManager` (surfaces.js)

**Current:** constructor, discover()

**Analysis:** Simple class, only 2 methods. No reordering needed.

### 5. `overlay-elements.js` Function Reordering

**Current:** Mixed helper functions with no clear order

**Refactored:** Group by functionality and call order:

```javascript
// Color utilities (used by rating elements)
function calculateRatingColor(rating, isPercentage) {}
function formatImdbRating(rating) {}
function formatPercentRating(rating) {}
function formatVoteCount(count) {}

// Element creators (building blocks)
function createBadgeElement(label, value, labelClassName, valueClassName) {}
function createRatingElement(label, value, className) {}
function createMissingRatingElement(label, className) {}
function createSearchRatingElement(label, className) {}
function createIconButton(emoji, titleText, onClick) {}

// Composite element creators
function createFadeToggle(state, onClick) {}
function createOptionalRatingBadge(label, rating, className, showRating) {}

// Tooltip and text utilities
function buildTooltip(titleParts, imdbId, apiTitle, year) {}

// Setup functions
function setupHoverActions(ratingsWrapper, actionsContainer, delayMs) {}
function appendFadeToggle(container, showFadeToggle, fadeToggleState, onFadeToggleClick) {}

// Main exports
function createOverlayElement(title, options) {}
function createLoadingOverlayElement(overlayClass, loadingClass) {}
```

---

## Test File Restructuring

### Principle: 1:1 Mapping

Every production file must have a corresponding test file with the same relative path structure.

### Current Test Structure
```
tests/
  unit/
    api-clients.test.js
    api-manager.test.js
    app.test.js
    cache.test.js
    config-manager.test.js
    disabled-clients.test.js
    fade-manager.test.js
    id-override-manager.test.js
    logger.test.js
    overlay.test.js
    request-queue.test.js
    services.test.js
    surfaces.test.js
    title.test.js
    utils.test.js
    color-utils.test.js
```

### Target Test Structure
```
tests/
  unit/
    api/
      base-api-client.test.js
      xmdb-api-client.test.js
      omdb-api-client.test.js
      agregarr-api-client.test.js
      title-type-mappers.test.js
      factory.test.js
    
    cache/
      cache-entry.test.js
      cache-manager.test.js
    
    config/
      config-fields.test.js
      config-manager.test.js
    
    services/
      service-registry.test.js
      netflix-service.test.js
      hbo-max-service.test.js
      disney-plus-service.test.js
    
    surfaces/
      surface-manager.test.js
      surface-definitions/
        netflix-surfaces.test.js
        hbo-max-surfaces.test.js
        disney-plus-surfaces.test.js
    
    ui/
      overlay/
        overlay-renderer.test.js
        elements/
          overlay-elements.test.js
          loading-elements.test.js
        styles/
          overlay-styles.test.js
    
    utils/
      color-utils.test.js
      dom-utils.test.js
      string-utils.test.js
      general-utils.test.js
    
    // Standalone files
    app.test.js
    constants.test.js
    disabled-clients.test.js
    fade-manager.test.js
    id-override-manager.test.js
    logger.test.js
    rate-limits.test.js
    request-queue.test.js
    title.test.js
```

### Test Content Restructuring Rules

1. **Move tests** to match the production file they test
2. **Split tests** when production files are split
3. **Update imports** to use the new file paths
4. **Maintain coverage** - ensure all existing test cases are preserved
5. **Update mock paths** in test files to match new structure

---

## Implementation Strategy

### Phase 1: File Organization (Non-Breaking)
1. Create new directory structure
2. Split files into smaller modules
3. Update imports in all files to use new paths
4. Ensure all exports are properly re-exported from index files

### Phase 2: Method Reordering
1. Reorder methods within each class according to call hierarchy
2. Update any internal references (should be minimal)
3. Verify no functionality is changed

### Phase 3: Parameter Reordering
1. Update constructor parameter order in all classes
2. Update all call sites to match new parameter order
3. This is the **highest risk phase** - requires careful testing

### Phase 4: Test File Restructuring
1. Create new test file structure
2. Move and split test files
3. Update all imports in test files
4. Verify all tests still pass

---

## Risk Assessment

| Phase | Risk Level | Mitigation Strategy |
|-------|------------|---------------------|
| File Organization | Low | Use index.js re-exports for backward compatibility |
| Method Reordering | Low | Internal class methods, no external API changes |
| Parameter Reordering | **High** | Update all call sites carefully, comprehensive testing |
| Test Restructuring | Medium | Verify test coverage remains at 90%+ |

---

## Verification Criteria

### Functional Verification
- [ ] All existing tests pass (90%+ coverage maintained)
- [ ] Build process completes successfully
- [ ] Linting passes
- [ ] All imports resolve correctly

### Structural Verification
- [ ] No file exceeds 200 lines (except index.js files)
- [ ] All classes follow top-to-bottom call order
- [ ] All constructors use logical + alphabetical parameter ordering
- [ ] Test files map 1:1 to production files
- [ ] All exports are properly indexed

### Quality Verification
- [ ] Code remains readable and maintainable
- [ ] No functional behavior changes
- [ ] TypeScript migration would be straightforward

---

## Success Metrics

| Metric | Before | Target | Measurement |
|--------|--------|--------|-------------|
| Max file size | 427 lines | <200 lines | Line count |
| Method ordering | Scattered | Top-to-bottom | Manual review |
| Parameter consistency | Varies | Standardized | Code analysis |
| Test coverage | Current % | Same % | Vitest report |
| Build time | Current | ≤ Current + 10% | Timing measurement |
| Bundle size | Current | Same ±5% | Build output |

---

## Decisions Made

1. **Index File Strategy:** ✅ **USE INDEX.JS FILES** - Create comprehensive `index.js` files in each directory for cleaner imports (standard practice for both JavaScript and TypeScript)

2. **TypeScript Preparation:** ❌ **NOT NOW** - Keep current documentation level, no additional JSDoc for TS prep

3. **File Size Limits:** ❌ **NOT STRICT** - Use flexible <200 line targets, allow exceptions for tightly-coupled logic

4. **Migration Strategy:** ✅ **MEDIUM-SIZED COMMITS** - One commit per related set of changes

---

## Appendix A: Complete Method Call Hierarchy

### BaseApiClient
```
fetch() → isDisabled(), overrideManager.getImdbId(), search(), getDetails(), queuedFetch()
getStatus() → isDisabled()
disable() → queue.clear(), disabledManager.disable()
queuedFetch() → queue.enqueue(), adapter.httpFetch()
```

### ApiClientManager
```
getData() → cache.read(), api.getData(), cache.write()
#fetch() → client.getStatus(), client.fetch(), cache.write()
```

### FlixMonkeyApp
```
init() → #initNavigationObservers(), renderer.injectStyles(), decorateRoot()
#initNavigationObservers() → MutationObserver, history API
decorateRoot() → surfaces.discover(), #decorateContainer()
#decorateContainer() → #getFadeOverride(), #getTitleRequest(), #renderTitle()
#getTitleRequest() → api.getData()
#renderTitle() → renderer.injectOverlay(), renderer.applyFade(), #handleFadeToggleClick()
#handleFadeToggleClick() → fadeManager.nextState(), fadeManager.setOverride()
handleEditClick() → #extractImdbId(), overrideManager.setImdbId(), cache.delete(), #redecorateTitle()
#redecorateTitle() → renderer.removeLoadingOverlay(), #decorateContainer()
```

### OverlayRenderer
```
injectOverlay() → createOverlayElement(), createLoadingOverlayElement()
createOverlayElement() → all helper functions
```

---

## Appendix B: File Size Analysis

| File | Current Lines | Target Lines | Reduction |
|------|---------------|--------------|-----------|
| api-clients.js | 427 | ~80 (each) | -347 |
| app.js | 351 | ~250 | -101 |
| surfaces.js | 259 | ~80 (each) | -179 |
| overlay-elements.js | 296 | ~200 | -96 |
| **Total** | **1333** | **~810** | **-523** |

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-02 | Brainstorming | Initial specification |

**Approvers:**
- [ ] User review required
- [ ] Specification approved

**Next Steps:**
1. User reviews and approves this specification
2. Create implementation plan using writing-plans skill
3. Implement refactoring in phases
4. Verify all criteria met