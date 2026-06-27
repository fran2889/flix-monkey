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
import { Logger } from '../../../src/core/logger.js';
import { OverlayRenderer } from '../../../src/core/overlay.js';
import { createMockAdapter } from '../../mocks/adapter.js';
import { createMockLogger } from '../../mocks/logger.js';

describe('App', () => {
    let mockMutationObserverInstance;
    let appRef = null;
    const ActualMutationObserver = global.MutationObserver;

    beforeEach(() => {
        appRef = null;
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
        appRef?.disconnect();
        vi.useRealTimers();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        global.MutationObserver = ActualMutationObserver;
    });

    it('should initialize and hold state', () => {
        const mockAdapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue({}) });
        appRef = startApp(mockAdapter);
        expect(appRef.clearCache).toBeDefined();
        expect(appRef.resetDisabledClients).toBeDefined();
    });

    it('should discover titles in JSDOM', () => {
        document.body.innerHTML = `
        <div class="title-card">
            <div class="fallback-text">Movie Title</div>
        </div>
    `;
        const surfaces = new SurfaceManager(createMockLogger());
        const results = surfaces.discover(document);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Movie Title');
    });

    it('should deduplicate in-flight requests for the same title', async () => {
        const mockAdapter = createMockAdapter();

        // Initialize DOM with multiple containers sharing the same title
        document.body.innerHTML = `
        <div id="container">
            <div class="title-card" id="card1"><div class="fallback-text">Shared Title</div></div>
            <div class="title-card" id="card2"><div class="fallback-text">Shared Title</div></div>
        </div>
    `;

        const getDataSpy = vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue({ apiTitle: 'Resolved' });

        appRef = startApp(mockAdapter);

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
        const mockAdapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue({}) });

        document.body.innerHTML = `
        <div class="title-card">
            <div class="fallback-text">Test</div>
        </div>
    `;
        const spy = vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue({ apiTitle: 'Test' });

        appRef = startApp(mockAdapter);
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
        const mockAdapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue({}) });
        const spy = vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue({ apiTitle: 'Test' });

        appRef = startApp(mockAdapter);
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
        const mockAdapter = createMockAdapter();
        const spy = vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue({ apiTitle: 'Test' });

        document.body.innerHTML = `
            <div class="title-card">
                <div class="fallback-text">Original Title</div>
            </div>
        `;

        appRef = startApp(mockAdapter);
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
        const mockAdapter = createMockAdapter({ configGet: vi.fn().mockReturnValue(null) });

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

        // Wait for the next tick to allow the app to initialize and call decorateRoot
        await Promise.resolve();
        vi.runAllTimers();

        const card = document.querySelector('.title-card');
        expect(card.querySelector('.fm-loading')).not.toBeNull();

        resolveApi({ apiTitle: 'Test Title' });
        await apiPromise;

        // Wait for the app to finish processing and update the UI
        await vi.waitFor(() => {
            expect(card.querySelector('.fm-loading')).toBeNull();
        });

        expect(card.querySelector('.fm-rating-overlay')).not.toBeNull();
    });

    it('should remove the loading overlay when getData rejects', async () => {
        const mockAdapter = createMockAdapter({ configGet: vi.fn().mockReturnValue(null) });

        document.body.innerHTML = `
        <div class="title-card">
            <div class="fallback-text">Failing Title</div>
        </div>
    `;

        vi.spyOn(ApiClientManager.prototype, 'getData').mockRejectedValue(new Error('API failure'));

        appRef = startApp(mockAdapter);

        await Promise.resolve();
        vi.runAllTimers();

        const card = document.querySelector('.title-card');
        await vi.waitFor(() => {
            expect(card.querySelector('.fm-loading')).toBeNull();
        });
    });

    it('should trigger decoration on replaceState', async () => {
        const mockAdapter = createMockAdapter();
        const getDataSpy = vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue({ apiTitle: 'Test' });

        appRef = startApp(mockAdapter);

        // Initial decoration from init()
        vi.advanceTimersByTime(DECORATION_DEBOUNCE_MS + 100);
        await vi.runAllTimersAsync();

        const callCountAfterInit = getDataSpy.mock.calls.length;

        // Add a NEW title card so it's not skipped by the "already has overlay" check
        document.body.innerHTML += `
            <div class="title-card" id="new-card">
                <div class="fallback-text">New Title</div>
            </div>
        `;

        window.history.replaceState({}, '', '/replaced');
        vi.advanceTimersByTime(DECORATION_DEBOUNCE_MS + 100);
        await vi.runAllTimersAsync();

        expect(getDataSpy.mock.calls.length).toBeGreaterThan(callCountAfterInit);
    });

    it('should throw if init() is called twice on the same instance', () => {
        const mockRenderer = {
            injectStyles: vi.fn(),
            hasOverlay: vi.fn().mockReturnValue(false),
            isLoading: vi.fn().mockReturnValue(false),
        };
        const mockSurfaces = { discover: vi.fn().mockReturnValue([]) };
        const app = new FlixMonkeyApp({}, {}, mockRenderer, mockSurfaces, createMockLogger());
        app.init();
        expect(() => app.init()).toThrow('FlixMonkeyApp already initialised');
        app.disconnect();
    });

    it('should expose cacheManager and disabledManager on the startApp return value', () => {
        appRef = startApp(createMockAdapter());
        expect(appRef.cacheManager).toBeDefined();
        expect(typeof appRef.cacheManager.clear).toBe('function');
        expect(appRef.disabledManager).toBeDefined();
        expect(typeof appRef.disabledManager.resetAll).toBe('function');
    });

    it('should catch and log errors thrown in the mutation handler', () => {
        const mockAdapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue({}) });
        const logSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

        appRef = startApp(mockAdapter);

        // addedNodes: null causes Array.from(null) to throw inside the handler
        expect(() => {
            mockMutationObserverInstance.trigger([{ addedNodes: null }]);
        }).not.toThrow();

        expect(logSpy).toHaveBeenCalledWith('Mutation observer error', expect.any(Error));
    });

    it('should log errors thrown by decorateContainer rather than propagating them', async () => {
        document.body.innerHTML = `
            <div class="title-card">
                <div class="fallback-text">Boom Movie</div>
            </div>
        `;
        const logSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
        vi.spyOn(ApiClientManager.prototype, 'getData').mockRejectedValue(new Error('boom'));

        appRef = startApp(createMockAdapter());

        await Promise.resolve();
        vi.runAllTimers();
        await vi.runAllTimersAsync();

        await vi.waitFor(
            () => {
                expect(logSpy).toHaveBeenCalledWith('Failed to decorate container', expect.any(Error));
            },
            { timeout: 2000 }
        );
        logSpy.mockRestore();
    });

    it('should remove inFlight entry and log error if API call hangs past timeout', async () => {
        document.body.innerHTML = `
            <div class="title-card">
                <div class="fallback-text">Hanging Film</div>
            </div>
        `;
        const logSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
        vi.spyOn(ApiClientManager.prototype, 'getData').mockReturnValue(new Promise(() => {})); // never resolves

        appRef = startApp(createMockAdapter());
        await Promise.resolve();
        vi.runAllTimers();

        // Advance past INFLIGHT_TIMEOUT_MS (30000ms)
        await vi.advanceTimersByTimeAsync(31_000);

        expect(logSpy).toHaveBeenCalledWith('Failed to decorate container', expect.any(Error));
        logSpy.mockRestore();
    });

    it('should disconnect the MutationObserver when disconnect() is called', () => {
        const mockAdapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue({}) });
        appRef = startApp(mockAdapter);

        const disconnectSpy = vi.spyOn(mockMutationObserverInstance, 'disconnect');
        appRef.disconnect();
        expect(disconnectSpy).toHaveBeenCalled();
    });

    it('should call decorateRoot on mutation target rather than full document when nodes are added', async () => {
        const parent = document.createElement('div');
        document.body.appendChild(parent);

        appRef = startApp(createMockAdapter());
        await Promise.resolve();

        const discoverSpy = vi.spyOn(SurfaceManager.prototype, 'discover').mockReturnValue([]);

        // Trigger mutation on parent, with target set
        mockMutationObserverInstance.trigger([{ addedNodes: [parent], target: parent }]);

        vi.advanceTimersByTime(DECORATION_DEBOUNCE_MS + 100);
        await vi.runAllTimersAsync();

        // discover should be called with parent, not document
        const roots = discoverSpy.mock.calls.map(c => c[0]);
        expect(roots.some(r => r === parent)).toBe(true);

        discoverSpy.mockRestore();
    });

    it('should deduplicate in-flight requests for titles that differ only by punctuation', async () => {
        const mockAdapter = createMockAdapter();
        document.body.innerHTML = `
            <div id="container">
                <div class="title-card" id="card1"><div class="fallback-text">Test: Movie</div></div>
                <div class="title-card" id="card2"><div class="fallback-text">Test Movie</div></div>
            </div>
        `;
        const getDataSpy = vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue({
            apiTitle: 'Test Movie',
            rating: 7.0,
        });
        appRef = startApp(mockAdapter);
        await vi.waitFor(() => {
            if (getDataSpy.mock.calls.length === 0) throw new Error('Not called yet');
        });
        expect(getDataSpy.mock.calls.length).toBeLessThanOrEqual(1);
        getDataSpy.mockRestore();
    });

    it('should not inject overlay when container is removed from DOM before data resolves', async () => {
        const container = document.createElement('div');
        container.className = 'title-card';
        container.innerHTML = '<div class="fallback-text">Detach Test</div>';
        document.body.appendChild(container);

        let resolveData;
        vi.spyOn(ApiClientManager.prototype, 'getData').mockReturnValue(
            new Promise(resolve => {
                resolveData = resolve;
            })
        );
        const injectSpy = vi.spyOn(OverlayRenderer.prototype, 'injectOverlay');

        appRef = startApp(createMockAdapter());

        // Advance fake timers so the setTimeout(resolve, 0) yield in #decorateContainer fires,
        // moving execution past the yield and into the getData await
        vi.advanceTimersByTime(1);
        await Promise.resolve();
        await Promise.resolve();

        // Detach the container before the data resolves
        document.body.removeChild(container);

        // Now resolve the data — document.contains(container) is now false
        resolveData({ apiTitle: 'Detach Test', rating: 7.0 });
        await Promise.resolve();
        await Promise.resolve();

        expect(injectSpy).not.toHaveBeenCalled();
        injectSpy.mockRestore();
    });
});
