# Manual Fade Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-title 3-state toggle (faded / not-faded / auto) that lets users override automatic fade behavior, with persistent storage and a new FadeManager class.

**Architecture:** Three layers: a new `FadeManager` class owns fade override storage and decision logic; the `OverlayRenderer` gains toggle DOM rendering and simplified `applyFade()`; the `FlixMonkeyApp` orchestrates early-fade application and wires the toggle callback. A new config field controls feature visibility.

**Tech Stack:** JavaScript ES2022, Vitest + jsdom

## Global Constraints

- ES modules with `import`/`export` everywhere
- Private fields use `#field` syntax
- Every file starts with the GPL-3.0 license header
- Conventional Commits enforced by commitlint
- All changed business logic must have test coverage

---

### Task 1: FadeManager — override storage and fade decision logic

**Files:**

- Create: `src/core/fade-manager.js`
- Test: `tests/unit/core/fade-manager.test.js`

**Interfaces:**

- Consumes: `PlatformAdapter.storageGet(key)`, `PlatformAdapter.storageSet(key, value)`, `PlatformAdapter.storageDelete(key)`, `ConfigManager.get(key, fallback)`, `ConfigManager.getFloat(key, fallback)`
- Produces: `FadeManager.getOverride(titleKey) → Promise<true|false|null>` — used by Tasks 3, 4
- Produces: `FadeManager.setOverride(titleKey, value) → Promise<void>` — used by Task 4
- Produces: `FadeManager.shouldFade(fadeOverride, rating, fadeable) → boolean` — used by Tasks 3, 4
- Produces: `FadeManager.getToggleState(fadeOverride, isRatingFaded) → 'faded'|'auto'|'not-faded'` — used by Task 3
- Produces: `FadeManager.nextToggleState(currentState) → 'faded'|'auto'|'not-faded'` — used by Task 3

- [ ] **Step 1: Write failing tests for `getOverride`**

Create `tests/unit/core/fade-manager.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FadeManager } from '../../../src/core/fade-manager.js';
import { ConfigManager } from '../../../src/core/config-manager.js';
import { createMockAdapter } from '../../mocks/adapter.js';

describe('FadeManager', () => {
    let adapter;
    let config;
    let fade;

    beforeEach(() => {
        adapter = createMockAdapter();
        config = new ConfigManager(adapter);
        fade = new FadeManager(adapter, config);
    });

    describe('getOverride', () => {
        it('should return true when stored value is "true"', async () => {
            adapter.storageGet.mockResolvedValue('true');
            expect(await fade.getOverride('some movie')).toBe(true);
            expect(adapter.storageGet).toHaveBeenCalledWith('fm-fade:some movie');
        });

        it('should return false when stored value is "false"', async () => {
            adapter.storageGet.mockResolvedValue('false');
            expect(await fade.getOverride('some movie')).toBe(false);
        });

        it('should return null when no stored value', async () => {
            adapter.storageGet.mockResolvedValue(null);
            expect(await fade.getOverride('some movie')).toBeNull();
        });

        it('should return null when stored value is undefined', async () => {
            adapter.storageGet.mockResolvedValue(undefined);
            expect(await fade.getOverride('some movie')).toBeNull();
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/core/fade-manager.test.js`
Expected: FAIL — module `fade-manager.js` does not exist

