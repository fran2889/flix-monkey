# Manual Fade Toggle — Complete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-title 3-state fade toggle (faded / auto / not-faded) that lets users override automatic fade behavior, with persistent storage. The toggle lives exclusively in the bob popup and is always visible there.

**Architecture:** Four layers: `FadeManager` owns override storage and all fade decisions; `OverlayRenderer` gains toggle DOM and CSS; `SurfaceManager` gains a `showToggle` property so only the bob surface renders the toggle; `FlixMonkeyApp` orchestrates early fade, toggle wiring, `data-fm-dedup-key` stamping on fadeable containers, and sibling fade updates when the bob toggle is clicked.

**Tech Stack:** JavaScript ES2022 (ES modules, `#private` fields), Vitest + jsdom

## Global Constraints

- ES modules with `import`/`export` everywhere
- Private fields use `#field` syntax
- Every new file starts with the GPL-3.0 license header
- Conventional Commits enforced by commitlint
- Test runner: `npm run test:unit` (Vitest)
- All business logic must have test coverage
- No new dependencies

---

### Task 1: FadeManager — override storage and fade decision logic

**Files:**

- Create: `src/core/fade-manager.js`
- Create: `tests/unit/core/fade-manager.test.js`

**Interfaces:**

- Consumes: `PlatformAdapter.storageGet(key)`, `.storageSet(key, value)`, `.storageDelete(key)`; `ConfigManager.get(key, fallback)`, `.getFloat(key, fallback)`
- Produces: `FadeManager.getOverride(titleKey) → Promise<true|false|null>`
- Produces: `FadeManager.setOverride(titleKey, value) → Promise<void>`
- Produces: `FadeManager.shouldFade(fadeOverride, rating, fadeable) → boolean`
- Produces: `FadeManager.getToggleState(fadeOverride, isRatingFaded) → 'faded'|'auto'|'not-faded'`
- Produces: `FadeManager.nextToggleState(currentState) → 'faded'|'auto'|'not-faded'`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/core/fade-manager.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
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
            expect(await fade.getOverride('some-movie')).toBe(true);
            expect(adapter.storageGet).toHaveBeenCalledWith('fm-fade:some-movie');
        });

        it('should return false when stored value is "false"', async () => {
            adapter.storageGet.mockResolvedValue('false');
            expect(await fade.getOverride('some-movie')).toBe(false);
        });

        it('should return null when no stored value', async () => {
            adapter.storageGet.mockResolvedValue(null);
            expect(await fade.getOverride('some-movie')).toBeNull();
        });

        it('should return null when stored value is undefined', async () => {
            adapter.storageGet.mockResolvedValue(undefined);
            expect(await fade.getOverride('some-movie')).toBeNull();
        });
    });

    describe('setOverride', () => {
        it('should store "true" for fade override', async () => {
            await fade.setOverride('some-movie', true);
            expect(adapter.storageSet).toHaveBeenCalledWith('fm-fade:some-movie', 'true');
        });

        it('should store "false" for not-faded override', async () => {
            await fade.setOverride('some-movie', false);
            expect(adapter.storageSet).toHaveBeenCalledWith('fm-fade:some-movie', 'false');
        });

        it('should delete key for null (auto)', async () => {
            await fade.setOverride('some-movie', null);
            expect(adapter.storageDelete).toHaveBeenCalledWith('fm-fade:some-movie');
        });
    });

    describe('shouldFade', () => {
        it('should return true when fadeable, override is true, and toggle enabled', () => {
            const cfg = new ConfigManager(
                createMockAdapter({ configGet: key => (key === 'enableFadeToggle' ? true : undefined) })
            );
            expect(new FadeManager(createMockAdapter(), cfg).shouldFade(true, 9.0, true)).toBe(true);
        });

        it('should return false when fadeable, override is false, and toggle enabled', () => {
            const cfg = new ConfigManager(
                createMockAdapter({ configGet: key => (key === 'enableFadeToggle' ? true : undefined) })
            );
            expect(new FadeManager(createMockAdapter(), cfg).shouldFade(false, 3.0, true)).toBe(false);
        });

        it('should ignore override when not fadeable', () => {
            const cfg = new ConfigManager(
                createMockAdapter({ configGet: key => (key === 'enableFadeToggle' ? true : undefined) })
            );
            // fadeable=false means the override branch is skipped entirely
            expect(new FadeManager(createMockAdapter(), cfg).shouldFade(true, 9.0, false)).toBe(false);
        });

        it('should ignore override when toggle disabled, fall back to rating logic', () => {
            const cfg = new ConfigManager(
                createMockAdapter({
                    configGet: key => {
                        if (key === 'enableFadeToggle') return false;
                        if (key === 'enableFadeUnderRating') return true;
                        if (key === 'fadeRatingThreshold') return 6.0;
                        return undefined;
                    },
                })
            );
            expect(new FadeManager(createMockAdapter(), cfg).shouldFade(false, 3.0, true)).toBe(true);
        });

        it('should fall back to rating logic when override is null', () => {
            const cfg = new ConfigManager(
                createMockAdapter({
                    configGet: key => {
                        if (key === 'enableFadeUnderRating') return true;
                        if (key === 'fadeRatingThreshold') return 6.0;
                        return undefined;
                    },
                })
            );
            const fm = new FadeManager(createMockAdapter(), cfg);
            expect(fm.shouldFade(null, 5.0, true)).toBe(true);
            expect(fm.shouldFade(null, 7.0, true)).toBe(false);
        });

        it('should return false when not fadeable and no override', () => {
            const cfg = new ConfigManager(
                createMockAdapter({
                    configGet: key => {
                        if (key === 'enableFadeUnderRating') return true;
                        if (key === 'fadeRatingThreshold') return 6.0;
                        return undefined;
                    },
                })
            );
            expect(new FadeManager(createMockAdapter(), cfg).shouldFade(null, 3.0, false)).toBe(false);
        });

        it('should return false when rating auto-fade is disabled and no override', () => {
            const cfg = new ConfigManager(
                createMockAdapter({ configGet: key => (key === 'enableFadeUnderRating' ? false : undefined) })
            );
            expect(new FadeManager(createMockAdapter(), cfg).shouldFade(null, 3.0, true)).toBe(false);
        });

        it('should return false when rating is null and no override', () => {
            const cfg = new ConfigManager(
                createMockAdapter({
                    configGet: key => {
                        if (key === 'enableFadeUnderRating') return true;
                        if (key === 'fadeRatingThreshold') return 6.0;
                        return undefined;
                    },
                })
            );
            expect(new FadeManager(createMockAdapter(), cfg).shouldFade(null, null, true)).toBe(false);
        });
    });

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
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm run test:unit -- tests/unit/core/fade-manager.test.js
```

Expected: FAIL — module `fade-manager.js` does not exist

- [ ] **Step 3: Implement FadeManager**

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

    async setOverride(titleKey, value) {
        const key = `${this.#prefix}${titleKey}`;
        if (value === null) {
            await this.#adapter.storageDelete(key);
        } else {
            await this.#adapter.storageSet(key, String(value));
        }
    }

    shouldFade(fadeOverride, rating, fadeable) {
        if (fadeable && this.#config.get('enableFadeToggle', true) && fadeOverride !== null) {
            return fadeOverride;
        }
        if (fadeable && this.#config.get('enableFadeUnderRating', false)) {
            return typeof rating === 'number' && rating < this.#config.getFloat('fadeRatingThreshold', 6.0);
        }
        return false;
    }

    getToggleState(fadeOverride, isRatingFaded) {
        if (fadeOverride === true) return 'faded';
        if (fadeOverride === false) return 'not-faded';
        return isRatingFaded ? 'faded' : 'auto';
    }

    nextToggleState(currentState) {
        const cycle = { faded: 'not-faded', 'not-faded': 'auto', auto: 'faded' };
        return cycle[currentState];
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm run test:unit -- tests/unit/core/fade-manager.test.js
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/fade-manager.js tests/unit/core/fade-manager.test.js
git commit -m "feat: add FadeManager for per-title fade overrides"
```

---

### Task 2: Config field and surface `showToggle` property

**Files:**

- Modify: `src/core/config-fields.js`
- Modify: `src/core/surfaces.js`
- Modify: `tests/unit/core/surfaces.test.js`

**Interfaces:**

- Produces: `enableFadeToggle` config key (boolean, default `true`)
- Produces: each surface object carries `showToggle: boolean`; `SurfaceManager.discover()` returns `{ container, title, fadeable, showToggle }` per result; only the bob surface has `showToggle: true`

- [ ] **Step 1: Add the config field**

In `src/core/config-fields.js`, add after the `fadeRatingThreshold` field:

```js
{
    key: 'enableFadeToggle',
    label: 'Show fade toggle',
    type: 'checkbox',
    default: true,
    title: 'Show per-title fade override toggle in the bob popup.',
    row: 'fade-toggle-settings',
},
```

- [ ] **Step 2: Verify config tests still pass**

```
npm run test:unit -- tests/unit/core/config-fields.test.js
```

Expected: PASS — the `it.each(CONFIG_FIELDS)` tests automatically cover the new field's structure

- [ ] **Step 3: Write failing surface tests**

In `tests/unit/core/surfaces.test.js`, add `showToggle` assertions to the existing surface `it` blocks:

```js
// in "should discover title card surfaces"
expect(results[0].showToggle).toBe(false);

// in "should discover search video card surfaces"
expect(results[0].showToggle).toBe(false);

// in "should discover bob container surfaces"
expect(results[0].showToggle).toBe(true);
```

Inside both `.each` table callbacks (`describe('previewModal fallback selectors')` and `describe('jawBone / detail-view fallback selectors')`), add:

```js
expect(results[0].showToggle).toBe(false);
```

- [ ] **Step 4: Run surface tests to verify they fail**

```
npm run test:unit -- tests/unit/core/surfaces.test.js
```

Expected: FAIL — `undefined` is not `false` / `true`

- [ ] **Step 5: Add `showToggle` to all surface definitions in `src/core/surfaces.js`**

Replace the `#SURFACES` array with:

```js
#SURFACES = [
    {
        titleSelectors: '.title-card .fallback-text',
        getTitle: el => el.textContent?.trim() ?? null,
        containerSel: '.title-card',
        fadeable: true,
        showToggle: false,
    },
    {
        titleSelectors: '[data-uia="standard-card"]',
        getTitle: el => el.getAttribute('aria-label')?.trim() ?? null,
        containerSel: '[data-uia="standard-card"]',
        fadeable: true,
        showToggle: false,
    },
    {
        titleSelectors: '.bob-title',
        getTitle: el => el.textContent?.trim() ?? null,
        containerSel: '.bob-container',
        fadeable: false,
        showToggle: true,
    },
    {
        titleSelectors: [
            '.previewModal--player-titleTreatmentWrapper img[alt]',
            '.previewModal--player_container img[alt]',
            '[data-uia="previewModal-title"]',
            '.previewModal--boxarttitle',
        ].join(','),
        getTitle: el => el.getAttribute('alt')?.trim() ?? el.textContent?.trim() ?? null,
        containerSel: '.previewModal--player_container',
        fadeable: false,
        showToggle: false,
    },
    {
        titleSelectors: [
            '.jawBone img[alt]',
            '.jawBoneContainer img[alt]',
            '.previewModal--detailsMetadata img[alt]',
            '.jawBone .image-fallback-text',
            '.jawBoneContainer .image-fallback-text',
            '.previewModal--detailsMetadata h3',
            '.previewModal--detailsMetadata .title',
            '.previewModal--detailsMetadata [data-uia="previewModal-title"]',
        ].join(','),
        getTitle: el => el.getAttribute('alt')?.trim() ?? el.textContent?.trim() ?? null,
        containerSel: '.jawBone, .jawBoneContainer, .previewModal--detailsMetadata',
        fadeable: false,
        showToggle: false,
    },
];
```

Also update the `discover()` return to include `showToggle`:

```js
results.push({ container, title, fadeable: surface.fadeable ?? false, showToggle: surface.showToggle ?? false });
```

- [ ] **Step 6: Run tests to verify they pass**

```
npm run test:unit -- tests/unit/core/surfaces.test.js
```

Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add src/core/config-fields.js src/core/surfaces.js tests/unit/core/surfaces.test.js
git commit -m "feat: add enableFadeToggle config field and showToggle surface property"
```

---

### Task 3: OverlayRenderer — toggle DOM and CSS

**Files:**

- Modify: `src/core/overlay.js`
- Modify: `tests/unit/core/overlay.test.js`
- Modify: `tests/ui/overlay.ui.test.js`

**Interfaces:**

- Consumes: `toggleOptions: { state: 'faded'|'auto'|'not-faded', onClick: Function } | null`
- Produces: `OverlayRenderer.applyFade(container, shouldFade: boolean) → void` — simplified, boolean only
- Produces: `OverlayRenderer.injectOverlay(container, titleObj, toggleOptions)` — appends toggle when `toggleOptions` is non-null

- [ ] **Step 1: Write failing tests for simplified `applyFade`**

In `tests/ui/overlay.ui.test.js`, replace the existing `applyFade` tests with:

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

- [ ] **Step 2: Write failing tests for toggle rendering and CSS**

Add to `tests/ui/overlay.ui.test.js`:

```js
it('should render fade toggle when toggleOptions provided', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    const container = document.createElement('div');
    renderer.injectOverlay(container, { rating: 7.0, imdbUrl: 'http://imdb.com' }, { state: 'auto', onClick: vi.fn() });
    const toggle = container.querySelector('.fm-fade-toggle');
    expect(toggle).not.toBeNull();
    expect(toggle.dataset.state).toBe('auto');
});

