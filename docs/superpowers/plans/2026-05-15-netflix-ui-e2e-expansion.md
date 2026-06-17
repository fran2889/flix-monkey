# Netflix UI E2E Test Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Provide comprehensive E2E coverage for FlixMonkey rating overlays across Browse, Search, Hover, and Preview Modal surfaces.

**Architecture:** Implements the Surface-Object Pattern. Each Netflix surface is encapsulated in a class that manages triggering the UI and accessing the `OverlayComponent`.

**Tech Stack:** Node.js, Playwright (CDP mode).

---

### Task 1: Create `OverlayComponent`

**Files:**

- Create: `tests/e2e/surfaces/overlay-component.cjs`

- [x] **Step 1: Implement `OverlayComponent` class**

```javascript
/**
 * OverlayComponent
 * Wraps the FlixMonkey rating overlay injected into Netflix surfaces.
 */
class OverlayComponent {
    constructor(page, container) {
        this.page = page;
        this.container = container;
        this.selector = '.fm-rating-overlay';
    }

    locator() {
        return this.container.locator(this.selector);
    }

    async waitForLoaded() {
        // Wait for overlay to exist and NOT have the loading class
        const loc = this.locator();
        await loc.waitFor({ state: 'visible', timeout: 5000 });
        await this.page.waitForFunction(
            (sel, parent) => {
                const el = parent.querySelector(sel);
                return el && !el.classList.contains('fm-loading');
            },
            this.selector,
            await this.container.elementHandle()
        );
    }

    async getImdbValue() {
        const text = await this.locator().textContent();
        // Regex to find decimal or integer (e.g. "8.5" or "8")
        const match = text.match(/IMDb\s+([\d.]+)/i);
        return match ? parseFloat(match[1]) : null;
    }

    async isFaded() {
        return this.container.evaluate(el => el.classList.contains('fm-faded'));
    }
}

module.exports = OverlayComponent;
```

- [x] **Step 2: Commit**

```bash
git add tests/e2e/surfaces/overlay-component.cjs
git commit -m "test(e2e): add OverlayComponent for unified rating verification"
```

---

### Task 2: Expand `BrowseSurface` and Implement `SearchSurface`

**Files:**

- Modify: `tests/e2e/surfaces/browse-surface.cjs`
- Create: `tests/e2e/surfaces/search-surface.cjs`

- [x] **Step 1: Update `BrowseSurface` to support `OverlayComponent`**

```javascript
const OverlayComponent = require('./overlay-component.cjs');

class BrowseSurface {
    constructor(adapter) {
        this.adapter = adapter;
        this.page = adapter.page;
    }

    async getTitleCards() {
        return this.page.locator('.title-card');
    }

    getOverlay(cardLocator) {
        return new OverlayComponent(this.page, cardLocator);
    }

    async clickPlay() {
        await this.adapter.click('.play-button');
    }
}
module.exports = BrowseSurface;
```

- [x] **Step 2: Implement `SearchSurface`**

```javascript
const OverlayComponent = require('./overlay-component.cjs');

class SearchSurface {
    constructor(adapter) {
        this.adapter = adapter;
        this.page = adapter.page;
    }

    async searchFor(query) {
        const url = `https://www.netflix.com/search?q=${encodeURIComponent(query)}`;
        await this.adapter.navigate(url);
        await this.page.waitForSelector('[data-uia="search-gallery-video-card"]', { timeout: 10000 });
    }

    async getResults() {
        return this.page.locator('[data-uia="search-gallery-video-card"]');
    }

    getOverlay(cardLocator) {
        return new OverlayComponent(this.page, cardLocator);
    }
}
module.exports = SearchSurface;
```

- [x] **Step 3: Commit**

```bash
git add tests/e2e/surfaces/browse-surface.cjs tests/e2e/surfaces/search-surface.cjs
git commit -m "test(e2e): expand BrowseSurface and add SearchSurface"
```

---

### Task 3: Implement `BobSurface` and `PreviewModalSurface`

**Files:**

- Create: `tests/e2e/surfaces/bob-surface.cjs`
- Create: `tests/e2e/surfaces/preview-modal-surface.cjs`

- [x] **Step 1: Implement `BobSurface` (Hover)**

```javascript
const OverlayComponent = require('./overlay-component.cjs');

class BobSurface {
    constructor(adapter) {
        this.adapter = adapter;
        this.page = adapter.page;
    }

    async triggerHover(cardLocator) {
        await cardLocator.hover();
        // Wait for bob container to appear
        const bob = this.page.locator('.bob-container');
        await bob.waitFor({ state: 'visible', timeout: 5000 });
        // Give it a moment to stabilize (Netflix animations)
        await this.page.waitForTimeout(500);
        return bob;
    }

