# Fade Toggle Mini Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-title fade override toggle (always / never / auto) to the mini-modal hover overlay, gated by a new `enableFadeToggle` config checkbox.

**Architecture:** A new `FadeManager` class owns override storage (adapter keys `fm-fade:<dedupKey>`) and the fade decision; `FlixMonkeyApp` reads the override, stamps fadeable card containers with `data-fm-key`, and wires the click handler that cycles state and updates sibling cards in real time; `OverlayRenderer` renders the toggle badge and a simplified `applyFade(container, bool)`.

**Tech Stack:** Vanilla JS ES modules, Vitest, JSDOM.

## Global Constraints

- All new JS files must carry the GPL-3.0 copyright header matching the format in every existing file.
- No new npm dependencies.
- All tests pass: `npm test` (runs `tests/unit` and `tests/ui`).
- Commit after every task using conventional commit format: `feat(scope): description` or `refactor(scope): description`.
- Private class fields use `#` syntax (see existing codebase pattern).
- `enableFadeToggle` default is `true`.
- State cycle: `null (auto) → 'always' → 'never' → null`.
- Storage key format: `fm-fade:<dedupKey>` — stored as `'always'` | `'never'`; absent key = auto.
- DOM state attribute on toggle badge: `'auto'` | `'always'` | `'never'` (string; `null` maps to `'auto'`).
- Emojis: `⭐` for auto, `👁️` for both always and never (always gets `fm-fade-toggle--faded` CSS class).
- CSS class prefix: `fm-fade-toggle` (not bare `fm-toggle`).

---

## File Map

| File                                   | Action                                                                             |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/core/fade-manager.js`             | **Create**                                                                         |
| `tests/unit/core/fade-manager.test.js` | **Create**                                                                         |
| `src/core/config-fields.js`            | **Modify** — add `enableFadeToggle` field                                          |
| `src/core/surfaces.js`                 | **Modify** — add `showFadeToggle` to surface defs + discover return                |
| `tests/unit/core/surfaces.test.js`     | **Modify** — add `showFadeToggle` assertions                                       |
| `tests/ui/preview-mini.ui.test.js`     | **Modify** — add `showFadeToggle: true` assertion + toggle integration             |
| `tests/ui/preview-detail.ui.test.js`   | **Modify** — add `showFadeToggle: false` assertion, update `applyFade` call        |
| `src/core/overlay.js`                  | **Modify** — simplify `applyFade`, add `#createFadeToggle`, extend `injectOverlay` |
| `tests/unit/core/overlay.test.js`      | **Modify** — replace `applyFade` tests, add toggle tests                           |
| `tests/ui/browse.ui.test.js`           | **Modify** — update `applyFade` call sites                                         |
| `src/core/app.js`                      | **Modify** — add `FadeManager` + `config` deps, wire toggle                        |
| `tests/unit/core/app.test.js`          | **Modify** — fix direct constructor call, add fade/toggle tests                    |

---

## Task 1: FadeManager

**Files:**

- Create: `src/core/fade-manager.js`
- Create: `tests/unit/core/fade-manager.test.js`

**Interfaces:**

- Produces:
    - `new FadeManager(adapter)` — adapter is a `PlatformAdapter` with `storageGet`, `storageSet`, `storageDelete`
    - `async getOverride(dedupKey: string): Promise<'always' | 'never' | null>`
    - `async setOverride(dedupKey: string, state: 'always' | 'never' | null): Promise<void>`
    - `shouldFade(override: 'always' | 'never' | null, rating: unknown, config: ConfigManager): boolean`
    - `nextState(current: 'always' | 'never' | null): 'always' | 'never' | null`

- [x] **Step 1: Write the failing tests**

Create `tests/unit/core/fade-manager.test.js`:

```js
/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
 */
import { describe, it, expect, vi } from 'vitest';
import { FadeManager } from '../../../src/core/fade-manager.js';
import { createMockAdapter } from '../../mocks/adapter.js';
import { ConfigManager } from '../../../src/core/config-manager.js';

function makeConfig(enableFadeUnderRating = false, fadeRatingThreshold = 6.0) {
    return new ConfigManager(
        createMockAdapter({
            configGet: key => {
                if (key === 'enableFadeUnderRating') return enableFadeUnderRating;
                if (key === 'fadeRatingThreshold') return fadeRatingThreshold;
                return undefined;
            },
        })
    );
}

describe('FadeManager', () => {
    describe('getOverride', () => {
        it('returns null when key is absent', async () => {
            const adapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue(null) });
            const fm = new FadeManager(adapter);
            expect(await fm.getOverride('tt1234567')).toBeNull();
            expect(adapter.storageGet).toHaveBeenCalledWith('fm-fade:tt1234567');
        });

        it('returns "always" when stored value is "always"', async () => {
            const adapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue('always') });
            expect(await new FadeManager(adapter).getOverride('k')).toBe('always');
        });

        it('returns "never" when stored value is "never"', async () => {
            const adapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue('never') });
            expect(await new FadeManager(adapter).getOverride('k')).toBe('never');
        });

        it('returns null for an unknown stored value', async () => {
            const adapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue('bad-value') });
            expect(await new FadeManager(adapter).getOverride('k')).toBeNull();
        });
    });

    describe('setOverride', () => {
        it('writes "always" to storage', async () => {
            const adapter = createMockAdapter();
            await new FadeManager(adapter).setOverride('tt1', 'always');
            expect(adapter.storageSet).toHaveBeenCalledWith('fm-fade:tt1', 'always');
        });

        it('writes "never" to storage', async () => {
            const adapter = createMockAdapter();
            await new FadeManager(adapter).setOverride('tt1', 'never');
            expect(adapter.storageSet).toHaveBeenCalledWith('fm-fade:tt1', 'never');
        });

        it('deletes key when state is null', async () => {
            const adapter = createMockAdapter();
            await new FadeManager(adapter).setOverride('tt1', null);
            expect(adapter.storageDelete).toHaveBeenCalledWith('fm-fade:tt1');
            expect(adapter.storageSet).not.toHaveBeenCalled();
        });
    });

    describe('shouldFade', () => {
        it('returns true for "always" override regardless of rating', () => {
            expect(new FadeManager(createMockAdapter()).shouldFade('always', 9.9, makeConfig(false))).toBe(true);
        });

        it('returns false for "never" override regardless of rating', () => {
            expect(new FadeManager(createMockAdapter()).shouldFade('never', 1.0, makeConfig(true, 6.0))).toBe(false);
        });

        it('returns false for null override when enableFadeUnderRating is false', () => {
            expect(new FadeManager(createMockAdapter()).shouldFade(null, 4.0, makeConfig(false, 6.0))).toBe(false);
        });

        it('returns true for null override when rating is below threshold', () => {
            expect(new FadeManager(createMockAdapter()).shouldFade(null, 5.9, makeConfig(true, 6.0))).toBe(true);
        });

        it('returns false for null override when rating equals threshold', () => {
            expect(new FadeManager(createMockAdapter()).shouldFade(null, 6.0, makeConfig(true, 6.0))).toBe(false);
        });

        it('returns false for null override when rating is above threshold', () => {
            expect(new FadeManager(createMockAdapter()).shouldFade(null, 7.5, makeConfig(true, 6.0))).toBe(false);
        });

        it('returns false for null override when rating is not a number', () => {
            expect(new FadeManager(createMockAdapter()).shouldFade(null, null, makeConfig(true, 6.0))).toBe(false);
            expect(new FadeManager(createMockAdapter()).shouldFade(null, undefined, makeConfig(true, 6.0))).toBe(false);
        });
    });

    describe('nextState', () => {
        it('cycles null → "always"', () => {
            expect(new FadeManager(createMockAdapter()).nextState(null)).toBe('always');
        });

        it('cycles "always" → "never"', () => {
            expect(new FadeManager(createMockAdapter()).nextState('always')).toBe('never');
        });

        it('cycles "never" → null', () => {
            expect(new FadeManager(createMockAdapter()).nextState('never')).toBeNull();
        });
    });
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
npm run test:unit -- fade-manager
```

Expected: fails with "Cannot find module '../../../src/core/fade-manager.js'"

- [x] **Step 3: Implement FadeManager**

Create `src/core/fade-manager.js`:

```js
/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
 */
export class FadeManager {
    #adapter;
    #prefix = 'fm-fade:';

    constructor(adapter) {
        this.#adapter = adapter;
    }

    async getOverride(dedupKey) {
        const val = await this.#adapter.storageGet(`${this.#prefix}${dedupKey}`);
        if (val === 'always' || val === 'never') return val;
        return null;
    }

    async setOverride(dedupKey, state) {
        const key = `${this.#prefix}${dedupKey}`;
        if (state === null) {
            await this.#adapter.storageDelete(key);
        } else {
            await this.#adapter.storageSet(key, state);
        }
    }

    shouldFade(override, rating, config) {
        if (override === 'always') return true;
        if (override === 'never') return false;
        if (!config.getBool('enableFadeUnderRating')) return false;
        return typeof rating === 'number' && rating < config.getFloat('fadeRatingThreshold');
    }

    nextState(current) {
        if (current === null) return 'always';
        if (current === 'always') return 'never';
        return null;
    }
}
```

- [x] **Step 4: Run tests to verify they pass**

```bash
npm run test:unit -- fade-manager
```

Expected: all tests PASS

- [x] **Step 5: Commit**

```bash
git add src/core/fade-manager.js tests/unit/core/fade-manager.test.js
git commit -m "feat(fade-manager): add FadeManager with override storage and fade decision"
```

---

## Task 2: Config field

**Files:**

- Modify: `src/core/config-fields.js`

**Interfaces:**

- Consumes: nothing new
- Produces: `CONFIG_FIELDS` now includes `{ key: 'enableFadeToggle', type: 'checkbox', default: true, row: 'fade-settings' }`

- [x] **Step 1: Add the field to CONFIG_FIELDS**

In `src/core/config-fields.js`, after the `fadeRatingThreshold` entry (around line 114), insert:

```js
    {
        key: 'enableFadeToggle',
        label: 'Fade override per title',
        type: 'checkbox',
        default: true,
        title: 'Shows a button in the hover preview to always fade, never fade, or follow the rating rule for individual titles.',
        row: 'fade-settings',
    },
```

- [x] **Step 2: Run tests to verify they pass**

The existing `it.each(CONFIG_FIELDS)` test in `tests/unit/core/config-fields.test.js` validates all field structures automatically.

```bash
npm run test:unit -- config-fields
```

Expected: all tests PASS

- [x] **Step 3: Commit**

```bash
git add src/core/config-fields.js
git commit -m "feat(config): add enableFadeToggle checkbox field"
```

---

## Task 3: Surfaces — add `showFadeToggle`

**Files:**

- Modify: `src/core/surfaces.js`
- Modify: `tests/unit/core/surfaces.test.js`
- Modify: `tests/ui/preview-mini.ui.test.js`
- Modify: `tests/ui/preview-detail.ui.test.js`

**Interfaces:**

- Consumes: nothing new
- Produces: `SurfaceManager.discover()` returns `{ container, title, fadeable, showFadeToggle: boolean }` — `true` only for the mini-modal surface

- [x] **Step 1: Write failing tests**

In `tests/unit/core/surfaces.test.js`, add inside the `describe('SurfaceManager', ...)` block:

```js
it('should set showFadeToggle to false for title-card surfaces', () => {
    const results = discover(`
        <div class="title-card"><div class="fallback-text">Movie</div></div>
    `);
    expect(results[0].showFadeToggle).toBe(false);
});

it('should set showFadeToggle to false for search card surfaces', () => {
    const results = discover(`
        <div data-uia="standard-card" aria-label="Movie"></div>
    `);
    expect(results[0].showFadeToggle).toBe(false);
});

it('should set showFadeToggle to true for the mini-modal surface', () => {
    const results = discover(`
        <div class="previewModal--wrapper mini-modal">
            <div class="previewModal--player_container">
                <img alt="Movie Title">
            </div>
        </div>
    `);
    expect(results[0].showFadeToggle).toBe(true);
});