it('should not render fade toggle when toggleOptions is null', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    const container = document.createElement('div');
    renderer.injectOverlay(container, { rating: 7.0, imdbUrl: 'http://imdb.com' }, null);
    expect(container.querySelector('.fm-fade-toggle')).toBeNull();
});

it('should call onClick when toggle is clicked', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    const container = document.createElement('div');
    const onClick = vi.fn();
    renderer.injectOverlay(container, { rating: 7.0, imdbUrl: 'http://imdb.com' }, { state: 'auto', onClick });
    container.querySelector('.fm-fade-toggle').click();
    expect(onClick).toHaveBeenCalled();
});

it('should stop propagation on toggle click', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    const container = document.createElement('div');
    renderer.injectOverlay(
        container,
        { rating: 7.0, imdbUrl: 'http://imdb.com' },
        { state: 'faded', onClick: vi.fn() }
    );
    const toggle = container.querySelector('.fm-fade-toggle');
    const event = new MouseEvent('click', { bubbles: true });
    const spy = vi.spyOn(event, 'stopPropagation');
    toggle.dispatchEvent(event);
    expect(spy).toHaveBeenCalled();
});

it('should render toggle with correct data-state for each state', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    for (const state of ['faded', 'auto', 'not-faded']) {
        const container = document.createElement('div');
        renderer.injectOverlay(container, { rating: 7.0, imdbUrl: 'http://imdb.com' }, { state, onClick: vi.fn() });
        expect(container.querySelector('.fm-fade-toggle').dataset.state).toBe(state);
    }
});
```

Add to `tests/unit/core/overlay.test.js`:

```js
it('should include fade toggle CSS in injected styles', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    renderer.injectStyles();
    const css = document.head.querySelector('#fm-overlay-styles').textContent;
    expect(css).toContain('.fm-fade-toggle');
    expect(css).toContain('.fm-toggle-track');
    expect(css).toContain('.fm-toggle-knob');
});

