# Quick Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply six independent sets of targeted fixes across the codebase, each delivered as its own PR.

**Architecture:** Each task maps to a single PR. PRs are independent except PR 5 (overlay) which uses a constant added in PR 4 — merge PR 4 first or add `TOP_10_BADGE` directly in PR 5 if merging out of order.

**Tech Stack:** JavaScript ES2022, Vitest, existing `logger` singleton from `src/core/logger.js`.

---

## File Map

| File                                           | PRs that touch it |
| ---------------------------------------------- | ----------------- |
| `src/core/app.js`                              | PR 1              |
| `src/core/api-clients.js`                      | PR 2              |
| `src/core/cache.js`                            | PR 3              |
| `src/core/title.js`                            | PR 3              |
| `src/core/constants.js`                        | PR 4, PR 5        |
| `src/core/surfaces.js`                         | PR 4              |
| `src/core/overlay.js`                          | PR 5              |
| `src/core/ui/settings-ui.js`                   | PR 5              |
| `src/targets/extension/fetch-proxy.js` _(new)_ | PR 6              |
| `src/targets/firefox/background.js`            | PR 6              |
| `src/targets/chrome/service-worker.js`         | PR 6              |
| `tests/unit/core/app.test.js`                  | PR 1              |
| `tests/unit/core/api-clients.test.js`          | PR 2              |
| `tests/unit/core/cache.test.js`                | PR 3              |
| `tests/unit/core/title.test.js`                | PR 3              |
| `tests/unit/core/surfaces.test.js`             | PR 4              |
| `tests/ui/overlay.ui.test.js`                  | PR 5              |
| `tests/unit/core/ui/settings-ui.test.js`       | PR 5              |

---

## PR 1 — `app.js` robustness

### Task 1: Store observer reference, add `disconnect()`, wire to `beforeunload` and `startApp`

**Files:**

- Modify: `src/core/app.js`

- [ ] **Step 1: Add private fields and `disconnect()` method**

    In `src/core/app.js`, add `#observer = null` and `#initialised = false` to the field declarations, and add the `disconnect()` method to the class body:

    ```js
    // Field declarations (add alongside existing fields at top of class):
    #observer = null;
    #initialised = false;

    // New method — add after the constructor:
    disconnect() {
        this.#observer?.disconnect();
        this.#observer = null;
    }
    ```

- [ ] **Step 2: Store observer reference and wrap handler in try/catch**

    In `#initNavigationObservers()`, replace the local `observer` variable with `this.#observer` and wrap the handler body in try/catch:

    ```js
    this.#observer = new MutationObserver(mutations => {
        try {
            const hasElements = mutations.some(m =>
                Array.from(m.addedNodes).some(n => n.nodeType === Node.ELEMENT_NODE)
            );
            if (hasElements) this.#debouncedDecorate();
        } catch (err) {
            logger.error('Mutation handler error', err);
        }
    });
    this.#observer.observe(document.body, { childList: true, subtree: true });
    ```

- [ ] **Step 3: Guard `init()` and wire `beforeunload`**

    Replace the existing `init()` body:

    ```js
    init() {
        if (this.#initialised) throw new Error('FlixMonkeyApp already initialised');
        this.#initialised = true;
        this.#renderer.injectStyles();
        this.#initNavigationObservers();
        this.decorateRoot(document);
        window.addEventListener('beforeunload', () => this.disconnect());
    }
    ```

- [ ] **Step 4: Expose `disconnect` from `startApp()`**

    In `startApp()`, add `disconnect` to the returned object:

    ```js
    return {
        clearCache: () => app.clearCache(),
        resetDisabledClients: () => app.resetDisabledClients(),
        disconnect: () => app.disconnect(),
    };
    ```

### Task 2: Update tests for PR 1

**Files:**

- Modify: `tests/unit/core/app.test.js`

