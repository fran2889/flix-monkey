# Design Spec: Multi-Platform Streaming Service Architecture

**Date:** 2026-07-13
**Author:** Mistral Vibe (with user input)
**Status:** Draft
**Scope:** Refactor Netflix-specific code into a multi-platform architecture

---

## Summary

Restructure FlixMonkey to support multiple streaming platforms (SVOD services) by introducing a service abstraction layer. The goal is to separate Netflix-specific code from the core application so that new platforms can be added cleanly as separate, self-contained modules. This is a refactoring-only change: no new platforms are added, only the architecture to support them.

---

## Goals

1. Introduce a `StreamingService` abstraction with a clear interface
2. Move Netflix-specific code (surfaces, constants) into a Netflix service module
3. Implement service detection based on domain/URL
4. Make surface discovery platform-agnostic
5. Add configuration option to enable/disable services
6. Maintain backward compatibility: Netflix continues to work identically

---

## Non-Goals

1. Adding support for new platforms (Disney+, Prime Video, etc.)
2. Changing the API client architecture (already properly abstracted)
3. Modifying the platform adapter pattern (browser vs userscript)
4. Changing the rating provider selection logic (remains global)

---

## Architecture

### New Module: `src/core/services.js`

**Purpose:** Define streaming services, handle detection, and provide service metadata.

```js
/**
 * Base class for streaming service implementations.
 */
export class StreamingService {
    get id() {
        throw new Error('Not implemented');
    }
    get domains() {
        throw new Error('Not implemented');
    }
    get SurfaceManager() {
        throw new Error('Not implemented');
    }
    get constants() {
        return Object.freeze({});
    }
}

/**
 * Netflix service implementation.
 */
export class NetflixService extends StreamingService {
    get id() {
        return 'netflix';
    }
    get domains() {
        return Object.freeze(['www.netflix.com']);
    }
    get SurfaceManager() {
        return NetflixSurfaceManager;
    }
    get constants() {
        return Object.freeze({ TOP_10_BADGE: 'title-card-top-10' });
    }
}

/**
 * Registry of all supported services.
 */
export const SERVICES = Object.freeze({
    netflix: new NetflixService(),
});

/**
 * Service detection utility.
 */
export class ServiceRegistry {
    static detect() {
        const currentHost = window.location.hostname;
        for (const service of Object.values(SERVICES)) {
            if (service.domains.some(d => currentHost.includes(d))) {
                return service;
            }
        }
        return null;
    }
}
```

### Modified Module: `src/core/surfaces.js`

**Purpose:** Platform-agnostic surface discovery with platform-specific implementations.