it('should not include hover-visibility rules for title-card or standard-card', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    renderer.injectStyles();
    const css = document.head.querySelector('#fm-overlay-styles').textContent;
    expect(css).not.toContain('.title-card:hover .fm-fade-toggle');
    expect(css).not.toContain('[data-uia="standard-card"]:hover .fm-fade-toggle');
});

it('should not default the toggle to opacity 0', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    renderer.injectStyles();
    const css = document.head.querySelector('#fm-overlay-styles').textContent;
    expect(css).not.toMatch(/fm-fade-toggle[^{]*\{[^}]*opacity:\s*0/);
});

it('should render toggle track at 41px wide by 15px tall', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    renderer.injectStyles();
    const css = document.head.querySelector('#fm-overlay-styles').textContent;
    expect(css).toContain('width: 41px');
    expect(css).toContain('height: 15px');
});

it('should render toggle knob at 12px square', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    renderer.injectStyles();
    const css = document.head.querySelector('#fm-overlay-styles').textContent;
    expect(css).toContain('width: 12px');
    expect(css).toContain('height: 12px');
});

it('should include red X icon for faded state and green checkmark for not-faded', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    renderer.injectStyles();
    const css = document.head.querySelector('#fm-overlay-styles').textContent;
    expect(css).toContain('✕');
    expect(css).toContain('#e53935');
    expect(css).toContain('✓');
    expect(css).toContain('#43a047');
});