- [ ] **Step 1: Add `appRef` to track app instance across tests**

    Add `let appRef = null;` to the `describe` block scope (alongside `mockMutationObserverInstance`). In `beforeEach`, reset it to `null`. In `afterEach`, call `appRef?.disconnect()` before `FlixMonkeyApp.resetInternalState()`. In every test that calls `startApp(...)`, assign the return value to `appRef`.

    The `describe` block header and lifecycle hooks become:

    ```js
    describe('App', () => {
        let mockMutationObserverInstance;
        let appRef;
        const ActualMutationObserver = global.MutationObserver;

        beforeEach(() => {
            appRef = null;
            vi.useFakeTimers();
            document.body.innerHTML = '';
            global.MutationObserver = class extends ActualMutationObserver {
                constructor(callback) {
                    super(callback);
                    this.callback = callback;
                    mockMutationObserverInstance = this;
                }
                trigger(mutations) {
                    this.callback(mutations);
                }
            };
        });

        afterEach(() => {
            appRef?.disconnect();
            vi.useRealTimers();
            vi.restoreAllMocks();
            document.body.innerHTML = '';
            global.MutationObserver = ActualMutationObserver;
            FlixMonkeyApp.resetInternalState();
        });
    ```

    Then update every call to `startApp(...)` in the test bodies to assign to `appRef`:

    ```js
    // Before:
    startApp(mockAdapter);
    // After:
    appRef = startApp(mockAdapter);
    ```

    ```js
    // Before:
    const app = startApp(mockAdapter);
    // After:
    appRef = startApp(mockAdapter);
    // (replace any use of `app` with `appRef`)
    ```

- [ ] **Step 2: Add test — `init()` throws on double-call**

    ```js
    it('should throw if init() is called twice on the same instance', () => {
        const mockRenderer = {
            injectStyles: vi.fn(),
            hasOverlay: vi.fn().mockReturnValue(false),
            isLoading: vi.fn().mockReturnValue(false),
        };
        const mockSurfaces = { discover: vi.fn().mockReturnValue([]) };
        const app = new FlixMonkeyApp({}, {}, mockRenderer, mockSurfaces);
        app.init();
        expect(() => app.init()).toThrow('FlixMonkeyApp already initialised');
        app.disconnect();
    });
    ```

- [ ] **Step 3: Add `logger` import to `app.test.js`**

    Add to the import block at the top of `tests/unit/core/app.test.js`:

    ```js
    import { logger } from '../../../src/core/logger.js';
    ```

- [ ] **Step 4: Add test — mutation handler errors are caught**

    ```js
    it('should catch and log errors thrown in the mutation handler', () => {
        const mockAdapter = { storageGet: vi.fn().mockResolvedValue({}), storageSet: vi.fn(), httpFetch: vi.fn() };
        const logSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

        appRef = startApp(mockAdapter);

        // addedNodes: null causes Array.from(null) to throw inside the handler
        expect(() => {
            mockMutationObserverInstance.trigger([{ addedNodes: null }]);
        }).not.toThrow();

        expect(logSpy).toHaveBeenCalledWith('Mutation handler error', expect.any(Error));
    });
    ```

    Add `import { logger } from '../../../src/core/logger.js';` to the imports at the top of the test file.

- [ ] **Step 5: Add test — `disconnect()` disconnects the observer**

    ```js
    it('should disconnect the MutationObserver when disconnect() is called', () => {
        const mockAdapter = { storageGet: vi.fn().mockResolvedValue({}), storageSet: vi.fn(), httpFetch: vi.fn() };
        appRef = startApp(mockAdapter);

        const disconnectSpy = vi.spyOn(mockMutationObserverInstance, 'disconnect');
        appRef.disconnect();
        expect(disconnectSpy).toHaveBeenCalled();
    });
    ```

- [ ] **Step 6: Run tests**

    ```bash
    npx vitest run tests/unit/core/app.test.js
    ```

    Expected: all tests pass.

- [ ] **Step 7: Commit**

    ```bash
    git add src/core/app.js tests/unit/core/app.test.js
    git commit -m "$(cat <<'EOF'
    fix(app): store observer reference, add disconnect(), guard init() against double-call
    EOF
    )"
    ```

---

## PR 2 — API error normalization

### Task 3: Safe status access in `queuedFetch`

**Files:**

- Modify: `src/core/api-clients.js`
- Modify: `tests/unit/core/api-clients.test.js`

- [ ] **Step 1: Write failing test**

    In `tests/unit/core/api-clients.test.js`, inside `describe('BaseApiClient (via XmdbApiClient)')`, add:

    ```js
    it('should NOT disable itself on a network error with no status property', async () => {
        const error = new Error('Network failure');
        // Deliberately no .status property

        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockRejectedValueOnce(error),
        });
        const mockDisabledManager = {
            isDisabled: vi.fn().mockResolvedValue(false),
            disable: vi.fn().mockResolvedValue(undefined),
        };

        const client = new XmdbApiClient(mockDisabledManager, mockAdapter, { get: _k => 'key' });

        await expect(client.queuedFetch('url1')).rejects.toThrow('Network failure');
        expect(mockDisabledManager.disable).not.toHaveBeenCalled();
    });
    ```

