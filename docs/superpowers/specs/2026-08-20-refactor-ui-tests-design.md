# Refactor UI Tests: JSON-based Surface Fixtures

## 1. Objectives

- Replace HTML fixture files with JS module fixtures containing single-title HTML snippets.
- Improve test maintainability by isolating each surface into its own fixture entry.
- Enable automatic detection of unsupported surfaces via failing tests.
- Remove dependency on Python extraction script.

## 2. Current State

### 2.1 Current Structure

```
tests/
  fixtures/
    netflix-browse.html      # Multi-title page HTML
    preview-mini.html
    progress-card.html
    ranked-card.html
    standard-card.html
    title-card.html
    disneyplus-browse.html
    hbomax-browse.html
    hbomax-search.html
  ui/
    netflix-browse.ui.test.js
    netflix-preview-detail.ui.test.js
    netflix-preview-mini.ui.test.js
    netflix-search.ui.test.js
    disneyplus-browse.ui.test.js
    hbomax-browse.ui.test.js
    hbomax-search.ui.test.js
```

### 2.2 Problems

- HTML fixtures contain multiple titles, making it hard to isolate individual surface tests.
- Adding a new unsupported surface snippet does not automatically create a failing test.
- HTML fixtures are hard to read and maintain due to escaping requirements.
- Python extraction script (`capture-surface-fixtures.py`) adds unnecessary complexity.

## 3. Proposed Design

### 3.1 File Structure

```
tests/
  fixtures/
    netflix-surfaces.js      # JS module with template literal snippets
    disneyplus-surfaces.js
    hbomax-surfaces.js
  helpers/
    surface-tests.js         # Shared test helper function
  ui/
    netflix.ui.test.js      # One test file per platform
    disneyplus.ui.test.js
    hbomax.ui.test.js
```

### 3.2 Fixture Format

Each fixture file is a JS module exporting an array of fixture entries:

```javascript
// tests/fixtures/netflix-surfaces.js
/** @type {Array<{name: string, html: string, expected: {title: string, fadeable: boolean, showFadeToggle: boolean}}>} */
export default [
    {
        name: 'Netflix title card - Sweet Magnolias',
        html: `<div class="slider-item slider-item-0">
      <div class="title-card-container">
        <div id="title-card-1-0" class="title-card">
          <a href="/watch/80239866" aria-label="Sweet Magnolias">
            <div class="boxart-container">
              <img class="boxart-image" src="..." alt="">
            </div>
          </a>
        </div>
      </div>
    </div>`,
        expected: {
            title: 'Sweet Magnolias',
            fadeable: true,
            showFadeToggle: false,
        },
    },
    {
        name: 'Netflix progress card - Office Romance',
        html: `<div data-uia="progress-card" aria-label="Office Romance">...</div>`,
        expected: {
            title: 'Office Romance',
            fadeable: true,
            showFadeToggle: false,
        },
    },
];
```

**Fixture Entry Schema:**

| Field                     | Type    | Description                                                          |
| ------------------------- | ------- | -------------------------------------------------------------------- |
| `name`                    | string  | Descriptive name for the surface snippet                             |
| `html`                    | string  | Template literal containing valid HTML snippet for exactly one title |
| `expected.title`          | string  | Expected extracted title                                             |
| `expected.fadeable`       | boolean | Expected `fadeable` flag from surface definition                     |
| `expected.showFadeToggle` | boolean | Expected `showFadeToggle` flag from surface definition               |

### 3.3 Helper Function

```javascript
// tests/helpers/surface-tests.js
/**
 * Tests surface discovery and overlay injection for a set of fixtures.
 * Each fixture must represent exactly one surface.
 *
 * @param {import('../../src/core/surfaces.js').SurfaceManager} surfaceManager
 * @param {import('../../src/core/overlay.js').OverlayRenderer} overlayRenderer
 * @param {Array<{name: string, html: string, expected: {title: string, fadeable: boolean, showFadeToggle: boolean}}>} fixtures
 */
export function testSurfaceFixtures(surfaceManager, overlayRenderer, fixtures) {
    fixtures.forEach(entry => {
        // Wrap snippet in minimal HTML document
        document.body.innerHTML = `<html><body>${entry.html}</body></html>`;

        // Discover surfaces
        const surfaces = surfaceManager.discover(document.body);
        expect(surfaces, `Expected exactly one surface for ${entry.name}`).toHaveLength(1);

        // Verify surface properties
        const surface = surfaces[0];
        expect(surface.title).toBe(entry.expected.title);
        expect(surface.fadeable).toBe(entry.expected.fadeable);
        expect(surface.showFadeToggle).toBe(entry.expected.showFadeToggle);

        // Verify overlay injection
        overlayRenderer.injectOverlay(surface.container, {
            imdbRating: 8.5,
            imdbUrl: 'https://www.imdb.com/title/tt1234567/',
            imdbId: 'tt1234567',
        });
        expect(surface.container.querySelector('.fm-rating-overlay')).not.toBeNull();
    });
}
```

### 3.4 Test Files

Each platform has one test file:

```javascript
// tests/ui/netflix.ui.test.js
/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, it, beforeEach } from 'vitest';
import { ConfigManager } from '../../src/core/config-manager.js';
import { OverlayRenderer } from '../../src/core/overlay.js';
import { NetflixSurfaceManager } from '../../src/core/surfaces.js';
import { createMockAdapter } from '../mocks/adapter.js';
import { createMockLogger } from '../mocks/logger.js';
import fixtures from '../fixtures/netflix-surfaces.js';
import { testSurfaceFixtures } from '../helpers/surface-tests.js';

describe('Netflix surfaces', () => {
    let surfaceManager, overlayRenderer;

    beforeEach(() => {
        surfaceManager = new NetflixSurfaceManager(createMockLogger());
        overlayRenderer = new OverlayRenderer(new ConfigManager(createMockAdapter()), new NetflixService().constants);
        overlayRenderer.injectStyles();
    });

    it('should discover and inject on all Netflix surfaces', () => {
        testSurfaceFixtures(surfaceManager, overlayRenderer, fixtures);
    });
});
```

### 3.5 Fixture Extraction

Fixtures are manually extracted from current HTML fixture files with a **1:1 mapping to surface definitions**.

For each surface type in the platform's `*_SURFACES` array, extract **one representative snippet**:

- Netflix: 6 entries (TITLE_CARD, SEARCH_CARD, PROGRESS_CARD, RANKED_CARD, PREVIEW_MINI, PREVIEW_DETAIL)
- Disney+: 2 entries (SHELF_CARD, CONTINUE_WATCHING)
- HBO Max: 1 entry (TILE)

Extraction process:

1. Open the relevant HTML fixture file
2. Find one example of the surface type in the HTML
3. Copy the minimal HTML for that single surface (including all necessary parent elements for selectors to work)
4. Create a fixture entry with:
    - `name`: Descriptive name including platform and surface type
    - `html`: The extracted snippet as a template literal
    - `expected.title`: The title text from the snippet
    - `expected.fadeable`: Matching value from the surface definition
    - `expected.showFadeToggle`: Matching value from the surface definition

## 4. Assertions Coverage

The helper function verifies:

| Assertion                                            | Purpose                                        | Layer |
| ---------------------------------------------------- | ---------------------------------------------- | ----- |
| `surfaces.length === 1`                              | Exactly one surface discovered per snippet     | UI    |
| `surface.title === expected.title`                   | Title extraction works on real HTML            | UI    |
| `surface.fadeable === expected.fadeable`             | Surface fadeable flag matches definition       | UI    |
| `surface.showFadeToggle === expected.showFadeToggle` | Surface showFadeToggle flag matches definition | UI    |
| `.fm-rating-overlay` exists                          | Overlay badge injected successfully            | UI    |

**Not duplicated (handled by unit tests):**

- Overlay rendering logic (CSS, tooltip text, conditional elements)
- SurfaceManager edge cases (null titles, deduplication, fallback logic)
- Fade class manipulation
- Loading overlay specifics

## 5. Benefits

### 5.1 Automatic Unsupport Detection

If a new surface snippet is added to a fixture file but no corresponding surface definition exists in `src/core/surfaces.js`, the test will fail at:

```javascript
expect(surfaces).toHaveLength(1); // Fails: received []
```

This provides immediate feedback that the surface is not yet supported.

### 5.2 Improved Maintainability

- Single-title snippets are easier to read and understand
- Template literals allow natural HTML formatting without escaping
- Each fixture entry is self-documenting with `name` field
- Adding a new surface only requires adding a fixture entry

### 5.3 Cleaner Test Output

- Each fixture entry has a descriptive name
- Test failures clearly indicate which surface snippet failed
- No need to parse large HTML files to understand test failures

## 6. Migration Plan

### 6.1 Phase 1: Create Infrastructure

- Create `tests/helpers/` directory
- Create `tests/helpers/surface-tests.js` with helper function
- Create `tests/fixtures/netflix-surfaces.js` with extracted snippets
- Create `tests/fixtures/disneyplus-surfaces.js`
- Create `tests/fixtures/hbomax-surfaces.js`

### 6.2 Phase 2: Create New Test Files

- Create `tests/ui/netflix.ui.test.js`
- Create `tests/ui/disneyplus.ui.test.js`
- Create `tests/ui/hbomax.ui.test.js`

### 6.3 Phase 3: Verify and Clean Up

- Run all new tests, ensure they pass
- Delete `scripts/capture-surface-fixtures.py`
- Delete old HTML fixtures from `tests/fixtures/`
- Delete old UI test files

### 6.4 Phase 4: Commit

- Commit with message: `refactor(ui-tests): migrate from HTML fixtures to JS-based single-title snippets`

## 7. File Changes Summary

| Action | Path                                                                      |
| ------ | ------------------------------------------------------------------------- |
| Create | `tests/helpers/surface-tests.js`                                          |
| Create | `tests/fixtures/netflix-surfaces.js`                                      |
| Create | `tests/fixtures/disneyplus-surfaces.js`                                   |
| Create | `tests/fixtures/hbomax-surfaces.js`                                       |
| Create | `tests/ui/netflix.ui.test.js`                                             |
| Create | `tests/ui/disneyplus.ui.test.js`                                          |
| Create | `tests/ui/hbomax.ui.test.js`                                              |
| Delete | `scripts/capture-surface-fixtures.py`                                     |
| Delete | `tests/fixtures/*.html` (all HTML fixtures)                               |
| Delete | `tests/ui/netflix-*.ui.test.js` (all existing platform-specific UI tests) |
| Delete | `tests/ui/disneyplus-browse.ui.test.js`                                   |
| Delete | `tests/ui/hbomax-*.ui.test.js`                                            |

## 8. Test Execution

All tests continue to run via:

```bash
npm test          # Runs all tests including new UI tests
npm run test:ui   # Runs only UI tests
```

The new structure does not change the test execution flow.