it('should not include per-state track background color rules', () => {
    const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
    renderer.injectStyles();
    const css = document.head.querySelector('#fm-overlay-styles').textContent;
    expect(css).not.toContain('[data-state="faded"] .fm-toggle-track');
    expect(css).not.toContain('[data-state="not-faded"] .fm-toggle-track');
    expect(css).not.toContain('[data-state="auto"] .fm-toggle-track');
});
```

- [ ] **Step 3: Run tests to verify they fail**

```
npm run test:unit -- tests/unit/core/overlay.test.js tests/ui/overlay.ui.test.js
```

Expected: new tests FAIL; existing tests pass

- [ ] **Step 4: Simplify `applyFade` in `src/core/overlay.js`**

Replace the `applyFade` method with:

```js
applyFade(container, shouldFade) {
    container.classList.toggle('fm-faded', shouldFade);
}
```

- [ ] **Step 5: Add `#createFadeToggle` private method to `src/core/overlay.js`**

Add before `#createOverlay`:

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

    let clicking = false;
    toggle.addEventListener('click', async e => {
        e.stopPropagation();
        if (clicking) return;
        clicking = true;
        try {
            await onClick();
        } finally {
            clicking = false;
        }
    });

    return toggle;
}
```

- [ ] **Step 6: Update `#createOverlay` and `injectOverlay` to accept `toggleOptions`**