- [ ] **Step 2: Run test to confirm it fails**

    ```bash
    npx vitest run tests/unit/core/api-clients.test.js -t "should NOT disable itself on a network error"
    ```

    Expected: FAIL — `disable` is unexpectedly called because `undefined >= 400` is `false`, so actually this test may already pass. Run it to confirm the current behaviour before changing anything.

- [ ] **Step 3: Apply the fix**

    In `src/core/api-clients.js`, in the `catch` block of `queuedFetch` (around line 77), replace:

    ```js
    if (err.status >= 400 && err.status < 500) await this.disable();
    ```

    with:

    ```js
    const status = err?.status;
    if (status >= 400 && status < 500) await this.disable();
    ```

- [ ] **Step 4: Run all api-clients tests**

    ```bash
    npx vitest run tests/unit/core/api-clients.test.js
    ```

    Expected: all pass.

- [ ] **Step 5: Commit**

    ```bash
    git add src/core/api-clients.js tests/unit/core/api-clients.test.js
    git commit -m "$(cat <<'EOF'
    fix(api-clients): guard against missing status on network errors in queuedFetch
    EOF
    )"
    ```

---

## PR 3 — Cache robustness

### Task 4: Log warning on JSON.parse failure and validate `Title.fromJSON`

**Files:**

- Modify: `src/core/cache.js`
- Modify: `src/core/title.js`
- Modify: `tests/unit/core/cache.test.js`
- Modify: `tests/unit/core/title.test.js`

- [ ] **Step 1: Update cache test to assert warning is logged**

    In `tests/unit/core/cache.test.js`, add `import { logger } from '../../../src/core/logger.js';` to the imports. Then find the existing test `'should return null when JSON parsing fails in read'` and replace it:

    ```js
    it('should return null and log a warning when JSON parsing fails in read', async () => {
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
        adapter.storageGet.mockResolvedValue('invalid-json{');

        const result = await cacheManager.read('Some Title');

        expect(result).toBeNull();
        expect(warnSpy).toHaveBeenCalledWith('Cache entry corrupt, treating as miss', { key: 'fmc:some_title' });
        warnSpy.mockRestore();
    });
    ```

- [ ] **Step 2: Run updated test to confirm it fails**

    ```bash
    npx vitest run tests/unit/core/cache.test.js -t "should return null and log a warning"
    ```

    Expected: FAIL — `warnSpy` is not called.

- [ ] **Step 3: Add warning to `cache.js`**

    In `src/core/cache.js`, in the `catch` block of `read()` (around line 60), replace:

    ```js
    } catch {
        return null;
    }
    ```

    with:

    ```js
    } catch {
        logger.warn('Cache entry corrupt, treating as miss', { key });
        return null;
    }
    ```

- [ ] **Step 4: Run cache tests**

    ```bash
    npx vitest run tests/unit/core/cache.test.js
    ```

    Expected: all pass.

- [ ] **Step 5: Add failing test for `Title.fromJSON` validation**

    In `tests/unit/core/title.test.js`, inside `describe('fromJSON creation')`, add:

    ```js
    it('should return null for non-object input', () => {
        expect(Title.fromJSON(null)).toBeNull();
        expect(Title.fromJSON('string')).toBeNull();
        expect(Title.fromJSON(42)).toBeNull();
    });
    ```

- [ ] **Step 6: Run to confirm it fails**

    ```bash
    npx vitest run tests/unit/core/title.test.js -t "should return null for non-object input"
    ```

    Expected: FAIL — currently `Title.fromJSON(null)` returns `new Title({})` (not null).

- [ ] **Step 7: Add guard to `Title.fromJSON`**

    In `src/core/title.js`, replace:

    ```js
    static fromJSON(obj) {
        return new Title(obj ?? {});
    }
    ```

    with:

    ```js
    static fromJSON(obj) {
        if (!obj || typeof obj !== 'object') return null;
        return new Title(obj);
    }
    ```

- [ ] **Step 8: Run all title and cache tests**

    ```bash
    npx vitest run tests/unit/core/title.test.js tests/unit/core/cache.test.js
    ```

    Expected: all pass.

- [ ] **Step 9: Commit**

    ```bash
    git add src/core/cache.js src/core/title.js tests/unit/core/cache.test.js tests/unit/core/title.test.js
    git commit -m "$(cat <<'EOF'
    fix(cache): log warning on corrupt cache entry; validate Title.fromJSON input
    EOF
    )"
    ```