```js
/**
 * Base surface manager - generic discovery logic.
 */
export class SurfaceManager {
    #SURFACES;
    #logger;

    constructor(surfaceDefs, logger) {
        this.#SURFACES = surfaceDefs;
        this.#logger = logger;
    }

    discover(root) {
        const seen = new Set();
        const results = [];
        this.#SURFACES.forEach(surface => {
            let titleEls;
            try {
                titleEls = root.querySelectorAll(surface.titleSelector);
            } catch {
                return;
            }
            titleEls.forEach(titleEl => {
                const title = titleEl.getAttribute(surface.titleAttribute)?.trim() ?? null;
                if (!title) return;
                let container = titleEl.closest(surface.containerSelector);
                if (!container) {
                    this.#logger.warn('Surface container selector failed, falling back to parentElement', {
                        selector: surface.containerSelector,
                    });
                    container = titleEl.parentElement;
                }
                if (!container || seen.has(container)) return;
                seen.add(container);
                results.push({
                    container,
                    title,
                    fadeable: surface.fadeable,
                    showFadeToggle: surface.showFadeToggle,
                });
            });
        });
        return results;
    }
}

/**
 * @typedef {Object} SurfaceDefinition
 * @property {string} titleSelector - CSS selector for title elements
 * @property {string} containerSelector - CSS selector for container elements
 * @property {string} titleAttribute - Attribute name containing the title
 * @property {boolean} fadeable - Whether this surface supports fading
 * @property {boolean} showFadeToggle - Whether to show fade toggle button
 */

/**
 * Netflix-specific surface definitions
 */
const NETFLIX_SURFACE_DEFS = Object.freeze([
    {
        // Browse and genre page row cards
        titleSelector: '.title-card a[aria-label]',
        containerSelector: '.title-card',
        titleAttribute: 'aria-label',
        fadeable: true,
        showFadeToggle: false,
    },
    {
        // Search result grid cards
        titleSelector: '[data-uia="standard-card"]',
        containerSelector: '[data-uia="standard-card"]',
        titleAttribute: 'aria-label',
        fadeable: true,
        showFadeToggle: false,
    },
    {
        // Hover mini-modal
        titleSelector: '.previewModal--wrapper.mini-modal .previewModal--player_container img[alt]',
        containerSelector: '.previewModal--player_container',
        titleAttribute: 'alt',
        fadeable: false,
        showFadeToggle: true,
    },
    {
        // Full detail modal
        titleSelector: '.previewModal--wrapper.detail-modal .previewModal--player_container img[alt]',
        containerSelector: '.previewModal--player_container',
        titleAttribute: 'alt',
        fadeable: false,
        showFadeToggle: false,
    },
]);

/**
 * Netflix surface manager implementation.
 */
export class NetflixSurfaceManager extends SurfaceManager {
    constructor(logger) {
        super(NETFLIX_SURFACE_DEFS, logger);
    }
}
```

### Modified Module: `src/core/app.js`

**Changes:**

- Import `ServiceRegistry`
- Detect current service at startup
- Return `null` if not on supported platform
- Pass service-specific constants to `OverlayRenderer`

```js
import { ServiceRegistry } from './services.js';

function startApp(adapter) {
    const currentService = ServiceRegistry.detect();
    if (!currentService) return null;

    const logger = new Logger(adapter);
    const configManager = new ConfigManager(adapter, logger);
    const surfaces = new currentService.SurfaceManager(logger);
    const renderer = new OverlayRenderer(configManager, currentService.constants);

    const cache = new CacheManager(adapter, configManager, logger);
    const disabledManager = new DisabledClientsManager(adapter);
    const client = createApiClient(configManager, disabledManager, adapter, logger);
    const api = new ApiClientManager(cache, disabledManager, client, logger);
    const fadeManager = new FadeManager(adapter);
    const app = new FlixMonkeyApp(cache, api, renderer, surfaces, fadeManager, configManager, logger);

    app.init();
    return {
        clearCache: () => app.clearCache(),
        resetDisabledClients: () => app.resetDisabledClients(),
        disconnect: () => app.disconnect(),
        redecorate: () => app.redecorate(),
        cacheManager: cache,
        disabledManager: disabledManager,
    };
}
```

### Modified Module: `src/core/overlay.js`

**Changes:**

- Accept service-specific constants in constructor
- Use service constants with fallback to defaults

