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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startApp, FlixMonkeyApp } from '../../../src/core/app.js';
import { ApiClientManager } from '../../../src/core/api-manager.js';
import { SurfaceManager } from '../../../src/core/surfaces.js';
import { DECORATION_DEBOUNCE_MS } from '../../../src/core/constants.js';

describe('App', () => {
    let mockMutationObserverInstance;
    const ActualMutationObserver = global.MutationObserver;

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '';

        // Patch MutationObserver to allow manual triggering of callbacks in tests
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
        vi.useRealTimers();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        global.MutationObserver = ActualMutationObserver;
        FlixMonkeyApp.resetInternalState();
    });

    it('should initialize and hold state', () => {
        const mockAdapter = {
            storageGet: vi.fn().mockResolvedValue({}),
            storageSet: vi.fn(),
            httpFetch: vi.fn(),
        };
        const { api, cache } = startApp(mockAdapter);
        expect(api).toBeDefined();
        expect(cache).toBeDefined();
        expect(window.fmApi).toBe(api);
    });

    it('should discover titles in JSDOM', () => {
        document.body.innerHTML = `
        <div class="title-card">
            <div class="fallback-text">Movie Title</div>
        </div>
    `;
        const surfaces = new SurfaceManager();
        const results = surfaces.discover(document);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Movie Title');
    });

    it('should deduplicate in-flight requests for the same title', async () => {
        const mockAdapter = { storageGet: vi.fn().mockResolvedValue(null), storageSet: vi.fn(), httpFetch: vi.fn() };

        // Initialize DOM with multiple containers sharing the same title
        document.body.innerHTML = `
        <div id="container">
            <div class="title-card" id="card1"><div class="fallback-text">Shared Title</div></div>
            <div class="title-card" id="card2"><div class="fallback-text">Shared Title</div></div>
        </div>
    `;

        const getDataSpy = vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue({ apiTitle: 'Resolved' });

        startApp(mockAdapter);

        await vi.waitFor(() => {
            if (getDataSpy.mock.calls.length === 0) throw new Error('Not called yet');
        });

        // Verify that concurrent discoveries are deduplicated into a single API/cache lookup
        expect(getDataSpy.mock.calls.length).toBeLessThanOrEqual(1);

        // Verify that subsequent discoveries while a request is in-flight do not trigger new lookups
        window.history.pushState({}, '', '/new');
        vi.advanceTimersByTime(DECORATION_DEBOUNCE_MS + 100);

        await Promise.resolve();
        expect(getDataSpy.mock.calls.length).toBeLessThanOrEqual(2);
        getDataSpy.mockRestore();
    });

    it('should debounce navigation events', async () => {
        const mockAdapter = { storageGet: vi.fn().mockResolvedValue({}), storageSet: vi.fn(), httpFetch: vi.fn() };

        document.body.innerHTML = `
        <div class="title-card">
            <div class="fallback-text">Test</div>
        </div>
    `;
        const spy = vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue({ apiTitle: 'Test' });

        startApp(mockAdapter);
        await Promise.resolve();
        spy.mockClear();

        // Change DOM to ensure a new card is discovered upon navigation
        document.body.innerHTML = `
        <div class="title-card">
            <div class="fallback-text">New Test</div>
        </div>
    `;

        window.history.pushState({}, '', '/new-page');
        expect(spy).not.toHaveBeenCalled();

        window.history.pushState({}, '', '/another-page');
        expect(spy).not.toHaveBeenCalled();

        vi.advanceTimersByTime(5000);
        await vi.waitFor(
            () => {
                if (spy.mock.calls.length === 0) throw new Error('Not called');
            },
            { timeout: 2000 }
        );
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('should respond to DOM mutations', async () => {
        const mockAdapter = { storageGet: vi.fn().mockResolvedValue({}), storageSet: vi.fn(), httpFetch: vi.fn() };
        const spy = vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue({ apiTitle: 'Test' });

        startApp(mockAdapter);
        await Promise.resolve();
        spy.mockClear();

        const container = document.createElement('div');
        container.innerHTML = `
        <div class="title-card">
            <div class="fallback-text">New Movie</div>
        </div>
    `;
        document.body.appendChild(container);

        mockMutationObserverInstance.trigger([
            {
                addedNodes: [container],
            },
        ]);

        await vi.waitFor(() => {
            if (spy.mock.calls.length === 0) throw new Error('Not called');
        });
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('should trigger new decoration when a container is replaced', async () => {
        const mockAdapter = { storageGet: vi.fn().mockResolvedValue(null), storageSet: vi.fn(), httpFetch: vi.fn() };
        const spy = vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue({ apiTitle: 'Test' });

        document.body.innerHTML = `
            <div class="title-card">
                <div class="fallback-text">Original Title</div>
            </div>
        `;

        startApp(mockAdapter);
        await vi.waitFor(() => {
            if (spy.mock.calls.length < 1) throw new Error('Not called yet');
        });
        expect(spy).toHaveBeenCalledTimes(1);

        // Simulate replacement of container
        document.body.innerHTML = `
            <div class="title-card">
                <div class="fallback-text">Original Title</div>
            </div>
        `;

        mockMutationObserverInstance.trigger([
            {
                addedNodes: [document.querySelector('.title-card')],
            },
        ]);

        await vi.waitFor(() => {
            if (spy.mock.calls.length < 2) throw new Error('Not called second time');
        });

        expect(spy).toHaveBeenCalledTimes(2);
        spy.mockRestore();
    });

    it('should inject loading overlay while fetching', async () => {
        const mockAdapter = {
            storageGet: vi.fn().mockResolvedValue(null),
            storageSet: vi.fn(),
            httpFetch: vi.fn(),
            configGet: vi.fn().mockReturnValue(null),
        };

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

        startApp(mockAdapter);

        // Wait for the next tick to allow the app to initialize and call decorateRoot
        await Promise.resolve();
        vi.runAllTimers();

        const card = document.querySelector('.title-card');
        expect(card.querySelector('.fm-loading')).not.toBeNull();

        resolveApi({ apiTitle: 'Test Title' });
        await apiPromise;

        // Give it a moment to finish processing
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(card.querySelector('.fm-loading')).toBeNull();
        expect(card.querySelector('.fm-rating-overlay')).not.toBeNull();
    });
});