---

## PR 4 — Surface discovery

### Task 5: `TOP_10_BADGE` constant, fallback warning, priority docs

**Files:**

- Modify: `src/core/constants.js`
- Modify: `src/core/surfaces.js`
- Modify: `tests/unit/core/surfaces.test.js`

- [ ] **Step 1: Add `TOP_10_BADGE` to `constants.js`**

    In `src/core/constants.js`, append at the end of the file:

    ```js
    export const TOP_10_BADGE = 'title-card-top-10';
    ```

- [ ] **Step 2: Update surfaces test to assert fallback warning is logged**

    In `tests/unit/core/surfaces.test.js`, add `import { logger } from '../../../src/core/logger.js';` to the imports. Then find the existing test `'should fall back to parent element if container selector not found'` and extend it to also verify the log:

    ```js
    it('should fall back to parent element if container selector not found', () => {
        const debugSpy = vi.spyOn(logger, 'debug').mockImplementation(() => {});
        const surfaces = new SurfaceManager();
        document.body.innerHTML = `
            <div class="not-a-container">
                <div class="bob-title">Orphan Title</div>
            </div>
        `;
        const results = surfaces.discover(document.body);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Orphan Title');
        expect(results[0].container.className).toBe('not-a-container');
        expect(debugSpy).toHaveBeenCalledWith('Surface container selector failed, falling back to parentElement', {
            selector: '.bob-container',
        });
        debugSpy.mockRestore();
    });
    ```

- [ ] **Step 3: Run to confirm test fails**

    ```bash
    npx vitest run tests/unit/core/surfaces.test.js -t "should fall back to parent element"
    ```

    Expected: FAIL — debug log is not emitted yet.

- [ ] **Step 4: Add fallback warning to `surfaces.js`**

    In `src/core/surfaces.js`, add `import { logger } from './logger.js';` at the top (after the license header). Then in `discover()`, replace the line:

    ```js
    const container = titleEl.closest(surface.containerSel) ?? titleEl.parentElement;
    ```

    with:

    ```js
    let container = titleEl.closest(surface.containerSel);
    if (!container) {
        logger.debug('Surface container selector failed, falling back to parentElement', {
            selector: surface.containerSel,
        });
        container = titleEl.parentElement;
    }
    ```

- [ ] **Step 5: Add priority comment above `#SURFACES`**

    In `src/core/surfaces.js`, add a comment block immediately above the `#SURFACES = [` line:

    ```js
    // Surface priority order: title-card → search → bob → previewModal → jawBone.
    // A container matched by an earlier surface is added to `seen` and skipped by
    // all later surfaces, so declaration order determines which definition "wins".
    #SURFACES = [
    ```

- [ ] **Step 6: Run all surfaces tests**

    ```bash
    npx vitest run tests/unit/core/surfaces.test.js
    ```

    Expected: all pass.

- [ ] **Step 7: Commit**

    ```bash
    git add src/core/constants.js src/core/surfaces.js tests/unit/core/surfaces.test.js
    git commit -m "$(cat <<'EOF'
    fix(surfaces): log debug warning on container selector fallback; add TOP_10_BADGE constant
    EOF
    )"
    ```

---

## PR 5 — UI polish

### Task 6: Overlay — instance-level `#stylesInjected` and `TOP_10_BADGE` in CSS

**Files:**

- Modify: `src/core/overlay.js`
- Modify: `src/core/app.js`
- Modify: `tests/ui/overlay.ui.test.js`

- [ ] **Step 1: Add failing test for independent style injection per instance**

    In `tests/ui/overlay.ui.test.js`, add a new test inside the `describe` block:

    ```js
    it('should inject styles independently for each renderer instance', () => {
        const config = new ConfigManager();
        const renderer1 = new OverlayRenderer(config);
        const renderer2 = new OverlayRenderer(config);
        renderer1.injectStyles();
        renderer2.injectStyles();
        expect(document.head.querySelectorAll('style')).toHaveLength(2);
    });
    ```

- [ ] **Step 2: Run to confirm test fails**

    ```bash
    npx vitest run tests/ui/overlay.ui.test.js -t "should inject styles independently"
    ```

    Expected: FAIL — static field means the second `injectStyles()` is skipped, only one `<style>` element is created.