```js
export class OverlayRenderer {
    #OVERLAY_CLASS = 'fm-rating-overlay';
    #OVERLAY_ATTR = 'data-fm-injected';
    #LOADING_CLASS = 'fm-loading';
    #config;
    #serviceConstants;

    constructor(config, serviceConstants = {}) {
        this.#config = config;
        this.#serviceConstants = serviceConstants;
    }

    injectStyles() {
        const TOP_10_BADGE = this.#serviceConstants.TOP_10_BADGE ?? 'title-card-top-10';
        const cornerStyles = {
            'top-left': 'top:6px;left:6px;',
            'top-right': 'top:6px;right:6px;',
            'bottom-left': 'bottom:6px;left:6px;',
            'bottom-right': 'bottom:6px;right:6px;',
        };
        const corner = this.#config.get('overlayCorner');
        const positionCss = cornerStyles[corner] ?? cornerStyles['top-left'];
        const flexDirection = corner.includes('bottom') ? 'column-reverse' : 'column';
        let cssText = `
            .${this.#OVERLAY_CLASS} {
                position: absolute;
                ${positionCss}
                z-index: 9999;
                display: flex;
                flex-direction: ${flexDirection};
                gap: 4px;
                pointer-events: none;
            }
            /* ... existing styles ... */
        `;
        if (corner.includes('left')) {
            cssText += `\n            .${TOP_10_BADGE} .${this.#OVERLAY_CLASS} { left: calc(50% + 6px); }`;
        }
        // ... rest of method unchanged
    }

    // ... rest of class unchanged
}
```

### Modified Module: `src/core/constants.js`

**Changes:**

- Remove Netflix-specific `TOP_10_BADGE` constant (moved to Netflix service)

```js
export const DAYS_TO_MS = 24 * 60 * 60 * 1000;
export const CACHE_TTL_INFINITE = -1;
export const DECORATION_DEBOUNCE_MS = 250;
export const INFLIGHT_TIMEOUT_MS = 30_000;
export const CLIENT_DISABLE_DURATION = 60 * 60 * 1000; // 1 hour
export const DEFAULT_FETCH_TIMEOUT = 8000;

export const ApiSource = Object.freeze({
    XMDB: 'xmdb',
    OMDB: 'omdb',
    AGREGARR: 'agregarr',
});

// Rating color thresholds
export const RATING_COLOR_LOW_THRESHOLD = 5.0;
export const RATING_COLOR_HIGH_THRESHOLD = 8.5;

// Rating colors
export const RATING_COLOR_RED = '#ff0000';
export const RATING_COLOR_GREEN = '#00dd00';

export const TitleType = Object.freeze({
    MOVIE: 'movie',
    SERIES: 'series',
});
```

### Modified Module: `src/core/config-fields.js`

**Changes:**

- Add `enabledServices` configuration option

```js
import { CACHE_TTL_INFINITE } from './constants.js';

function validateCacheTtl(val) {
    if (typeof val === 'string' && val.trim() === '') return 'Cache duration must be -1 or a positive integer';
    const n = Number(val);
    return Number.isInteger(n) && (n >= 0 || n === -1) ? null : 'Cache duration must be -1 or a positive integer';
}

export const CONFIG_FIELDS = [
    {
        key: 'enabledServices',
        label: 'Enabled Streaming Services',
        type: 'select',
        multi: true,
        options: [['netflix', 'Netflix']],
        default: ['netflix'],
        title: 'Select which streaming services to enable FlixMonkey on',
    },
    // ... existing config fields
];

export const CONFIG_DEFAULTS = Object.fromEntries(CONFIG_FIELDS.map(f => [f.key, f.default]));

export const CONFIG_SELECT_ALLOWED = Object.fromEntries(
    CONFIG_FIELDS.filter(f => f.type === 'select').map(f => [f.key, f.options.map(o => (Array.isArray(o) ? o[0] : o))])
);
```

---

## Data Flow

```
User navigates to netflix.com
    ↓
ServiceRegistry.detect() → returns NetflixService
    ↓
startApp() instantiates:
  - NetflixSurfaceManager (with Netflix surface definitions)
  - OverlayRenderer (with Netflix constants)
  - All other core components
    ↓
App works exactly as before
```

---

## File Changes Summary

| File                               | Change Type | Description                         |
| ---------------------------------- | ----------- | ----------------------------------- |
| `src/core/services.js`             | **NEW**     | Service classes + registry          |
| `src/core/surfaces.js`             | **MODIFY**  | Base class + Netflix implementation |
| `src/core/app.js`                  | **MODIFY**  | Service detection + integration     |
| `src/core/overlay.js`              | **MODIFY**  | Accept service constants            |
| `src/core/constants.js`            | **MODIFY**  | Remove TOP_10_BADGE                 |
| `src/core/config-fields.js`        | **MODIFY**  | Add enabledServices config          |
| `tests/unit/core/services.test.js` | **NEW**     | Service registry tests              |
| `tests/unit/core/surfaces.test.js` | **MODIFY**  | Update for new structure            |
| `tests/unit/core/overlay.test.js`  | **MODIFY**  | Pass service constants              |
| `tests/unit/core/app.test.js`      | **MODIFY**  | Mock service detection              |

---

## Testing

### Unit Tests

**New: `tests/unit/core/services.test.js`**

```js
import { ServiceRegistry, SERVICES, NetflixService } from '../../../src/core/services.js';