- [ ] **Step 3: Implement `FadeManager` with `getOverride`**

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
    #config;
    #prefix = 'fm-fade:';

    constructor(adapter, config) {
        this.#adapter = adapter;
        this.#config = config;
    }

    async getOverride(titleKey) {
        const val = await this.#adapter.storageGet(`${this.#prefix}${titleKey}`);
        if (val === 'true') return true;
        if (val === 'false') return false;
        return null;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/core/fade-manager.test.js`
Expected: PASS

- [ ] **Step 5: Write failing tests for `setOverride`**

Append to the `describe('FadeManager')` block in `tests/unit/core/fade-manager.test.js`:

```js
describe('setOverride', () => {
    it('should store "true" for fade override', async () => {
        await fade.setOverride('some movie', true);
        expect(adapter.storageSet).toHaveBeenCalledWith('fm-fade:some movie', 'true');
    });

    it('should store "false" for not-faded override', async () => {
        await fade.setOverride('some movie', false);
        expect(adapter.storageSet).toHaveBeenCalledWith('fm-fade:some movie', 'false');
    });

    it('should delete key for null (auto)', async () => {
        await fade.setOverride('some movie', null);
        expect(adapter.storageDelete).toHaveBeenCalledWith('fm-fade:some movie');
    });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/unit/core/fade-manager.test.js -t "setOverride"`
Expected: FAIL — `setOverride` is not a function

- [ ] **Step 7: Implement `setOverride`**

Add to `FadeManager` class in `src/core/fade-manager.js`:

```js
    async setOverride(titleKey, value) {
        const key = `${this.#prefix}${titleKey}`;
        if (value === null) {
            await this.#adapter.storageDelete(key);
        } else {
            await this.#adapter.storageSet(key, String(value));
        }
    }
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run tests/unit/core/fade-manager.test.js -t "setOverride"`
Expected: PASS

- [ ] **Step 9: Write failing tests for `shouldFade`**

Append to the `describe('FadeManager')` block:

```js
describe('shouldFade', () => {
    it('should return true when override is true and toggle enabled', () => {
        const config = new ConfigManager(
            createMockAdapter({
                configGet: key => {
                    if (key === 'enableFadeToggle') return true;
                    return undefined;
                },
            })
        );
        const fm = new FadeManager(createMockAdapter(), config);
        expect(fm.shouldFade(true, 9.0, true)).toBe(true);
    });

    it('should return false when override is false and toggle enabled', () => {
        const config = new ConfigManager(
            createMockAdapter({
                configGet: key => {
                    if (key === 'enableFadeToggle') return true;
                    return undefined;
                },
            })
        );
        const fm = new FadeManager(createMockAdapter(), config);
        expect(fm.shouldFade(false, 3.0, true)).toBe(false);
    });

    it('should ignore override when toggle disabled', () => {
        const config = new ConfigManager(
            createMockAdapter({
                configGet: key => {
                    if (key === 'enableFadeToggle') return false;
                    if (key === 'enableFadeUnderRating') return true;
                    if (key === 'fadeRatingThreshold') return 6.0;
                    return undefined;
                },
            })
        );
        const fm = new FadeManager(createMockAdapter(), config);
        expect(fm.shouldFade(false, 3.0, true)).toBe(true);
    });

    it('should fall back to rating logic when override is null', () => {
        const config = new ConfigManager(
            createMockAdapter({
                configGet: key => {
                    if (key === 'enableFadeToggle') return true;
                    if (key === 'enableFadeUnderRating') return true;
                    if (key === 'fadeRatingThreshold') return 6.0;
                    return undefined;
                },
            })
        );
        const fm = new FadeManager(createMockAdapter(), config);
        expect(fm.shouldFade(null, 5.0, true)).toBe(true);
        expect(fm.shouldFade(null, 7.0, true)).toBe(false);
    });

    it('should not fade when not fadeable and no override', () => {
        const config = new ConfigManager(
            createMockAdapter({
                configGet: key => {
                    if (key === 'enableFadeUnderRating') return true;
                    if (key === 'fadeRatingThreshold') return 6.0;
                    return undefined;
                },
            })
        );
        const fm = new FadeManager(createMockAdapter(), config);
        expect(fm.shouldFade(null, 3.0, false)).toBe(false);
    });

    it('should not fade when rating auto-fade is disabled and no override', () => {
        const config = new ConfigManager(
            createMockAdapter({
                configGet: key => {
                    if (key === 'enableFadeUnderRating') return false;
                    return undefined;
                },
            })
        );
        const fm = new FadeManager(createMockAdapter(), config);
        expect(fm.shouldFade(null, 3.0, true)).toBe(false);
    });

    it('should not fade when rating is null and no override', () => {
        const config = new ConfigManager(
            createMockAdapter({
                configGet: key => {
                    if (key === 'enableFadeUnderRating') return true;
                    if (key === 'fadeRatingThreshold') return 6.0;
                    return undefined;
                },
            })
        );
        const fm = new FadeManager(createMockAdapter(), config);
        expect(fm.shouldFade(null, null, true)).toBe(false);
    });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npx vitest run tests/unit/core/fade-manager.test.js -t "shouldFade"`
Expected: FAIL — `shouldFade` is not a function

- [ ] **Step 11: Implement `shouldFade`**

Add to `FadeManager` class in `src/core/fade-manager.js`:

```js
    shouldFade(fadeOverride, rating, fadeable) {
        if (this.#config.get('enableFadeToggle', true) && fadeOverride !== null) {
            return fadeOverride;
        }
        if (fadeable && this.#config.get('enableFadeUnderRating', false)) {
            return typeof rating === 'number' && rating < this.#config.getFloat('fadeRatingThreshold', 6.0);
        }
        return false;
    }
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npx vitest run tests/unit/core/fade-manager.test.js -t "shouldFade"`
Expected: PASS

- [ ] **Step 13: Write failing tests for `getToggleState` and `nextToggleState`**

Append to the `describe('FadeManager')` block:

```js
describe('getToggleState', () => {
    it('should return "faded" when override is true', () => {
        expect(fade.getToggleState(true, false)).toBe('faded');
    });

    it('should return "not-faded" when override is false', () => {
        expect(fade.getToggleState(false, true)).toBe('not-faded');
    });

    it('should return "faded" when no override and rating-faded', () => {
        expect(fade.getToggleState(null, true)).toBe('faded');
    });

    it('should return "auto" when no override and not rating-faded', () => {
        expect(fade.getToggleState(null, false)).toBe('auto');
    });
});

describe('nextToggleState', () => {
    it('should cycle faded -> not-faded', () => {
        expect(fade.nextToggleState('faded')).toBe('not-faded');
    });

    it('should cycle not-faded -> auto', () => {
        expect(fade.nextToggleState('not-faded')).toBe('auto');
    });

    it('should cycle auto -> faded', () => {
        expect(fade.nextToggleState('auto')).toBe('faded');
    });
});
```

- [ ] **Step 14: Run test to verify it fails**

Run: `npx vitest run tests/unit/core/fade-manager.test.js -t "getToggleState"`
Expected: FAIL — `getToggleState` is not a function

- [ ] **Step 15: Implement `getToggleState` and `nextToggleState`**

Add to `FadeManager` class in `src/core/fade-manager.js`:

```js
    getToggleState(fadeOverride, isRatingFaded) {
        if (fadeOverride === true) return 'faded';
        if (fadeOverride === false) return 'not-faded';
        return isRatingFaded ? 'faded' : 'auto';
    }

    nextToggleState(currentState) {
        const cycle = { 'faded': 'not-faded', 'not-faded': 'auto', 'auto': 'faded' };
        return cycle[currentState];
    }
```

- [ ] **Step 16: Run all FadeManager tests**

Run: `npx vitest run tests/unit/core/fade-manager.test.js`
Expected: All PASS

- [ ] **Step 17: Commit**

```bash
git add src/core/fade-manager.js tests/unit/core/fade-manager.test.js
git commit -m "feat: add FadeManager for per-title fade overrides"
```

---

### Task 2: Config field and OverlayRenderer changes

**Files:**

- Modify: `src/core/config-fields.js:86-100` (add new field after `enableFadeUnderRating` row)
- Modify: `src/core/overlay.js` (simplify `applyFade`, add toggle rendering, add CSS)
- Modify: `tests/unit/core/overlay.test.js`
- Modify: `tests/ui/overlay.ui.test.js`

**Interfaces:**

- Consumes: `FadeManager.getToggleState()`, `FadeManager.nextToggleState()` — from Task 1
- Produces: `OverlayRenderer.applyFade(container, shouldFade)` — used by Task 3
- Produces: `OverlayRenderer.injectOverlay(container, titleObj, toggleOptions)` — used by Task 3
- `toggleOptions` shape: `{ state: 'faded'|'auto'|'not-faded', onClick: Function } | null`

- [ ] **Step 1: Add `enableFadeToggle` config field**

In `src/core/config-fields.js`, add after the `fadeRatingThreshold` field (after line 100):

```js
    {
        key: 'enableFadeToggle',
        label: 'Show fade toggle',
        type: 'checkbox',
        default: true,
        title: 'Show per-title fade override toggle on hover.',
        row: 'fade-toggle-settings',
    },
```

- [ ] **Step 2: Run config-fields tests to verify no regressions**

Run: `npx vitest run tests/unit/core/config-fields.test.js`
Expected: PASS (existing `it.each(CONFIG_FIELDS)` tests automatically cover the new field's structure)

- [ ] **Step 3: Write failing tests for simplified `applyFade`**

In `tests/ui/overlay.ui.test.js`, update the existing fade tests. Replace the three existing `applyFade` tests (lines 94-181) with:

```js
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
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run tests/ui/overlay.ui.test.js -t "should add fm-faded class"`
Expected: FAIL — `applyFade` still expects the old 3-argument signature

- [ ] **Step 5: Simplify `applyFade` in `OverlayRenderer`**

In `src/core/overlay.js`, replace the `applyFade` method (lines 222-233) with:

```js
    applyFade(container, shouldFade) {
        container.classList.toggle('fm-faded', shouldFade);
    }
```

- [ ] **Step 6: Run fade tests to verify they pass**

Run: `npx vitest run tests/ui/overlay.ui.test.js -t "fm-faded"`
Expected: PASS

- [ ] **Step 7: Write failing test for toggle rendering**

Add to `tests/ui/overlay.ui.test.js`:

```js
it('should render fade toggle when toggleOptions provided', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    const container = document.createElement('div');
    const titleObj = { rating: 7.0, imdbUrl: 'http://imdb.com' };
    const toggleOptions = { state: 'auto', onClick: vi.fn() };
    renderer.injectOverlay(container, titleObj, toggleOptions);

    const toggle = container.querySelector('.fm-fade-toggle');
    expect(toggle).not.toBeNull();
    expect(toggle.dataset.state).toBe('auto');
});

it('should not render fade toggle when toggleOptions is null', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    const container = document.createElement('div');
    const titleObj = { rating: 7.0, imdbUrl: 'http://imdb.com' };
    renderer.injectOverlay(container, titleObj, null);

    expect(container.querySelector('.fm-fade-toggle')).toBeNull();
});

it('should call onClick when toggle is clicked', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    const container = document.createElement('div');
    const titleObj = { rating: 7.0, imdbUrl: 'http://imdb.com' };
    const onClick = vi.fn();
    renderer.injectOverlay(container, titleObj, { state: 'auto', onClick });

    const toggle = container.querySelector('.fm-fade-toggle');
    toggle.click();
    expect(onClick).toHaveBeenCalled();
});

it('should stop propagation on toggle click', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    const container = document.createElement('div');
    const titleObj = { rating: 7.0, imdbUrl: 'http://imdb.com' };
    renderer.injectOverlay(container, titleObj, { state: 'faded', onClick: vi.fn() });

    const toggle = container.querySelector('.fm-fade-toggle');
    const event = new MouseEvent('click', { bubbles: true });
    const spy = vi.spyOn(event, 'stopPropagation');
    toggle.dispatchEvent(event);
    expect(spy).toHaveBeenCalled();
});

it('should render toggle with correct state classes', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));

    ['faded', 'auto', 'not-faded'].forEach(state => {
        const container = document.createElement('div');
        const titleObj = { rating: 7.0, imdbUrl: 'http://imdb.com' };
        renderer.injectOverlay(container, titleObj, { state, onClick: vi.fn() });
        const toggle = container.querySelector('.fm-fade-toggle');
        expect(toggle.dataset.state).toBe(state);
    });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `npx vitest run tests/ui/overlay.ui.test.js -t "fade toggle"`