- [ ] **Step 3: Change `#stylesInjected` to instance-level in `overlay.js`**

    Replace the static field declaration:

    ```js
    static #stylesInjected = false;
    ```

    with an instance field:

    ```js
    #stylesInjected = false;
    ```

    Replace the two references inside `injectStyles()`:

    ```js
    // Before:
    if (OverlayRenderer.#stylesInjected) return;
    OverlayRenderer.#stylesInjected = true;

    // After:
    if (this.#stylesInjected) return;
    this.#stylesInjected = true;
    ```

    Remove the `static resetInternalState()` method entirely from `OverlayRenderer`:

    ```js
    // Delete this entire method:
    /** @internal for testing only */
    static resetInternalState() {
        OverlayRenderer.#stylesInjected = false;
    }
    ```

- [ ] **Step 4: Use `TOP_10_BADGE` constant in CSS template**

    Add the import at the top of `src/core/overlay.js`:

    ```js
    import { TOP_10_BADGE } from './constants.js';
    ```

    In `injectStyles()`, replace the hardcoded class reference:

    ```js
    // Before:
    cssText += `\n            .title-card-top-10 .${this.#OVERLAY_CLASS} { left: calc(50% + 6px); }`;

    // After:
    cssText += `\n            .${TOP_10_BADGE} .${this.#OVERLAY_CLASS} { left: calc(50% + 6px); }`;
    ```

- [ ] **Step 5: Remove `OverlayRenderer.resetInternalState()` call from `app.js`**

    In `src/core/app.js`, in `FlixMonkeyApp.resetInternalState()`, remove the call:

    ```js
    // Before:
    static resetInternalState() {
        FlixMonkeyApp.#isNavigationPatched = false;
        history.pushState = FlixMonkeyApp.#originalPushState;
        history.replaceState = FlixMonkeyApp.#originalReplaceState;
        OverlayRenderer.resetInternalState();
    }

    // After:
    static resetInternalState() {
        FlixMonkeyApp.#isNavigationPatched = false;
        history.pushState = FlixMonkeyApp.#originalPushState;
        history.replaceState = FlixMonkeyApp.#originalReplaceState;
    }
    ```

    The `OverlayRenderer` import in `app.js` must stay — `startApp()` still uses it to construct `new OverlayRenderer(configManager)`.

- [ ] **Step 6: Update `overlay.ui.test.js` `beforeEach`**

    Remove the `OverlayRenderer.resetInternalState()` call — it no longer exists. The `document.head.innerHTML = ''` already handles cleanup:

    ```js
    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        // OverlayRenderer.resetInternalState() — removed, no longer needed
    });
    ```

- [ ] **Step 7: Run all overlay and app tests**

    ```bash
    npx vitest run tests/ui/overlay.ui.test.js tests/unit/core/app.test.js
    ```

    Expected: all pass.

- [ ] **Step 8: Commit**

    ```bash
    git add src/core/overlay.js src/core/app.js tests/ui/overlay.ui.test.js
    git commit -m "$(cat <<'EOF'
    fix(overlay): make stylesInjected instance-level; use TOP_10_BADGE constant in CSS
    EOF
    )"
    ```

### Task 7: Settings UI — `replaceChildren()` and Save button guard

**Files:**

- Modify: `src/core/ui/settings-ui.js`
- Modify: `tests/unit/core/ui/settings-ui.test.js`

- [ ] **Step 1: Add failing test for Save button disabled during write**

    In `tests/unit/core/ui/settings-ui.test.js`, add:

    ```js
    it('should disable the save button while saving and re-enable it after', async () => {
        let resolveStorage;
        mockAdapter.storageSetMany = vi.fn().mockReturnValue(
            new Promise(resolve => {
                resolveStorage = resolve;
            })
        );

        await settingsUI.render(container);
        const saveBtn = container.querySelector('#fm-saveBtn');

        const savePromise = settingsUI.save();

        expect(saveBtn.disabled).toBe(true);

        resolveStorage();
        await savePromise;

        expect(saveBtn.disabled).toBe(false);
    });
    ```

- [ ] **Step 2: Run to confirm test fails**

    ```bash
    npx vitest run tests/unit/core/ui/settings-ui.test.js -t "should disable the save button"
    ```

    Expected: FAIL — button is never disabled.

- [ ] **Step 3: Apply `replaceChildren()` and save button guard in `settings-ui.js`**

    Replace `container.innerHTML = ''` (line 37) with:

    ```js
    container.replaceChildren();
    ```

    Replace the `save()` method body with:

    ```js
    async save() {
        const isValid = this._validate();
        const statusDiv = document.getElementById('fm-status');

        if (!isValid) {
            statusDiv.textContent = 'Please fix errors before saving.';
            statusDiv.style.color = 'red';
            return;
        }

        const values = {};
        this.fields.forEach(field => {
            const input = document.getElementById(`fm-${field.key}`);
            if (field.type === 'checkbox') {
                values[field.key] = input.checked;
            } else {
                values[field.key] = input.value;
            }
        });

        const saveBtn = document.getElementById('fm-saveBtn');
        saveBtn.disabled = true;
        try {
            await this.adapter.storageSetMany(values);
            statusDiv.textContent = 'Saved!';
            statusDiv.style.color = 'green';
        } finally {
            saveBtn.disabled = false;
        }
    }
    ```

- [ ] **Step 4: Run all settings-ui tests**

    ```bash
    npx vitest run tests/unit/core/ui/settings-ui.test.js
    ```

    Expected: all pass.

- [ ] **Step 5: Commit**

    ```bash
    git add src/core/ui/settings-ui.js tests/unit/core/ui/settings-ui.test.js
    git commit -m "$(cat <<'EOF'
    fix(settings-ui): replace innerHTML clear with replaceChildren; disable save button during write
    EOF
    )"
    ```

---

## PR 6 — DRY background scripts

### Task 8: Extract shared fetch proxy

**Files:**

- Create: `src/targets/extension/fetch-proxy.js`
- Modify: `src/targets/firefox/background.js`
- Modify: `src/targets/chrome/service-worker.js`

- [ ] **Step 1: Create `fetch-proxy.js`**

    Create `src/targets/extension/fetch-proxy.js` with the full fetch handler extracted from both background files:

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
    import { validateDomain } from './domains.js';
    import { DEFAULT_FETCH_TIMEOUT } from '../../core/constants.js';

    export async function handleFetchMessage(url, options = {}) {
        const validation = validateDomain(url);
        if (!validation.valid) {
            return { error: validation.error };
        }

        const { responseType = 'json', timeout = DEFAULT_FETCH_TIMEOUT } = options;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const res = await fetch(url, {
                signal: controller.signal,
                headers: { 'Accept-Language': 'en-US,en;q=0.9' },
            });
            clearTimeout(timeoutId);
            if (!res.ok) return { error: `HTTP ${res.status}`, status: res.status };
            const data = responseType === 'json' ? await res.json() : await res.text();
            return { data };
        } catch (err) {
            clearTimeout(timeoutId);
            return { error: err.message };
        }
    }
    ```