describe('ServiceRegistry', () => {
    describe('detect()', () => {
        it('returns Netflix service on netflix.com', () => {
            Object.defineProperty(window, 'location', { value: { hostname: 'www.netflix.com' } });
            const service = ServiceRegistry.detect();
            assert(service !== null);
            assert(service.id === 'netflix');
        });

        it('returns null on unknown domain', () => {
            Object.defineProperty(window, 'location', { value: { hostname: 'www.youtube.com' } });
            const service = ServiceRegistry.detect();
            assert(service === null);
        });
    });
});

describe('NetflixService', () => {
    it('has correct id', () => {
        const service = new NetflixService();
        assert(service.id === 'netflix');
    });

    it('has correct domains', () => {
        const service = new NetflixService();
        assert.deepEqual(service.domains, ['www.netflix.com']);
    });

    it('has NetflixSurfaceManager as SurfaceManager', () => {
        const service = new NetflixService();
        assert(service.SurfaceManager === NetflixSurfaceManager);
    });

    it('provides TOP_10_BADGE constant', () => {
        const service = new NetflixService();
        assert(service.constants.TOP_10_BADGE === 'title-card-top-10');
    });
});
```

**Modified: `tests/unit/core/surfaces.test.js`**

- Instantiate `SurfaceManager` with surface definitions
- Add tests for `NetflixSurfaceManager`

**Modified: `tests/unit/core/overlay.test.js`**

- Pass service constants to `OverlayRenderer`

**Modified: `tests/unit/core/app.test.js`**

- Mock `ServiceRegistry.detect()`
- Test behavior when no service is detected

### UI Tests

- No changes to test logic
- Tests explicitly instantiate `NetflixSurfaceManager`

### Integration Tests

- No changes needed (API clients unchanged)

---

## Backward Compatibility

- Existing Netflix functionality unchanged
- All existing tests continue to pass
- Config migration: `enabledServices` defaults to `['netflix']`
- Cache entries remain valid (source still identifies provider, not platform)

---

## Future Platform Addition

To add Disney+ in the future:

1. **`surfaces.js`:** Add `DisneySurfaceManager` class with Disney+ surface definitions
2. **`services.js`:** Add `DisneyService` class to `SERVICES` registry
3. **Manifests:** Add Disney+ domains to `host_permissions` and `content_scripts.matches`
4. **Config:** Add `['disney', 'Disney+']` to `enabledServices` options

---

## Success Criteria

- [ ] `StreamingService` base class defined with clear interface
- [ ] `NetflixService` implements the interface with Netflix-specific data
- [ ] `ServiceRegistry.detect()` correctly identifies Netflix by domain
- [ ] `SurfaceManager` is platform-agnostic base class
- [ ] `NetflixSurfaceManager` extends base with Netflix surface definitions
- [ ] `startApp()` detects service and uses appropriate surface manager
- [ ] `OverlayRenderer` accepts and uses service-specific constants
- [ ] `TOP_10_BADGE` removed from global constants, moved to Netflix service
- [ ] `enabledServices` config field added
- [ ] All existing tests pass
- [ ] New tests added for service abstraction
- [ ] Netflix functionality identical to before

---

## Open Questions

None at this time. All architectural decisions have been approved.

---

## Notes

- The `enabledServices` config allows users to disable FlixMonkey on specific platforms even when detected
- Service detection is domain-based and runs automatically on page load
- The architecture mirrors the existing `api-clients.js` pattern where `BaseApiClient` defines an interface and concrete classes implement it
- Platform-specific code is isolated: Netflix code lives in `NetflixService` and `NetflixSurfaceManager`
