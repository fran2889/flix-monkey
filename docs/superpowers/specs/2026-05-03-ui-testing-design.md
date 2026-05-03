# UI Testing Design - FlixMonkey

## 1. Objectives
- Validate the end-to-end integration of DOM discovery (`SurfaceManager`) and overlay rendering (`OverlayRenderer`).
- Ensure high-fidelity testing using real Netflix HTML snapshots as fixtures.
- Verify correct handling of various Netflix UI surfaces: Browse, Search, Zoomed (Hover), and Info (Modal).

## 2. Testing Strategy
- **Runner:** Vitest with JSDOM environment.
- **Fixture Loading:** HTML snapshots captured from live Netflix sessions using Chrome DevTools MCP.
- **Verification Layers:**
    - **Discovery:** Verify `SurfaceManager` accurately identifies title containers and extracts correct titles.
    - **Injection:** Verify `OverlayRenderer` correctly injects, updates, and removes badges.
    - **Behavior:** Verify loading states, rating displays, and "faded" logic (threshold-based opacity).

## 3. UI Surfaces & Fixtures

### 3.1 Browse Surface
- **Fixture:** `tests/fixtures/netflix-browse.html` (Home/Browse grid).
- **Test File:** `tests/ui/browse.ui.test.js`.
- **Focus:** Main thumbnail grid, `title-card` discovery, and basic injection.

### 3.2 Search Surface
- **Fixture:** `tests/fixtures/netflix-search.html` (Search results page).
- **Test File:** `tests/ui/search.ui.test.js`.
- **Focus:** Gallery video cards (`data-uia="search-gallery-video-card"`) and suggestion links.

### 3.3 Zoomed Surface (Hover)
- **Fixture:** `tests/fixtures/netflix-hover.html` (Active hover/zoom card).
- **Test File:** `tests/ui/zoomed.ui.test.js`.
- **Focus:** `bob-container` discovery and injection. `fadeable: false` enforcement.

### 3.4 Info Surface (Modal/Jawbone)
- **Fixture:** `tests/fixtures/netflix-modal.html` (Preview Modal or Jawbone details).
- **Test File:** `tests/ui/info.ui.test.js`.
- **Focus:** Complex modal selectors (images with `alt` text, headings). `fadeable: false` enforcement.

## 4. Test Case Template (Conceptual)
```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { SurfaceManager } from '@core/surfaces.js';
import { OverlayRenderer } from '@core/overlay.js';
import fs from 'fs';
import path from 'path';

describe('UI Surface: [Name]', () => {
    let surfaceManager, overlayRenderer, fixtureHtml;

    beforeAll(() => {
        fixtureHtml = fs.readFileSync(path.resolve(__dirname, '../../fixtures/netflix-[name].html'), 'utf8');
    });

    beforeEach(() => {
        document.body.innerHTML = fixtureHtml;
        surfaceManager = new SurfaceManager();
        overlayRenderer = new OverlayRenderer();
    });

    it('should discover all title containers', () => {
        const surfaces = surfaceManager.discover(document.body);
        expect(surfaces.length).toBeGreaterThan(0);
        // Assert specific expected title
    });

    it('should inject loading and then final ratings', () => {
        const surfaces = surfaceManager.discover(document.body);
        const { container, title } = surfaces[0];
        
        overlayRenderer.injectLoadingOverlay(container, title);
        expect(container.querySelector('.fm-loading')).not.toBeNull();
        
        overlayRenderer.injectOverlay(container, { rating: 8.5, imdbUrl: '...' });
        expect(container.querySelector('.fm-rating-overlay')).not.toBeNull();
        expect(container.querySelector('.fm-loading')).toBeNull();
    });
});
```

## 5. Implementation Phases
1. **Fixture Harvesting:** Use Chrome MCP to navigate Netflix and capture the 4 required HTML snapshots.
2. **Browse & Search Tests:** Implement tests for the primary navigation surfaces.
3. **Zoomed & Info Tests:** Implement tests for the interaction-heavy surfaces.