- [ ] **Step 2: Slim down `background.js`**

    Replace the entire contents of `src/targets/firefox/background.js` with:

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
    import { handleFetchMessage } from '../extension/fetch-proxy.js';

    // Firefox-only background script.
    // Uses bare 'browser' global available in Firefox's non-bundled background environment.
    browser.runtime.onMessage.addListener(async msg => {
        if (msg.type !== 'FM_FETCH') return;
        const { url, options = {} } = msg;
        return handleFetchMessage(url, options);
    });

    browser.action.onClicked.addListener(() => {
        browser.runtime.openOptionsPage();
    });
    ```

- [ ] **Step 3: Slim down `service-worker.js`**

    Replace the entire contents of `src/targets/chrome/service-worker.js` with:

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
    import { handleFetchMessage } from '../extension/fetch-proxy.js';

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg.type !== 'FM_FETCH') return false;
        const { url, options = {} } = msg;
        handleFetchMessage(url, options).then(sendResponse);
        return true; // keep message channel open for async sendResponse
    });

    chrome.action.onClicked.addListener(() => {
        chrome.runtime.openOptionsPage();
    });
    ```

- [ ] **Step 4: Run all background and service-worker tests**

    ```bash
    npx vitest run tests/unit/targets/firefox/background.test.js tests/unit/targets/chrome/service-worker.test.js
    ```

    Expected: all pass. The tests use `vi.resetModules()` and mock `global.fetch` / `global.AbortController`, which `fetch-proxy.js` uses — the mock chain still works.

- [ ] **Step 5: Run full test suite**

    ```bash
    npm test
    ```

    Expected: all tests pass, coverage thresholds met.

- [ ] **Step 6: Commit**

    ```bash
    git add src/targets/extension/fetch-proxy.js src/targets/firefox/background.js src/targets/chrome/service-worker.js
    git commit -m "$(cat <<'EOF'
    refactor(background): extract shared fetch proxy into fetch-proxy.js
    EOF
    )"
    ```