Expected: FAIL — no `.fm-fade-toggle` element rendered

- [ ] **Step 9: Implement toggle rendering in `OverlayRenderer`**

In `src/core/overlay.js`, add a private method before `#createOverlay`:

```js
    #createFadeToggle(initialState, onClick) {
        const toggle = document.createElement('div');
        toggle.className = 'fm-fade-toggle';
        toggle.dataset.state = initialState;

        const track = document.createElement('div');
        track.className = 'fm-toggle-track';

        const knob = document.createElement('div');
        knob.className = 'fm-toggle-knob';

        track.appendChild(knob);
        toggle.appendChild(track);

        toggle.addEventListener('click', e => {
            e.stopPropagation();
            onClick();
        });

        return toggle;
    }
```

Update the `#createOverlay` method signature to accept `toggleOptions` and append the toggle:

```js
    #createOverlay(titleObj, toggleOptions = null) {
```

At the end of `#createOverlay`, before `return container;`, add:

```js
if (toggleOptions) {
    container.appendChild(this.#createFadeToggle(toggleOptions.state, toggleOptions.onClick));
}
```

Update `injectOverlay` to accept and pass `toggleOptions`:

```js
    injectOverlay(container, titleObj, toggleOptions = null) {
        container.querySelector(`.${this.#OVERLAY_CLASS}`)?.remove();
        container.appendChild(this.#createOverlay(titleObj, toggleOptions));
        container.setAttribute(this.#OVERLAY_ATTR, '1');
    }
```

- [ ] **Step 10: Run toggle tests to verify they pass**

Run: `npx vitest run tests/ui/overlay.ui.test.js -t "fade toggle"`
Expected: PASS

- [ ] **Step 11: Add toggle CSS to `injectStyles`**

In `src/core/overlay.js`, in the `injectStyles` method, add after the `.fm-faded:hover` rule (after line 85):

```js
cssText += `
            .fm-fade-toggle {
                opacity: 0;
                transition: opacity 0.15s;
                pointer-events: none;
                cursor: pointer;
                padding: 0;
                background: transparent !important;
            }
            .fm-fade-toggle:hover {
                background: transparent !important;
            }
            .fm-toggle-track {
                width: 48px;
                height: 18px;
                border-radius: 9px;
                background: rgba(255,255,255,0.25);
                position: relative;
                transition: background 0.2s;
            }
            .fm-toggle-knob {
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: #fff;
                position: absolute;
                top: 2px;
                left: 2px;
                transition: transform 0.2s;
            }
            .fm-fade-toggle[data-state="faded"] .fm-toggle-track { background: rgba(255,255,255,0.15); }
            .fm-fade-toggle[data-state="auto"] .fm-toggle-track { background: rgba(255,255,255,0.25); }
            .fm-fade-toggle[data-state="not-faded"] .fm-toggle-track { background: rgba(255,255,255,0.4); }
            .fm-fade-toggle[data-state="faded"] .fm-toggle-knob { transform: translateX(0); }
            .fm-fade-toggle[data-state="auto"] .fm-toggle-knob { transform: translateX(15px); }
            .fm-fade-toggle[data-state="not-faded"] .fm-toggle-knob { transform: translateX(30px); }
            .title-card:hover .fm-fade-toggle,
            [data-uia="standard-card"]:hover .fm-fade-toggle {
                opacity: 1;
                pointer-events: auto;
            }
        `;
```

- [ ] **Step 12: Write test verifying toggle CSS is injected**

Add to `tests/unit/core/overlay.test.js`:

```js
it('should include fade toggle CSS in injected styles', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    renderer.injectStyles();
    const style = document.head.querySelector('style');
    expect(style.textContent).toContain('.fm-fade-toggle');
    expect(style.textContent).toContain('.fm-toggle-track');
    expect(style.textContent).toContain('.fm-toggle-knob');
});
```

- [ ] **Step 13: Run all overlay tests**

Run: `npx vitest run tests/unit/core/overlay.test.js tests/ui/overlay.ui.test.js`
Expected: All PASS

- [ ] **Step 14: Commit**

```bash
git add src/core/config-fields.js src/core/overlay.js tests/unit/core/overlay.test.js tests/ui/overlay.ui.test.js
git commit -m "feat: add fade toggle UI rendering and simplify applyFade"
```

---

### Task 3: Integrate FadeManager into FlixMonkeyApp

**Files:**

- Modify: `src/core/app.js`
- Modify: `tests/unit/core/app.test.js`

**Interfaces:**

- Consumes: `FadeManager.getOverride(titleKey)` — from Task 1
- Consumes: `FadeManager.setOverride(titleKey, value)` — from Task 1
- Consumes: `FadeManager.shouldFade(fadeOverride, rating, fadeable)` — from Task 1
- Consumes: `FadeManager.getToggleState(fadeOverride, isRatingFaded)` — from Task 1
- Consumes: `FadeManager.nextToggleState(currentState)` — from Task 1
- Consumes: `OverlayRenderer.applyFade(container, shouldFade)` — from Task 2
- Consumes: `OverlayRenderer.injectOverlay(container, titleObj, toggleOptions)` — from Task 2
- Consumes: `ConfigManager.get('enableFadeToggle', true)` — from Task 2

- [ ] **Step 1: Update `FlixMonkeyApp` constructor and `startApp` to include `FadeManager`**

In `src/core/app.js`, add the import:

```js
import { FadeManager } from './fade-manager.js';
```

Add `#fade` and `#config` to the private fields:

```js
    #fade;
    #config;
```

Update the constructor to accept and store `FadeManager` and `ConfigManager`:

```js
    constructor(cache, api, renderer, surfaces, fade, config, logger) {
        this.#cache = cache;
        this.#api = api;
        this.#renderer = renderer;
        this.#surfaces = surfaces;
        this.#fade = fade;
        this.#config = config;
        this.#logger = logger;
```

In `startApp`, create the `FadeManager` and pass it along with `configManager`:

```js
const fade = new FadeManager(adapter, configManager);
const app = new FlixMonkeyApp(cache, api, renderer, surfaces, fade, configManager, logger);
```

- [ ] **Step 2: Update `#decorateContainer` for early fade and toggle wiring**

Replace the `#decorateContainer` method in `src/core/app.js` with:

```js
    async #decorateContainer(container, displayTitle, fadeable) {
        if (this.#renderer.hasOverlay(container) || this.#renderer.isLoading(container)) return;

        const dedupKey = displayTitle.toLowerCase();

        this.#renderer.ensureRelative(container);
        this.#renderer.injectLoadingOverlay(container);

        await new Promise(resolve => setTimeout(resolve, 0));

        const fadeOverride = await this.#fade.getOverride(dedupKey);
        this.#renderer.applyFade(container, this.#fade.shouldFade(fadeOverride, null, fadeable));

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
            if (!this.#renderer.hasOverlay(container)) {
                const isRatingFaded = this.#fade.shouldFade(null, data?.rating, fadeable);
                const shouldFade = this.#fade.shouldFade(fadeOverride, data?.rating, fadeable);

                const enableToggle = this.#config.get('enableFadeToggle', true);
                let toggleOptions = null;
                if (enableToggle) {
                    const toggleState = this.#fade.getToggleState(fadeOverride, isRatingFaded);
                    toggleOptions = {
                        state: toggleState,
                        onClick: () => this.#handleToggleClick(container, dedupKey, data, fadeable),
                    };
                }

                this.#renderer.injectOverlay(container, data, toggleOptions);
                this.#renderer.applyFade(container, shouldFade);
            }
        } finally {
            this.#renderer.removeLoadingOverlay(container);
        }
    }
```

- [ ] **Step 3: Add `#handleToggleClick` method**

Add to `FlixMonkeyApp` class in `src/core/app.js`:

```js
    async #handleToggleClick(container, dedupKey, data, fadeable) {
        const toggle = container.querySelector('.fm-fade-toggle');
        if (!toggle) return;

        const currentState = toggle.dataset.state;
        const nextState = this.#fade.nextToggleState(currentState);

        const overrideMap = { 'faded': true, 'not-faded': false, 'auto': null };
        const newOverride = overrideMap[nextState];

        await this.#fade.setOverride(dedupKey, newOverride);

        toggle.dataset.state = nextState;
        const shouldFade = this.#fade.shouldFade(newOverride, data?.rating, fadeable);
        this.#renderer.applyFade(container, shouldFade);
    }
```

- [ ] **Step 4: Update the `init()` double-call test**

In `tests/unit/core/app.test.js`, update the test that constructs `FlixMonkeyApp` directly (line 296-306). It needs the new `fade` parameter:

```js
it('should throw if init() is called twice on the same instance', () => {
    const mockRenderer = {
        injectStyles: vi.fn(),
        hasOverlay: vi.fn().mockReturnValue(false),
        isLoading: vi.fn().mockReturnValue(false),
    };
    const mockSurfaces = { discover: vi.fn().mockReturnValue([]) };
    const mockFade = {};
    const mockConfig = {};
    const app = new FlixMonkeyApp({}, {}, mockRenderer, mockSurfaces, mockFade, mockConfig, createMockLogger());
    app.init();
    expect(() => app.init()).toThrow('FlixMonkeyApp already initialised');
    app.disconnect();
});
```

- [ ] **Step 5: Write test for early fade application**

Add to `tests/unit/core/app.test.js`:

```js
it('should apply fade override before API fetch completes', async () => {
    const mockAdapter = createMockAdapter({
        configGet: key => {
            if (key === 'enableFadeToggle') return true;
            return undefined;
        },
    });
    mockAdapter.storageGet.mockImplementation(key => {
        if (key === 'fm-fade:test title') return Promise.resolve('true');
        return Promise.resolve(null);
    });

    document.body.innerHTML = `
            <div class="title-card">
                <div class="fallback-text">Test Title</div>
            </div>
        `;

    let resolveApi;
    const apiPromise = new Promise(resolve => {
        resolveApi = resolve;
    });
    vi.spyOn(ApiClientManager.prototype, 'getData').mockReturnValue(apiPromise);

    appRef = startApp(mockAdapter);
    await Promise.resolve();
    vi.runAllTimers();

    await vi.waitFor(() => {
        const card = document.querySelector('.title-card');
        expect(card.classList.contains('fm-faded')).toBe(true);
    });

    resolveApi({ rating: 9.0, imdbUrl: 'http://imdb.com' });
    await apiPromise;
    await vi.runAllTimersAsync();
});
```

- [ ] **Step 6: Write test for toggle click cycling**

Add to `tests/unit/core/app.test.js`:

```js
it('should cycle toggle state on click and update fade', async () => {
    const mockAdapter = createMockAdapter({
        configGet: key => {
            if (key === 'enableFadeToggle') return true;
            return undefined;
        },
    });

    document.body.innerHTML = `
            <div class="title-card">
                <div class="fallback-text">Toggle Movie</div>
            </div>
        `;

    vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue({
        rating: 8.0,
        imdbUrl: 'http://imdb.com',
    });

    appRef = startApp(mockAdapter);
    await Promise.resolve();
    vi.runAllTimers();

    await vi.waitFor(() => {
        const toggle = document.querySelector('.fm-fade-toggle');
        expect(toggle).not.toBeNull();
    });

    const toggle = document.querySelector('.fm-fade-toggle');
    expect(toggle.dataset.state).toBe('auto');

    toggle.click();
    await vi.runAllTimersAsync();
    expect(toggle.dataset.state).toBe('faded');
    expect(document.querySelector('.title-card').classList.contains('fm-faded')).toBe(true);
});
```

- [ ] **Step 7: Write test verifying toggle is hidden when disabled**

Add to `tests/unit/core/app.test.js`:

```js
it('should not render toggle when enableFadeToggle is false', async () => {
    const mockAdapter = createMockAdapter({
        configGet: key => {
            if (key === 'enableFadeToggle') return false;
            return undefined;
        },
    });

    document.body.innerHTML = `
            <div class="title-card">
                <div class="fallback-text">No Toggle Movie</div>
            </div>
        `;

    vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue({
        rating: 8.0,
        imdbUrl: 'http://imdb.com',
    });

    appRef = startApp(mockAdapter);
    await Promise.resolve();
    vi.runAllTimers();

    await vi.waitFor(() => {
        expect(document.querySelector('.fm-rating-overlay')).not.toBeNull();
    });

    expect(document.querySelector('.fm-fade-toggle')).toBeNull();
});
```

- [ ] **Step 8: Run all tests**

Run: `npx vitest run tests/unit tests/ui`
Expected: All PASS

- [ ] **Step 9: Commit**

```bash
git add src/core/app.js src/core/fade-manager.js tests/unit/core/app.test.js
git commit -m "feat: integrate FadeManager into app with early fade and toggle wiring"
```
