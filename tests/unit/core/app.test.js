/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClientManager } from '../../../src/core/api-manager.js';
import { FlixMonkeyApp, startApp } from '../../../src/core/app.js';
import { DECORATION_DEBOUNCE_MS } from '../../../src/core/constants.js';
import { Logger } from '../../../src/core/logger.js';
import { OverlayRenderer } from '../../../src/core/overlay.js';
import { NetflixService } from '../../../src/core/services/index.js';
import { NetflixSurfaceManager, SurfaceManager } from '../../../src/core/surfaces/index.js';
import { buildMockAdapter } from '../../mocks/adapter.js';
import { buildLogger } from '../../mocks/logger.js';
import { buildTitle } from '../../mocks/title.js';

describe('App', () => {
    let mockMutationObserverInstance;
    let appRef = null;
    const ActualMutationObserver = global.MutationObserver;

    beforeEach(async () => {
        appRef = null;
        vi.useFakeTimers();
        document.body.innerHTML = '';

        const { ServiceRegistry } = await import('../../../src/core/services/index.js');
        vi.spyOn(ServiceRegistry, 'detect').mockReturnValue(new NetflixService());

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
        // The app tears itself down on unload; that listener is the only path to #disconnect.
        window.dispatchEvent(new Event('beforeunload'));
        vi.useRealTimers();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        global.MutationObserver = ActualMutationObserver;
    });

    it('should initialize and hold state', () => {
        const mockAdapter = buildMockAdapter().withStorageGetResolvingTo({}).build();
        appRef = startApp(mockAdapter);
        expect(appRef).toBeInstanceOf(FlixMonkeyApp);
        expect(typeof appRef.redecorate).toBe('function');
    });

    it('should discover titles in JSDOM', () => {
        document.body.innerHTML = `
        <div class="title-card">
            <a aria-label="Movie Title"></a>
        </div>
    `;
        const surfaces = new NetflixSurfaceManager(buildLogger().build());
        const results = surfaces.discover(document);
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Movie Title');
    });

    it('should deduplicate in-flight requests for the same title', async () => {
        const mockAdapter = buildMockAdapter().build();

        // Initialize DOM with multiple containers sharing the same title
        document.body.innerHTML = `
        <div id="container">
            <div class="title-card" id="card1"><a aria-label="Shared Title"></a></div>
            <div class="title-card" id="card2"><a aria-label="Shared Title"></a></div>
        </div>
    `;

        const getDataSpy = vi
            .spyOn(ApiClientManager.prototype, 'getData')
            .mockResolvedValue(buildTitle().withApiTitle('Resolved').build());

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
        const mockAdapter = buildMockAdapter().withStorageGetResolvingTo({}).build();

        document.body.innerHTML = `
        <div class="title-card">
            <a aria-label="Test"></a>
        </div>
    `;
        const spy = vi
            .spyOn(ApiClientManager.prototype, 'getData')
            .mockResolvedValue(buildTitle().withApiTitle('Test').build());

        appRef = startApp(mockAdapter);
        await Promise.resolve();
        spy.mockClear();

        // Change DOM to ensure a new card is discovered upon navigation
        document.body.innerHTML = `
        <div class="title-card">
            <a aria-label="New Test"></a>
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
        const mockAdapter = buildMockAdapter().withStorageGetResolvingTo({}).build();
        const spy = vi
            .spyOn(ApiClientManager.prototype, 'getData')
            .mockResolvedValue(buildTitle().withApiTitle('Test').build());

        appRef = startApp(mockAdapter);
        await Promise.resolve();
        spy.mockClear();

        const container = document.createElement('div');
        container.innerHTML = `
        <div class="title-card">
            <a aria-label="New Movie"></a>
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
        const mockAdapter = buildMockAdapter().build();
        const spy = vi
            .spyOn(ApiClientManager.prototype, 'getData')
            .mockResolvedValue(buildTitle().withApiTitle('Test').build());

        document.body.innerHTML = `
            <div class="title-card">
                <a aria-label="Original Title"></a>
            </div>
        `;

        appRef = startApp(mockAdapter);
        await vi.waitFor(() => {
            if (spy.mock.calls.length < 1) throw new Error('Not called yet');
        });
        expect(spy).toHaveBeenCalledTimes(1);

        document.body.innerHTML = `
            <div class="title-card">
                <a aria-label="Original Title"></a>
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
        const mockAdapter = buildMockAdapter().withConfigGetReturning(null).build();

        document.body.innerHTML = `
        <div class="title-card">
            <a aria-label="Test Title"></a>
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
        const mockAdapter = buildMockAdapter().withConfigGetReturning(null).build();

        document.body.innerHTML = `
        <div class="title-card">
            <a aria-label="Failing Title"></a>
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
        const mockAdapter = buildMockAdapter().build();
        const getDataSpy = vi
            .spyOn(ApiClientManager.prototype, 'getData')
            .mockResolvedValue(buildTitle().withApiTitle('Test').build());

        appRef = startApp(mockAdapter);

        // Initial decoration from init()
        vi.advanceTimersByTime(DECORATION_DEBOUNCE_MS + 100);
        await vi.runAllTimersAsync();

        const callCountAfterInit = getDataSpy.mock.calls.length;

        // Add a NEW title card so it's not skipped by the "already has overlay" check
        document.body.innerHTML += `
            <div class="title-card" id="new-card">
                <a aria-label="New Title"></a>
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
        const mockFadeManager = {
            getOverride: vi.fn().mockResolvedValue(null),
            shouldFade: vi.fn().mockReturnValue(false),
        };
        const app = new FlixMonkeyApp(buildLogger().build(), {}, mockFadeManager, {}, mockRenderer, mockSurfaces, {});
        app.init();
        expect(() => app.init()).toThrow('FlixMonkeyApp already initialised');
        window.dispatchEvent(new Event('beforeunload'));
    });

    it('should expose cacheManager and disabledManager on the startApp return value', () => {
        appRef = startApp(buildMockAdapter().build());
        expect(appRef.cacheManager).toBeDefined();
        expect(typeof appRef.cacheManager.clear).toBe('function');
        expect(appRef.disabledManager).toBeDefined();
        expect(typeof appRef.disabledManager.resetAll).toBe('function');
    });

    it('should return null when Netflix is disabled via enableNetflix config', async () => {
        const { ServiceRegistry } = await import('../../../src/core/services/index.js');
        vi.spyOn(ServiceRegistry, 'detect').mockReturnValue(new NetflixService());
        const adapter = buildMockAdapter()
            .withConfigGetReturning(key => (key === 'enableNetflix' ? false : undefined))
            .build();
        const result = startApp(adapter);
        expect(result).toBeNull();
    });

    it('should return app instance when Netflix is enabled via enableNetflix config', async () => {
        const { ServiceRegistry } = await import('../../../src/core/services/index.js');
        vi.spyOn(ServiceRegistry, 'detect').mockReturnValue(new NetflixService());
        const adapter = buildMockAdapter()
            .withConfigGetReturning(key => (key === 'enableNetflix' ? true : undefined))
            .build();
        const result = startApp(adapter);
        expect(result).not.toBeNull();
        expect(result).toBeInstanceOf(FlixMonkeyApp);
        expect(typeof result.redecorate).toBe('function');
    });

    it('should catch and log errors thrown in the mutation handler', () => {
        const mockAdapter = buildMockAdapter().withStorageGetResolvingTo({}).build();
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
                <a aria-label="Boom Movie"></a>
            </div>
        `;
        const logSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
        vi.spyOn(ApiClientManager.prototype, 'getData').mockRejectedValue(new Error('boom'));

        appRef = startApp(buildMockAdapter().build());

        await Promise.resolve();
        vi.runAllTimers();
        await vi.runAllTimersAsync();

        await vi.waitFor(
            () => {
                expect(logSpy).toHaveBeenCalledWith('Failed to decorate "Boom Movie"', expect.any(Error));
            },
            { timeout: 2000 }
        );
        logSpy.mockRestore();
    });

    it('should remove inFlight entry and log error if API call hangs past timeout', async () => {
        document.body.innerHTML = `
            <div class="title-card">
                <a aria-label="Hanging Film"></a>
            </div>
        `;
        const logSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
        vi.spyOn(ApiClientManager.prototype, 'getData').mockReturnValue(new Promise(() => {})); // never resolves

        appRef = startApp(buildMockAdapter().build());
        await Promise.resolve();
        vi.runAllTimers();

        // Advance past INFLIGHT_TIMEOUT_MS (30000ms)
        await vi.advanceTimersByTimeAsync(31_000);

        expect(logSpy).toHaveBeenCalledWith('Failed to decorate "Hanging Film"', expect.any(Error));
        logSpy.mockRestore();
    });

    it('should disconnect the MutationObserver on unload', () => {
        const mockAdapter = buildMockAdapter().withStorageGetResolvingTo({}).build();
        appRef = startApp(mockAdapter);

        const disconnectSpy = vi.spyOn(mockMutationObserverInstance, 'disconnect');
        window.dispatchEvent(new Event('beforeunload'));
        expect(disconnectSpy).toHaveBeenCalled();
    });

    it('should call decorateRoot on mutation target rather than full document when nodes are added', async () => {
        const parent = document.createElement('div');
        document.body.appendChild(parent);

        appRef = startApp(buildMockAdapter().build());
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
        const mockAdapter = buildMockAdapter().build();
        document.body.innerHTML = `
            <div id="container">
                <div class="title-card" id="card1"><a aria-label="Test: Movie"></a></div>
                <div class="title-card" id="card2"><a aria-label="Test Movie"></a></div>
            </div>
        `;
        const getDataSpy = vi
            .spyOn(ApiClientManager.prototype, 'getData')
            .mockResolvedValue(buildTitle().withApiTitle('Test Movie').withImdbRating(7.0).build());
        appRef = startApp(mockAdapter);
        await vi.waitFor(() => {
            if (getDataSpy.mock.calls.length === 0) throw new Error('Not called yet');
        });
        expect(getDataSpy.mock.calls.length).toBeLessThanOrEqual(1);
        getDataSpy.mockRestore();
    });

    it('should clear data-fm-injected attribute during redecorate so containers are eligible for re-decoration', () => {
        // Prevent auto-decoration from init() and the subsequent decorateRoot() inside redecorate()
        const discoverSpy = vi.spyOn(SurfaceManager.prototype, 'discover').mockReturnValue([]);

        appRef = startApp(buildMockAdapter().build());

        // Manually set up a container in the "decorated" state
        const container = document.createElement('div');
        const overlayEl = document.createElement('div');
        overlayEl.className = 'fm-rating-overlay';
        container.appendChild(overlayEl);
        container.setAttribute('data-fm-injected', '1');
        document.body.appendChild(container);

        expect(container.querySelector('.fm-rating-overlay')).not.toBeNull();
        expect(container.hasAttribute('data-fm-injected')).toBe(true);

        appRef.redecorate();

        // clearAllOverlays() must remove the overlay element AND the attribute,
        // leaving the container eligible for re-decoration
        expect(container.querySelector('.fm-rating-overlay')).toBeNull();
        expect(container.hasAttribute('data-fm-injected')).toBe(false);

        discoverSpy.mockRestore();
    });

    it('should not inject overlay when container is removed from DOM before data resolves', async () => {
        const container = document.createElement('div');
        container.className = 'title-card';
        container.innerHTML = '<a aria-label="Detach Test"></a>';
        document.body.appendChild(container);

        let resolveData;
        vi.spyOn(ApiClientManager.prototype, 'getData').mockReturnValue(
            new Promise(resolve => {
                resolveData = resolve;
            })
        );
        const injectSpy = vi.spyOn(OverlayRenderer.prototype, 'injectOverlay');

        appRef = startApp(buildMockAdapter().build());

        // Advance fake timers so the setTimeout(resolve, 0) yield in #decorateContainer fires,
        // moving execution past the yield and into the getData await
        vi.advanceTimersByTime(1);
        await Promise.resolve();
        await Promise.resolve();

        // Detach the container before the data resolves
        document.body.removeChild(container);

        // Now resolve the data - document.contains(container) is now false
        resolveData(buildTitle().withApiTitle('Detach Test').withImdbRating(7.0).build());
        await Promise.resolve();
        await Promise.resolve();

        expect(injectSpy).not.toHaveBeenCalled();
        injectSpy.mockRestore();
    });

    it('should stamp data-fm-key on fadeable card containers after decoration', async () => {
        document.body.innerHTML = `
            <div class="title-card">
                <a aria-label="Stamped Movie"></a>
            </div>
        `;
        const spy = vi
            .spyOn(ApiClientManager.prototype, 'getData')
            .mockResolvedValue(buildTitle().withImdbRating(7.0).withImdbId('tt1').build());
        appRef = startApp(buildMockAdapter().build());
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

    it('should stamp data-fm-key on non-fadeable mini-modal containers for refresh support', async () => {
        document.body.innerHTML = `
            <div class="previewModal--wrapper mini-modal">
                <div class="previewModal--player_container">
                    <img alt="Mini Movie">
                </div>
            </div>
        `;
        const spy = vi
            .spyOn(ApiClientManager.prototype, 'getData')
            .mockResolvedValue(buildTitle().withImdbRating(5.0).withImdbId('tt2').build());
        appRef = startApp(buildMockAdapter().build());
        await vi.waitFor(() => {
            if (spy.mock.calls.length === 0) throw new Error('Not called');
        });
        await vi.runAllTimersAsync();
        const container = document.querySelector('.previewModal--player_container');
        await vi.waitFor(() => {
            if (!container.querySelector('.fm-rating-overlay')) throw new Error('Overlay not injected');
        });
        expect(container.dataset.fmKey).toBeTruthy();
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
        const adapter = buildMockAdapter()
            .withConfigGetReturning(key => (key === 'enableFadeToggle' ? true : undefined))
            .withStorageGetResolvingTo(null)
            .build();
        vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue(
            buildTitle().withImdbRating(7.0).withImdbId('tt3').build()
        );
        appRef = startApp(adapter);
        const container = document.querySelector('.previewModal--player_container');
        await vi.waitFor(() => {
            if (!container.querySelector('.fm-fade-toggle')) throw new Error('Toggle not found');
        });
        expect(container.querySelector('.fm-fade-toggle')).not.toBeNull();
        expect(container.querySelector('.fm-fade-toggle').dataset.state).toBe('auto');
    });

    it('should apply stored "always" fade override to browse title cards on reload', async () => {
        document.body.innerHTML = `
            <div class="title-card">
                <a aria-label="Reload Movie"></a>
            </div>
        `;
        const storageGet = vi
            .fn()
            .mockImplementation(key =>
                key === 'fm-fade:reload_movie' ? Promise.resolve('always') : Promise.resolve(null)
            );
        const adapter = buildMockAdapter()
            .withConfigGetReturning(key => (key === 'enableFadeUnderRating' ? false : undefined))
            .withStorageGetResolvingTo(storageGet)
            .build();
        vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue(
            buildTitle().withImdbRating(7.0).withImdbId('tt5').build()
        );
        appRef = startApp(adapter);
        vi.advanceTimersToNextTimer();
        const card = document.querySelector('.title-card');
        await vi.waitFor(() => {
            if (!card.querySelector('.fm-rating-overlay:not(.fm-loading)'))
                throw new Error('Final overlay not injected');
        });
        expect(card.classList.contains('fm-faded')).toBe(true);
    });

    it('should cycle fade toggle state on click and update sibling cards', async () => {
        document.body.innerHTML = `
            <div class="title-card" id="card1"><a aria-label="Cycle Movie"></a></div>
            <div class="previewModal--wrapper mini-modal">
                <div class="previewModal--player_container">
                    <img alt="Cycle Movie">
                </div>
            </div>
        `;
        const storageGet = vi.fn().mockResolvedValue(null);
        const storageSet = vi.fn().mockResolvedValue(undefined);
        const adapter = buildMockAdapter()
            .withConfigGetReturning(key => {
                if (key === 'enableFadeToggle') return true;
                if (key === 'enableFadeUnderRating') return false;
                return undefined;
            })
            .withStorageGetResolvingTo(storageGet)
            .withStorageSetResolvingTo(storageSet)
            .build();
        vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue(
            buildTitle().withImdbRating(5.0).withImdbId('tt4').build()
        );
        appRef = startApp(adapter);
        vi.advanceTimersToNextTimer();
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

    it('should return null when ServiceRegistry.detect returns null', async () => {
        const { ServiceRegistry } = await import('../../../src/core/services/index.js');
        vi.spyOn(ServiceRegistry, 'detect').mockReturnValueOnce(null);
        const result = startApp(buildMockAdapter().build());
        expect(result).toBeNull();
    });

    it('should return null when ServiceRegistry.detect returns undefined', async () => {
        const { ServiceRegistry } = await import('../../../src/core/services/index.js');
        vi.spyOn(ServiceRegistry, 'detect').mockReturnValueOnce(undefined);
        const result = startApp(buildMockAdapter().build());
        expect(result).toBeNull();
    });

    describe('IMDb ID override handlers', () => {
        let mockOverrideManager;
        let mockCache;
        let mockRenderer;

        /**
         * Decorates `container` and resolves with the click callbacks the app wires into
         * the overlay. That wiring is the only production path to the private handlers.
         */
        const decorateAndCaptureActions = async container => {
            mockRenderer = {
                hasOverlay: vi.fn().mockReturnValue(false),
                isLoading: vi.fn().mockReturnValue(false),
                ensureRelative: vi.fn(),
                injectLoadingOverlay: vi.fn(),
                injectOverlay: vi.fn(),
                injectStyles: vi.fn(),
                removeLoadingOverlay: vi.fn(),
                applyFade: vi.fn(),
            };
            const app = new FlixMonkeyApp(
                buildLogger().build(),
                mockCache,
                {},
                mockOverrideManager,
                mockRenderer,
                {
                    discover: vi
                        .fn()
                        .mockReturnValue([{ container, title: 'Test Movie', fadeable: false, showFadeToggle: false }]),
                },
                { getData: vi.fn().mockResolvedValue({ imdbRating: 7.0, displayTitle: 'Test Movie' }) }
            );
            app.init();

            await vi.waitFor(() => {
                if (mockRenderer.injectOverlay.mock.calls.length === 0) throw new Error('overlay not injected');
            });
            const [, , , , onEditClick, onRefreshClick] = mockRenderer.injectOverlay.mock.calls[0];
            return { onEditClick, onRefreshClick };
        };

        const withPromptResult = async (promptResult, fn) => {
            const originalPrompt = window.prompt;
            const promptMock = vi.fn().mockReturnValue(promptResult);
            window.prompt = promptMock;
            try {
                await fn();
            } finally {
                window.prompt = originalPrompt;
            }
            return promptMock;
        };

        beforeEach(() => {
            mockCache = { delete: vi.fn().mockResolvedValue(undefined) };
            mockOverrideManager = {
                getImdbId: vi.fn().mockResolvedValue(null),
                setImdbId: vi.fn().mockResolvedValue(undefined),
            };
        });

        it('should cancel the override when the prompt is dismissed', async () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            const { onEditClick } = await decorateAndCaptureActions(container);

            await withPromptResult(null, () => onEditClick('Test Movie', null));

            expect(mockOverrideManager.setImdbId).not.toHaveBeenCalled();
            expect(mockCache.delete).not.toHaveBeenCalled();
        });

        it('should alert on an invalid IMDb ID', async () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            const { onEditClick } = await decorateAndCaptureActions(container);
            const originalAlert = window.alert;
            window.alert = vi.fn();

            try {
                await withPromptResult('invalid-id', () => onEditClick('Test Movie', null));
                expect(window.alert).toHaveBeenCalledWith(
                    'Invalid IMDb ID. Must be tt followed by numbers (e.g., tt0133093)'
                );
                expect(mockOverrideManager.setImdbId).not.toHaveBeenCalled();
                expect(mockCache.delete).not.toHaveBeenCalled();
            } finally {
                window.alert = originalAlert;
            }
        });

        it('should set the override and evict the cache for a valid IMDb ID', async () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            const { onEditClick } = await decorateAndCaptureActions(container);

            await withPromptResult('tt0133093', () => onEditClick('Test Movie', null));

            expect(mockOverrideManager.setImdbId).toHaveBeenCalledWith('Test Movie', 'tt0133093');
            expect(mockCache.delete).toHaveBeenCalledWith('test_movie');
        });

        it('should extract the IMDb ID from an IMDb URL', async () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            const { onEditClick } = await decorateAndCaptureActions(container);

            await withPromptResult('https://www.imdb.com/title/tt0133093/', () => onEditClick('Test Movie', null));

            expect(mockOverrideManager.setImdbId).toHaveBeenCalledWith('Test Movie', 'tt0133093');
            expect(mockCache.delete).toHaveBeenCalledWith('test_movie');
        });

        it('should prefill the prompt with the current override before the API IMDb ID', async () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            mockOverrideManager.getImdbId.mockResolvedValue('tt0000001');
            const { onEditClick } = await decorateAndCaptureActions(container);

            const promptMock = await withPromptResult(null, () => onEditClick('Test Movie', 'tt9999999'));

            expect(promptMock).toHaveBeenCalledWith('IMDb ID for Test Movie:', 'tt0000001');
        });

        it('should evict the cache and re-decorate on refresh', async () => {
            const container = document.createElement('div');
            container.setAttribute('data-fm-key', 'test_movie');
            document.body.appendChild(container);
            const { onRefreshClick } = await decorateAndCaptureActions(container);

            await onRefreshClick('Test Movie');

            expect(mockCache.delete).toHaveBeenCalledWith('test_movie');
            expect(mockRenderer.removeLoadingOverlay).toHaveBeenCalled();
        });
    });
});