Change `#createOverlay` signature to `#createOverlay(titleObj, toggleOptions = null)` and add before `return container;` at the end:

```js
if (toggleOptions) {
    container.appendChild(this.#createFadeToggle(toggleOptions.state, toggleOptions.onClick));
}
```

Change `injectOverlay` signature to `injectOverlay(container, titleObj, toggleOptions = null)` and update the body to pass `toggleOptions`:

```js
injectOverlay(container, titleObj, toggleOptions = null) {
    container.querySelector(`.${this.#OVERLAY_CLASS}`)?.remove();
    container.appendChild(this.#createOverlay(titleObj, toggleOptions));
    container.setAttribute(this.#OVERLAY_ATTR, '1');
}
```

- [ ] **Step 7: Replace the toggle CSS block in `injectStyles`**

Find the block that starts with the `.fm-fade-toggle` rule (added after `.fm-faded:hover`) and replace it entirely with:

```js
cssText += `
    .fm-fade-toggle {
        cursor: pointer;
        padding: 0;
        background: transparent !important;
    }
    .fm-fade-toggle:hover {
        background: transparent !important;
    }
    .fm-toggle-track {
        width: 41px;
        height: 15px;
        border-radius: 8px;
        background: rgba(255,255,255,0.25);
        position: relative;
    }
    .fm-toggle-knob {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #fff;
        position: absolute;
        top: 1.5px;
        left: 2px;
        transition: transform 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 8px;
        line-height: 1;
    }
    .fm-fade-toggle[data-state="faded"] .fm-toggle-knob { transform: translateX(0); }
    .fm-fade-toggle[data-state="auto"] .fm-toggle-knob { transform: translateX(12px); }
    .fm-fade-toggle[data-state="not-faded"] .fm-toggle-knob { transform: translateX(25px); }
    .fm-fade-toggle[data-state="faded"] .fm-toggle-knob::after {
        content: '✕';
        color: #e53935;
    }
    .fm-fade-toggle[data-state="not-faded"] .fm-toggle-knob::after {
        content: '✓';
        color: #43a047;
    }
`;
```

Note: no `opacity: 0`, no hover-visibility selectors, no per-state track background rules. The toggle is always visible when rendered (the bob popup is itself only visible on hover).

- [ ] **Step 8: Run all overlay tests**

```
npm run test:unit -- tests/unit/core/overlay.test.js tests/ui/overlay.ui.test.js
```

Expected: all PASS

- [ ] **Step 9: Commit**

```bash
git add src/core/overlay.js tests/unit/core/overlay.test.js tests/ui/overlay.ui.test.js
git commit -m "feat: add toggle rendering and updated CSS to OverlayRenderer"
```

---

### Task 4: FlixMonkeyApp — full integration

**Files:**

- Modify: `src/core/app.js`
- Modify: `tests/unit/core/app.test.js`

**Interfaces:**

- Consumes: `SurfaceManager.discover()` → `{ container, title, fadeable, showToggle }` (Task 2)
- Consumes: `FadeManager.*` (Task 1)
- Consumes: `OverlayRenderer.applyFade(container, boolean)`, `.injectOverlay(container, titleObj, toggleOptions)` (Task 3)
- Consumes: `slugify(displayTitle)` from `./utils.js` (already imported) — produces the dedup key used for storage and the `data-fm-dedup-key` attribute

**Key behaviours:**

1. `FadeManager` and `ConfigManager` injected via constructor; `startApp` creates them
2. `#decorateContainer` gains `showToggle = false` fourth param; toggle only rendered when `showToggle && enableFadeToggle`
3. Early fade applied only when `fadeOverride !== null` (avoids clobbering rating-fade state on re-decoration)
4. `isRatingFaded` uses `showToggle || fadeable` so bob toggle correctly reflects rating-fade for its sibling title-cards
5. `data-fm-dedup-key` attribute stamped on fadeable containers after `injectOverlay`
6. Toggle click in bob queries `[data-fm-dedup-key="${dedupKey}"]` and re-fades all matching title-cards

- [ ] **Step 1: Write failing tests**

In `tests/unit/core/app.test.js`, add these new tests and **replace** the two existing tests noted below:

**Replace** `'should cycle toggle state on click and update fade'` with:

```js
it('should render toggle in bob and update title-card fade on click', async () => {
    const mockAdapter = createMockAdapter({
        configGet: key => (key === 'enableFadeToggle' ? true : undefined),
    });
    document.body.innerHTML = `
        <div class="bob-container">
            <div class="bob-title">Toggle Movie</div>
        </div>
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
        expect(document.querySelector('.bob-container .fm-fade-toggle')).not.toBeNull();
    });

    const toggle = document.querySelector('.bob-container .fm-fade-toggle');
    expect(toggle.dataset.state).toBe('auto');
    expect(document.querySelector('.title-card .fm-fade-toggle')).toBeNull();

    toggle.click();
    await vi.runAllTimersAsync();

    expect(toggle.dataset.state).toBe('faded');
    expect(document.querySelector('.title-card').classList.contains('fm-faded')).toBe(true);
});
```

**Replace** `'should not render toggle when enableFadeToggle is false'` with:

```js
it('should not render toggle in bob when enableFadeToggle is false', async () => {
    const mockAdapter = createMockAdapter({
        configGet: key => (key === 'enableFadeToggle' ? false : undefined),
    });
    document.body.innerHTML = `
        <div class="bob-container">
            <div class="bob-title">No Toggle Movie</div>
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

**Add** these new tests:

```js
it('should not render toggle on title-card even when enableFadeToggle is true', async () => {
    const mockAdapter = createMockAdapter({
        configGet: key => (key === 'enableFadeToggle' ? true : undefined),
    });
    document.body.innerHTML = `
        <div class="title-card">
            <div class="fallback-text">No Toggle Here</div>
        </div>
    `;
    vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue({
        rating: 7.0,
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

it('should stamp data-fm-dedup-key on decorated title-card containers', async () => {
    document.body.innerHTML = `
        <div class="title-card">
            <div class="fallback-text">Stamp Test</div>
        </div>
    `;
    vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue({
        rating: 7.0,
        imdbUrl: 'http://imdb.com',
    });

    appRef = startApp(createMockAdapter());
    await Promise.resolve();
    vi.runAllTimers();

    await vi.waitFor(() => {
        const card = document.querySelector('.title-card');
        expect(card.dataset.fmDedupKey).toBe('stamp_test');
    });
});

it('should initialise bob toggle at faded state when title is rating-faded', async () => {
    const mockAdapter = createMockAdapter({
        configGet: key => {
            if (key === 'enableFadeToggle') return true;
            if (key === 'enableFadeUnderRating') return true;
            if (key === 'fadeRatingThreshold') return 6.0;
            return undefined;
        },
    });
    document.body.innerHTML = `
        <div class="bob-container">
            <div class="bob-title">Bad Movie</div>
        </div>
    `;
    vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue({
        rating: 4.5,
        imdbUrl: 'http://imdb.com',
    });

    appRef = startApp(mockAdapter);
    await Promise.resolve();
    vi.runAllTimers();

    await vi.waitFor(() => {
        expect(document.querySelector('.bob-container .fm-fade-toggle')).not.toBeNull();
    });

    expect(document.querySelector('.bob-container .fm-fade-toggle').dataset.state).toBe('faded');
});
```

Also **update** the existing `'should apply fade override before API fetch completes'` test — the storage key must use the slugified title (underscores, not spaces):

```js
it('should apply fade override before API fetch completes', async () => {
    const mockAdapter = createMockAdapter({
        configGet: key => {
            if (key === 'enableFadeToggle') return true;
            return undefined;
        },
    });
    mockAdapter.storageGet.mockImplementation(key => {
        if (key === 'fm-fade:test_title') return Promise.resolve('true');
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

- [ ] **Step 2: Run tests to verify expected failures**

```
npm run test:unit -- tests/unit/core/app.test.js
```

Expected: new tests FAIL; most existing tests pass

- [ ] **Step 3: Add import and update constructor/startApp in `src/core/app.js`**

Add import:

```js
import { FadeManager } from './fade-manager.js';
```

Add private fields `#fade` and `#config`. Update constructor signature to `constructor(cache, api, renderer, surfaces, fade, config, logger)` and assign them. In `startApp`, add:

```js
const fade = new FadeManager(adapter, configManager);
const app = new FlixMonkeyApp(cache, api, renderer, surfaces, fade, configManager, logger);
```

- [ ] **Step 4: Replace `#decorateContainer` in `src/core/app.js`**

```js
async #decorateContainer(container, displayTitle, fadeable, showToggle = false) {
    if (this.#renderer.hasOverlay(container) || this.#renderer.isLoading(container)) return;

    const dedupKey = slugify(displayTitle);

    this.#renderer.ensureRelative(container);
    this.#renderer.injectLoadingOverlay(container);

    await new Promise(resolve => setTimeout(resolve, 0));

    const fadeOverride = await this.#fade.getOverride(dedupKey);
    if (fadeOverride !== null) {
        this.#renderer.applyFade(container, this.#fade.shouldFade(fadeOverride, null, fadeable));
    }

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
            const isRatingFaded = this.#fade.shouldFade(null, data?.rating, showToggle || fadeable);
            const shouldFade = this.#fade.shouldFade(fadeOverride, data?.rating, fadeable);

            const enableToggle = showToggle && this.#config.get('enableFadeToggle', true);
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
            if (fadeable) {
                container.dataset.fmDedupKey = dedupKey;
            }
        }
    } finally {
        this.#renderer.removeLoadingOverlay(container);
    }
}
```

Notes on key decisions:

- `isRatingFaded` uses `showToggle || fadeable`: for bob (`showToggle=true, fadeable=false`) this is `true`, ensuring a low-rated title's bob toggle correctly starts at 'faded'
- Early fade guard `if (fadeOverride !== null)` avoids clobbering rating-fade state on re-decoration
- `data-fm-dedup-key` stamped only on `fadeable` containers (title-cards); the bob queries this attribute to find siblings

- [ ] **Step 5: Add `#handleToggleClick` method in `src/core/app.js`**

```js
async #handleToggleClick(container, dedupKey, data, fadeable) {
    const toggle = container.querySelector('.fm-fade-toggle');
    if (!toggle) return;

    const currentState = toggle.dataset.state;
    const nextState = this.#fade.nextToggleState(currentState);

    const overrideMap = { faded: true, 'not-faded': false, auto: null };
    const newOverride = overrideMap[nextState];

    await this.#fade.setOverride(dedupKey, newOverride);

    toggle.dataset.state = nextState;
    const shouldFade = this.#fade.shouldFade(newOverride, data?.rating, fadeable);
    this.#renderer.applyFade(container, shouldFade);
    const siblingFade = this.#fade.shouldFade(newOverride, data?.rating, true);
    document.querySelectorAll(`[data-fm-dedup-key="${dedupKey}"]`).forEach(sibling => {
        this.#renderer.applyFade(sibling, siblingFade);
    });
}
```

`siblingFade` passes `fadeable: true` unconditionally — `data-fm-dedup-key` is only stamped on fadeable containers, so every queried node is fadeable.

- [ ] **Step 6: Update `decorateRoot` to pass `showToggle`**

```js
decorateRoot(root) {
    this.#surfaces.discover(root).forEach(({ container, title, fadeable, showToggle = false }) => {
        this.#decorateContainer(container, title, fadeable, showToggle).catch(err =>
            this.#logger.error('Failed to decorate container', err)
        );
    });
}
```

- [ ] **Step 7: Run all tests**

```
npm run test
```

Expected: all PASS

- [ ] **Step 8: Commit**

```bash
git add src/core/app.js tests/unit/core/app.test.js
git commit -m "feat: integrate FadeManager and fade toggle into FlixMonkeyApp"
```

---

## Not in scope

- Toggle on browse thumbnails (title-card / standard-card)
- Toggle on preview modal or jawBone
- Bulk management UI for viewing/clearing all overrides
- Exporting/importing overrides
- Override by IMDb ID (trade-off: title slug is the existing dedup key)
- Live sibling update when a title-card hasn't finished decorating yet (the `data-fm-dedup-key` attribute is stamped after the API resolves; clicking the bob toggle before that completes won't re-fade undecorated siblings — an accepted limitation)