it('should set showFadeToggle to false for the detail-modal surface', () => {
    const results = discover(`
        <div class="previewModal--wrapper detail-modal">
            <div class="previewModal--player_container">
                <img alt="Movie Title">
            </div>
        </div>
    `);
    expect(results[0].showFadeToggle).toBe(false);
});
```

In `tests/ui/preview-mini.ui.test.js`, add inside the describe block after the existing `fadeable` test:

```js
it('should set showFadeToggle to true for the mini-modal surface', () => {
    const results = surfaceManager.discover(document.body);
    results.forEach(r => {
        expect(r.showFadeToggle).toBe(true);
    });
});
```

In `tests/ui/preview-detail.ui.test.js`, add after the existing `fadeable` test:

```js
it('should set showFadeToggle to false for the detail-modal surface', () => {
    const results = surfaceManager.discover(document.body);
    results.forEach(r => {
        expect(r.showFadeToggle).toBe(false);
    });
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: new `showFadeToggle` assertions FAIL (property is undefined)

- [x] **Step 3: Update surfaces.js**

In `src/core/surfaces.js`, add `showFadeToggle` to each surface definition and to the `discover()` return:

```js
    #SURFACES = [
        {
            titleSelectors: '.title-card .fallback-text',
            getTitle: el => el.textContent?.trim() ?? null,
            containerSel: '.title-card',
            fadeable: true,
            showFadeToggle: false,
        },
        {
            titleSelectors: '[data-uia="standard-card"]',
            getTitle: el => el.getAttribute('aria-label')?.trim() ?? null,
            containerSel: '[data-uia="standard-card"]',
            fadeable: true,
            showFadeToggle: false,
        },
        {
            titleSelectors: '.previewModal--wrapper.mini-modal .previewModal--player_container img[alt]',
            getTitle: el => el.getAttribute('alt')?.trim() ?? null,
            containerSel: '.previewModal--player_container',
            fadeable: false,
            showFadeToggle: true,
        },
        {
            titleSelectors: '.previewModal--wrapper.detail-modal .previewModal--player_container img[alt]',
            getTitle: el => el.getAttribute('alt')?.trim() ?? null,
            containerSel: '.previewModal--player_container',
            fadeable: false,
            showFadeToggle: false,
        },
    ];
```

In the `discover()` method, update the return push to include `showFadeToggle`:

```js
results.push({
    container,
    title,
    fadeable: surface.fadeable ?? false,
    showFadeToggle: surface.showFadeToggle ?? false,
});
```

- [x] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: all tests PASS

- [x] **Step 5: Commit**

```bash
git add src/core/surfaces.js tests/unit/core/surfaces.test.js tests/ui/preview-mini.ui.test.js tests/ui/preview-detail.ui.test.js
git commit -m "feat(surfaces): add showFadeToggle property to surface definitions"
```

---

## Task 4: OverlayRenderer — simplify applyFade + fade toggle badge

**Files:**

- Modify: `src/core/overlay.js`
- Modify: `tests/unit/core/overlay.test.js`
- Modify: `tests/ui/browse.ui.test.js`
- Modify: `tests/ui/preview-mini.ui.test.js`
- Modify: `tests/ui/preview-detail.ui.test.js`

**Interfaces:**

- Consumes: `FadeManager` not needed here — toggle state is passed in as a value
- Produces:
    - `applyFade(container: Element, shouldFade: boolean): void`
    - `injectOverlay(container, titleObj, fadeToggleState?: 'always' | 'never' | null, onFadeToggleClick?: (badgeEl: Element) => void): void`

- [x] **Step 1: Update applyFade tests and add toggle tests in overlay.test.js**

Replace the existing `describe('Fade', ...)` block (lines ~253–283) in `tests/unit/core/overlay.test.js` with:

```js
describe('Fade', () => {
    it('should add fm-faded class when shouldFade is true', () => {
        const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
        const container = document.createElement('div');
        renderer.applyFade(container, true);
        expect(container.classList.contains('fm-faded')).toBe(true);
    });

    it('should remove fm-faded class when shouldFade is false', () => {
        const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
        const container = document.createElement('div');
        container.classList.add('fm-faded');
        renderer.applyFade(container, false);
        expect(container.classList.contains('fm-faded')).toBe(false);
    });
});
```

Add a new `describe('Fade toggle', ...)` block after the Fade block:

```js
describe('Fade toggle', () => {
    function makeConfig(enableFadeToggle) {
        return new ConfigManager(
            createMockAdapter({
                configGet: key => (key === 'enableFadeToggle' ? enableFadeToggle : undefined),
            })
        );
    }

    const titleObj = { rating: 7.0, imdbUrl: 'https://www.imdb.com/title/tt1/', imdbId: 'tt1' };

    it('should not render toggle when onFadeToggleClick is absent', () => {
        const renderer = new OverlayRenderer(makeConfig(true));
        const container = document.createElement('div');
        renderer.injectOverlay(container, titleObj);
        expect(container.querySelector('.fm-fade-toggle')).toBeNull();
    });

    it('should not render toggle when enableFadeToggle config is false', () => {
        const renderer = new OverlayRenderer(makeConfig(false));
        const container = document.createElement('div');
        renderer.injectOverlay(container, titleObj, null, vi.fn());
        expect(container.querySelector('.fm-fade-toggle')).toBeNull();
    });

    it('should render toggle with ⭐ and data-state="auto" for null state', () => {
        const renderer = new OverlayRenderer(makeConfig(true));
        const container = document.createElement('div');
        renderer.injectOverlay(container, titleObj, null, vi.fn());
        const toggle = container.querySelector('.fm-fade-toggle');
        expect(toggle).not.toBeNull();
        expect(toggle.dataset.state).toBe('auto');
        expect(toggle.textContent).toBe('⭐');
        expect(toggle.classList.contains('fm-fade-toggle--faded')).toBe(false);
    });

    it('should render toggle with 👁️ and fm-fade-toggle--faded for "always" state', () => {
        const renderer = new OverlayRenderer(makeConfig(true));
        const container = document.createElement('div');
        renderer.injectOverlay(container, titleObj, 'always', vi.fn());
        const toggle = container.querySelector('.fm-fade-toggle');
        expect(toggle.dataset.state).toBe('always');
        expect(toggle.textContent).toBe('👁️');
        expect(toggle.classList.contains('fm-fade-toggle--faded')).toBe(true);
    });

    it('should render toggle with 👁️ without fm-fade-toggle--faded for "never" state', () => {
        const renderer = new OverlayRenderer(makeConfig(true));
        const container = document.createElement('div');
        renderer.injectOverlay(container, titleObj, 'never', vi.fn());
        const toggle = container.querySelector('.fm-fade-toggle');
        expect(toggle.dataset.state).toBe('never');
        expect(toggle.textContent).toBe('👁️');
        expect(toggle.classList.contains('fm-fade-toggle--faded')).toBe(false);
    });

    it('should call onFadeToggleClick with the badge element on click', () => {
        const renderer = new OverlayRenderer(makeConfig(true));
        const container = document.createElement('div');
        document.body.appendChild(container);
        const onClick = vi.fn();
        renderer.injectOverlay(container, titleObj, null, onClick);
        const toggle = container.querySelector('.fm-fade-toggle');
        toggle.click();
        expect(onClick).toHaveBeenCalledWith(toggle);
    });

    it('should include fm-fade-toggle CSS in injected styles', () => {
        const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
        renderer.injectStyles();
        const css = document.head.querySelector('#fm-overlay-styles').textContent;
        expect(css).toContain('.fm-fade-toggle');
        expect(css).toContain('.fm-fade-toggle--faded');
    });
});
```

- [x] **Step 2: Fix broken applyFade call sites in UI tests**

In `tests/ui/browse.ui.test.js`, replace (around lines 105 and 122):

```js
// Line ~105: was applyFade(container, { rating: 7.0 }, true)
new OverlayRenderer(mockConfig).applyFade(container, true);
// ...
// Line ~122: was applyFade(container, { rating: 9.5 }, true)
new OverlayRenderer(mockConfig).applyFade(container, false);
```

The two surrounding `it` blocks become:

```js
it('should apply fading for low ratings below threshold', () => {
    const surfaces = surfaceManager.discover(document.body);
    const { container } = surfaces[0];

    const mockConfig = new ConfigManager(
        createMockAdapter({
            configGet: key => {
                if (key === 'enableFadeUnderRating') return true;
                if (key === 'fadeRatingThreshold') return 9.0;
                return null;
            },
        })
    );
    new OverlayRenderer(mockConfig).applyFade(container, true);
    expect(container.classList.contains('fm-faded')).toBe(true);
});

it('should NOT apply fading for ratings at or above threshold', () => {
    const surfaces = surfaceManager.discover(document.body);
    const { container } = surfaces[0];

    const mockConfig = new ConfigManager(
        createMockAdapter({
            configGet: key => {
                if (key === 'enableFadeUnderRating') return true;
                if (key === 'fadeRatingThreshold') return 9.0;
                return null;
            },
        })
    );
    new OverlayRenderer(mockConfig).applyFade(container, false);
    expect(container.classList.contains('fm-faded')).toBe(false);
});
```

In `tests/ui/preview-mini.ui.test.js`, replace the `applyFade` test (around line 75–81):

```js
it('should not apply fading to the mini-modal container', () => {
    const results = surfaceManager.discover(document.body);
    const { container } = results[0];

    overlayRenderer.applyFade(container, false);
    expect(container.classList.contains('fm-faded')).toBe(false);
});
```

In `tests/ui/preview-detail.ui.test.js`, replace the `applyFade` test (same structure):

```js
it('should not apply fading to the detail-modal container', () => {
    const results = surfaceManager.discover(document.body);
    const { container } = results[0];

    overlayRenderer.applyFade(container, false);
    expect(container.classList.contains('fm-faded')).toBe(false);
});
```

- [x] **Step 3: Run tests to verify they fail**

```bash
npm test
```

Expected: new toggle tests FAIL, old `applyFade` tests in overlay.test.js FAIL (wrong arity)

- [x] **Step 4: Implement changes in overlay.js**

**4a — simplify `applyFade`** (replace the existing method):

```js
    applyFade(container, shouldFade) {
        container.classList.toggle('fm-faded', shouldFade);
    }
```

**4b — add `#createFadeToggle` private method** (add after `#createSearchRatingElement`):

```js
    #createFadeToggle(state, onClick) {
        const el = document.createElement('div');
        el.className = 'fm-fade-toggle';
        el.dataset.state = state ?? 'auto';
        if (state === 'always') el.classList.add('fm-fade-toggle--faded');
        el.textContent = state === null ? '⭐' : '👁️';
        el.addEventListener('click', e => {
            e.stopPropagation();
            onClick(el);
        });
        return el;
    }
```

**4c — extend `injectOverlay`** (replace the existing method signature and body):

```js
    injectOverlay(container, titleObj, fadeToggleState = null, onFadeToggleClick = null) {
        container.querySelector(`.${this.#OVERLAY_CLASS}`)?.remove();
        const overlay = this.#createOverlay(titleObj);
        if (onFadeToggleClick && this.#config.getBool('enableFadeToggle')) {
            overlay.appendChild(this.#createFadeToggle(fadeToggleState, onFadeToggleClick));
        }
        container.appendChild(overlay);
        container.setAttribute(this.#OVERLAY_ATTR, '1');
    }
```

**4d — add CSS to `injectStyles`** — inside the `cssText` template literal, after the existing `.fm-faded` rule block, add:

```js
cssText += `
            .fm-fade-toggle { cursor: pointer; }
            .fm-fade-toggle--faded { opacity: 0.35; }
        `;
```

- [x] **Step 5: Run tests to verify they pass**

```bash
npm test
```

Expected: all tests PASS

- [x] **Step 6: Commit**

```bash
git add src/core/overlay.js tests/unit/core/overlay.test.js tests/ui/browse.ui.test.js tests/ui/preview-mini.ui.test.js tests/ui/preview-detail.ui.test.js
git commit -m "feat(overlay): add fade toggle badge and simplify applyFade to boolean"
```

---

## Task 5: Wire FlixMonkeyApp

**Files:**

- Modify: `src/core/app.js`
- Modify: `tests/unit/core/app.test.js`

**Interfaces:**

- Consumes:
    - `FadeManager`: `getOverride(dedupKey)`, `setOverride(dedupKey, state)`, `shouldFade(override, rating, config)`, `nextState(current)`
    - `OverlayRenderer.applyFade(container, bool)` (Task 4)
    - `OverlayRenderer.injectOverlay(container, titleObj, fadeToggleState, onFadeToggleClick)` (Task 4)
    - `SurfaceManager.discover()` returns `showFadeToggle` (Task 3)
- Produces: `startApp(adapter)` unchanged public API

- [x] **Step 1: Write failing tests**

In `tests/unit/core/app.test.js`, at the top add the FadeManager import:

```js
import { FadeManager } from '../../../src/core/fade-manager.js';
```

Find the existing `'should throw if init() is called twice'` test (line ~297) and update the direct `FlixMonkeyApp` constructor call — it must now receive `fadeManager` and `config` as 5th and 6th args:

```js
it('should throw if init() is called twice on the same instance', () => {
    const mockRenderer = {
        injectStyles: vi.fn(),
        hasOverlay: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(false),
    };
    const mockSurfaces = { discover: vi.fn().mockReturnValue([]) };
    const mockFadeManager = {
        getOverride: vi.fn().mockResolvedValue(null),
        shouldFade: vi.fn().mockReturnValue(false),
        nextState: vi.fn(),
    };
    const mockConfig = { getBool: vi.fn().mockReturnValue(false), getFloat: vi.fn().mockReturnValue(6.0) };
    const app = new FlixMonkeyApp({}, {}, mockRenderer, mockSurfaces, mockFadeManager, mockConfig, createMockLogger());
    app.init();
    expect(() => app.init()).toThrow('FlixMonkeyApp already initialised');
    app.disconnect();
});
```

Add new tests at the end of the `describe('App', ...)` block:

```js
it('should stamp data-fm-key on fadeable card containers after decoration', async () => {
    document.body.innerHTML = `
            <div class="title-card">
                <div class="fallback-text">Stamped Movie</div>
            </div>
        `;
    const spy = vi
        .spyOn(ApiClientManager.prototype, 'getData')
        .mockResolvedValue({ rating: 7.0, imdbUrl: 'http://imdb.com', imdbId: 'tt1' });
    appRef = startApp(createMockAdapter());
    await vi.waitFor(() => {
        if (spy.mock.calls.length === 0) throw new Error('Not called');
    });
    await vi.runAllTimersAsync();
    const card = document.querySelector('.title-card');
    await vi.waitFor(() => {
        if (!card.dataset.fmKey) throw new Error('Not stamped yet');
    });
    expect(card.dataset.fmKey).toBeTruthy();
    spy.mockRestore();
});

it('should not stamp data-fm-key on non-fadeable mini-modal containers', async () => {
    document.body.innerHTML = `
            <div class="previewModal--wrapper mini-modal">
                <div class="previewModal--player_container">
                    <img alt="Mini Movie">
                </div>
            </div>
        `;
    const spy = vi
        .spyOn(ApiClientManager.prototype, 'getData')
        .mockResolvedValue({ rating: 5.0, imdbUrl: 'http://imdb.com', imdbId: 'tt2' });
    appRef = startApp(createMockAdapter());
    await vi.waitFor(() => {
        if (spy.mock.calls.length === 0) throw new Error('Not called');
    });
    await vi.runAllTimersAsync();
    const container = document.querySelector('.previewModal--player_container');
    await vi.waitFor(() => {
        if (!container.querySelector('.fm-rating-overlay')) throw new Error('Overlay not injected');
    });
    expect(container.dataset.fmKey).toBeUndefined();
    spy.mockRestore();
});

it('should render a fade toggle badge in the mini-modal when enableFadeToggle is true', async () => {
    document.body.innerHTML = `
            <div class="previewModal--wrapper mini-modal">
                <div class="previewModal--player_container">
                    <img alt="Toggle Movie">
                </div>
            </div>
        `;
    const adapter = createMockAdapter({
        configGet: key => (key === 'enableFadeToggle' ? true : undefined),
        storageGet: vi.fn().mockResolvedValue(null),
    });
    vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue({
        rating: 7.0,
        imdbUrl: 'http://imdb.com',
        imdbId: 'tt3',
    });
    appRef = startApp(adapter);
    const container = document.querySelector('.previewModal--player_container');
    await vi.waitFor(() => {
        if (!container.querySelector('.fm-fade-toggle')) throw new Error('Toggle not found');
    });
    expect(container.querySelector('.fm-fade-toggle')).not.toBeNull();
    expect(container.querySelector('.fm-fade-toggle').dataset.state).toBe('auto');
});

it('should cycle fade toggle state on click and update sibling cards', async () => {
    document.body.innerHTML = `
            <div class="title-card" id="card1"><div class="fallback-text">Cycle Movie</div></div>
            <div class="previewModal--wrapper mini-modal">
                <div class="previewModal--player_container">
                    <img alt="Cycle Movie">
                </div>
            </div>
        `;
    const storageGet = vi.fn().mockResolvedValue(null);
    const storageSet = vi.fn().mockResolvedValue(undefined);
    const adapter = createMockAdapter({
        configGet: key => {
            if (key === 'enableFadeToggle') return true;
            if (key === 'enableFadeUnderRating') return false;
            return undefined;
        },
        storageGet,
        storageSet,
    });
    vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue({
        rating: 5.0,
        imdbUrl: 'http://imdb.com',
        imdbId: 'tt4',
    });
    appRef = startApp(adapter);
    const modal = document.querySelector('.previewModal--player_container');
    await vi.waitFor(() => {
        if (!modal.querySelector('.fm-fade-toggle')) throw new Error('Toggle not found');
    });
    const toggle = modal.querySelector('.fm-fade-toggle');
    expect(toggle.dataset.state).toBe('auto');
    toggle.click();
    await vi.waitFor(() => {
        if (toggle.dataset.state !== 'always') throw new Error('State not updated');
    });
    expect(storageSet).toHaveBeenCalledWith(expect.stringContaining('fm-fade:'), 'always');
    const card = document.querySelector('.title-card');
    expect(card.classList.contains('fm-faded')).toBe(true);
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: the updated constructor test FAILS (wrong arg count), new toggle/stamp tests FAIL

- [x] **Step 3: Implement changes in app.js**

**3a — add import** at the top of `src/core/app.js` alongside other imports:

```js
import { FadeManager } from './fade-manager.js';
```

**3b — add private fields** to the class body (after `#observer = null`):

```js
    #fadeManager;
    #config;
```

**3c — update constructor** signature and body:

```js
    constructor(cache, api, renderer, surfaces, fadeManager, config, logger) {
        this.#cache = cache;
        this.#api = api;
        this.#renderer = renderer;
        this.#surfaces = surfaces;
        this.#fadeManager = fadeManager;
        this.#config = config;
        this.#logger = logger;
        this.#debouncedDecorate = debounce(() => {
            const roots = this.#pendingRoots.size > 0 ? [...this.#pendingRoots] : [document];
            this.#pendingRoots.clear();
            runIdle(() => roots.forEach(root => this.decorateRoot(root)));
        }, DECORATION_DEBOUNCE_MS);
    }
```

**3d — update `decorateRoot`** to pass `showFadeToggle`:

```js
    decorateRoot(root) {
        this.#surfaces.discover(root).forEach(({ container, title, fadeable, showFadeToggle }) => {
            this.#decorateContainer(container, title, fadeable, showFadeToggle).catch(err =>
                this.#logger.error('Failed to decorate container', err)
            );
        });
    }
```

**3e — replace `#decorateContainer`** with the new signature:

```js
    async #decorateContainer(container, displayTitle, fadeable, showFadeToggle) {
        if (this.#renderer.hasOverlay(container) || this.#renderer.isLoading(container)) return;

        const dedupKey = slugify(displayTitle);

        this.#renderer.ensureRelative(container);
        this.#renderer.injectLoadingOverlay(container);

        await new Promise(resolve => setTimeout(resolve, 0));

        const fadeOverride = showFadeToggle ? await this.#fadeManager.getOverride(dedupKey) : null;

        let promise = this.#inFlight.get(dedupKey);
        if (!promise) {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('inflight timeout')), INFLIGHT_TIMEOUT_MS)
            );
            promise = Promise.race([this.#api.getData(displayTitle), timeoutPromise]).finally(() =>
                this.#inFlight.delete(dedupKey)
            );
            this.#inFlight.set(dedupKey, promise);
        }

        try {
            const data = await promise;
            if (!this.#renderer.hasOverlay(container) && document.contains(container)) {
                const shouldFade = fadeable && this.#fadeManager.shouldFade(fadeOverride, data.rating, this.#config);
                this.#renderer.applyFade(container, shouldFade);
                if (fadeable) container.dataset.fmKey = dedupKey;
                const onFadeToggleClick = showFadeToggle
                    ? el => this.#handleFadeToggleClick(dedupKey, data.rating, el)
                    : null;
                this.#renderer.injectOverlay(container, data, showFadeToggle ? fadeOverride : null, onFadeToggleClick);
            }
        } finally {
            this.#renderer.removeLoadingOverlay(container);
        }
    }
```

**3f — add `#handleFadeToggleClick`** private method (add after `#decorateContainer`):

```js
    async #handleFadeToggleClick(dedupKey, rating, toggleBadgeEl) {
        const domState = toggleBadgeEl.dataset.state;
        const currentState = domState === 'auto' ? null : domState;
        const nextState = this.#fadeManager.nextState(currentState);
        await this.#fadeManager.setOverride(dedupKey, nextState);
        toggleBadgeEl.dataset.state = nextState ?? 'auto';
        toggleBadgeEl.textContent = nextState === null ? '⭐' : '👁️';
        toggleBadgeEl.classList.toggle('fm-fade-toggle--faded', nextState === 'always');
        const shouldFade = this.#fadeManager.shouldFade(nextState, rating, this.#config);
        document.querySelectorAll(`[data-fm-key="${dedupKey}"]`).forEach(c => {
            this.#renderer.applyFade(c, shouldFade);
        });
    }
```

**3g — update `startApp`** to construct `FadeManager` and pass it with `configManager`:

```js
export function startApp(adapter) {
    const logger = new Logger(adapter);
    const configManager = new ConfigManager(adapter, logger);
    const cache = new CacheManager(adapter, configManager, logger);
    const disabledManager = new DisabledClientsManager(adapter);
    const client = createApiClient(configManager, disabledManager, adapter, logger);
    const api = new ApiClientManager(cache, disabledManager, client, logger);
    const renderer = new OverlayRenderer(configManager);
    const surfaces = new SurfaceManager(logger);
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

- [x] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: all tests PASS

- [x] **Step 5: Commit**

```bash
git add src/core/app.js tests/unit/core/app.test.js
git commit -m "feat(app): wire FadeManager and fade toggle into decoration flow"
```

---

## Self-Review Checklist

- [x] FadeManager: `getOverride`, `setOverride`, `shouldFade`, `nextState` — all covered in Task 1
- [x] `enableFadeToggle` config field — Task 2
- [x] `showFadeToggle` on surfaces + discover return — Task 3
- [x] `applyFade(container, bool)` simplification — Task 4
- [x] `#createFadeToggle` private method + CSS — Task 4
- [x] `injectOverlay` extended params — Task 4
- [x] `FlixMonkeyApp` constructor updated — Task 5
- [x] `#decorateContainer` reads override, stamps `data-fm-key`, wires toggle — Task 5
- [x] `#handleFadeToggleClick` cycles state, persists, updates badge + sibling cards — Task 5
- [x] `startApp` constructs `FadeManager` — Task 5
- [x] All broken `applyFade` call sites in tests updated — Task 4
- [x] Direct `FlixMonkeyApp` constructor call in app.test.js updated — Task 5
- [x] No placeholders or TBDs
- [x] State cycle `null → 'always' → 'never' → null` consistent across FadeManager and handler
- [x] DOM state attribute maps `null → 'auto'` consistently in both `#createFadeToggle` and `#handleFadeToggleClick`