    getOverlay() {
        return new OverlayComponent(this.page, this.page.locator('.bob-container'));
    }
}
module.exports = BobSurface;
```

- [x] **Step 2: Implement `PreviewModalSurface` (Modal)**

```javascript
const OverlayComponent = require('./overlay-component.cjs');

class PreviewModalSurface {
    constructor(adapter) {
        this.adapter = adapter;
        this.page = adapter.page;
    }

    async open(cardLocator) {
        // Find the 'More Info' button or just click the card if it triggers modal
        const moreInfo = cardLocator.locator('[data-uia="play-button"] + button, .play-button + button');
        if (await moreInfo.isVisible()) {
            await moreInfo.click();
        } else {
            await cardLocator.click();
        }

        const modal = this.page.locator('.previewModal');
        await modal.waitFor({ state: 'visible', timeout: 10000 });
        // Wait for title treatment to be visible (indicates modal loaded)
        await modal.locator('.previewModal--player-titleTreatmentWrapper').waitFor({ state: 'attached' });
    }

    getOverlay() {
        return new OverlayComponent(this.page, this.page.locator('.previewModal'));
    }
}
module.exports = PreviewModalSurface;
```

- [x] **Step 3: Commit**

```bash
git add tests/e2e/surfaces/bob-surface.cjs tests/e2e/surfaces/preview-modal-surface.cjs
git commit -m "test(e2e): add BobSurface and PreviewModalSurface"
```

---

### Task 4: Comprehensive E2E Overlay Suite

**Files:**

- Create: `tests/e2e/overlay.ui.test.cjs`

- [x] **Step 1: Implement the main E2E test suite**

```javascript
const { test, expect } = require('@playwright/test');
const UserscriptAdapter = require('./adapters/userscript-adapter.cjs');
const BrowseSurface = require('./surfaces/browse-surface.cjs');
const SearchSurface = require('./surfaces/search-surface.cjs');
const BobSurface = require('./surfaces/bob-surface.cjs');
const PreviewModalSurface = require('./surfaces/preview-modal-surface.cjs');

test.describe('Netflix UI Overlays', () => {
    let adapter;

    test.beforeEach(async ({ page }) => {
        adapter = new UserscriptAdapter(page);
        // Pre-seed some ratings to avoid real API calls and ensure deterministic behavior
        // Using localStorage for UserscriptAdapter (as seen in its implementation)
        await adapter.setExtensionSettings({
            cache: {
                tt0111161: { rating: 9.3, title: 'The Shawshank Redemption', year: '1994', fetchedAt: Date.now() },
                tt0068646: { rating: 9.2, title: 'The Godfather', year: '1972', fetchedAt: Date.now() },
            },
            showRtRating: false,
            showMcRating: false,
        });
    });

    test('should show overlay on browse cards', async () => {
        const browse = new BrowseSurface(adapter);
        await adapter.navigate('https://www.netflix.com/browse');

        const cards = await browse.getTitleCards();
        const firstCard = cards.first();
        const overlay = browse.getOverlay(firstCard);

        await overlay.waitForLoaded();
        expect(await overlay.isVisible()).toBe(true);
    });

    test('should show overlay in search results', async () => {
        const search = new SearchSurface(adapter);
        await search.searchFor('Godfather');

        const results = await search.getResults();
        const firstResult = results.first();
        const overlay = search.getOverlay(firstResult);

        await overlay.waitForLoaded();
        expect(await overlay.isVisible()).toBe(true);
    });

    test('should show overlay on hover (Bob)', async () => {
        const browse = new BrowseSurface(adapter);
        const bob = new BobSurface(adapter);
        await adapter.navigate('https://www.netflix.com/browse');

        const cards = await browse.getTitleCards();
        const firstCard = cards.first();

        await bob.triggerHover(firstCard);
        const overlay = bob.getOverlay();

        await overlay.waitForLoaded();
        expect(await overlay.isVisible()).toBe(true);
    });

    test('should show overlay in preview modal', async () => {
        const browse = new BrowseSurface(adapter);
        const modal = new PreviewModalSurface(adapter);
        await adapter.navigate('https://www.netflix.com/browse');

        const cards = await browse.getTitleCards();
        const firstCard = cards.first();

        await modal.open(firstCard);
        const overlay = modal.getOverlay();

        await overlay.waitForLoaded();
        expect(await overlay.isVisible()).toBe(true);
    });
});
```

- [x] **Step 2: Run the new suite (Manual verification required as it needs local Chrome)**

Run: `npx playwright test tests/e2e/overlay.ui.test.cjs`
Expected: PASS (Assuming Chrome is running with `--remote-debugging-port=9222`)

- [x] **Step 3: Commit**

```bash
git add tests/e2e/overlay.ui.test.cjs
git commit -m "test(e2e): add comprehensive Netflix UI overlay test suite"
```
