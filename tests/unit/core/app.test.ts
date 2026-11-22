/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { AgregarrApiClient, type ApiClientDeps } from '../../../src/core/api/index';
import { ApiClientManager } from '../../../src/core/api-manager';
import { FlixMonkeyApp, startApp } from '../../../src/core/app';
import { CacheManager } from '../../../src/core/cache/index';
import { ConfigManager } from '../../../src/core/config/index';
import { DECORATION_DEBOUNCE_MS, LOOKUP_TIMEOUT_MS } from '../../../src/core/constants';
import { DisabledClientsManager } from '../../../src/core/disabled-clients';
import { FadeManager } from '../../../src/core/fade-manager';
import { IdOverrideManager } from '../../../src/core/id-override-manager';
import { Logger } from '../../../src/core/logger';
import { type OverlayInteraction, OverlayRenderer } from '../../../src/core/overlay';
import { DisneyPlusService, HboMaxService, NetflixService } from '../../../src/core/services/index';
import { NETFLIX_SURFACES, SurfaceManager } from '../../../src/core/surfaces/index';
import type { Title } from '../../../src/core/title';
import { flushAsyncWork } from '../../helpers/async';
import { buildMockAdapter } from '../../mocks/adapter';
import { buildLogger } from '../../mocks/logger';
import { buildTitle } from '../../mocks/title';

type MockMutationCallback = (_mutations: MutationRecord[], _observer: MutationObserver) => void;

function buildAppDependencies(): {
    logger: Logger;
    cache: CacheManager;
    fadeManager: FadeManager;
    overrideManager: IdOverrideManager;
    renderer: OverlayRenderer;
    surfaces: SurfaceManager;
    api: ApiClientManager;
} {
    const adapter = buildMockAdapter().build();
    const logger = buildLogger().build();
    const config = new ConfigManager(adapter, logger);
    const disabledManager = new DisabledClientsManager(adapter);
    const overrideManager = new IdOverrideManager(adapter);
    const cache = new CacheManager(adapter, config, logger, overrideManager);
    const deps: ApiClientDeps = { adapter, config, disabledManager, logger, overrideManager };
    const client = new AgregarrApiClient(deps);
    return {
        logger,
        cache,
        fadeManager: new FadeManager(adapter, config),
        overrideManager,
        renderer: new OverlayRenderer(config),
        surfaces: new SurfaceManager(logger, NETFLIX_SURFACES),
        api: new ApiClientManager(logger, cache, disabledManager, client),
    };
}

/**
 * Builds an app from real dependencies without starting it.
 *
 * @returns An unstarted FlixMonkeyApp.
 */
function buildApp(): FlixMonkeyApp {
    const dependencies = buildAppDependencies();
    return new FlixMonkeyApp(
        dependencies.logger,
        dependencies.cache,
        dependencies.fadeManager,
        dependencies.overrideManager,
        dependencies.renderer,
        dependencies.surfaces,
        dependencies.api
    );
}

describe('FlixMonkeyApp', () => {
    let mockMutationObserverInstance:
        (MutationObserver & { trigger: (_mutations: MutationRecord[]) => void }) | undefined;
    let appRef: FlixMonkeyApp | undefined;
    const ActualMutationObserver = global.MutationObserver;

    function requireMockObserver(): MutationObserver & { trigger: (_mutations: MutationRecord[]) => void } {
        if (!mockMutationObserverInstance) throw new Error('MutationObserver was not created');
        return mockMutationObserverInstance;
    }

    function requireApp(): FlixMonkeyApp {
        if (!appRef) throw new Error('app was not started');
        return appRef;
    }

    beforeEach(async () => {
        appRef = undefined;
        vi.useFakeTimers();
        document.body.innerHTML = '';

        const { ServiceRegistry } = await import('../../../src/core/services/index.js');
        vi.spyOn(ServiceRegistry, 'detect').mockReturnValue(new NetflixService());

        // Patch MutationObserver to allow manual triggering of callbacks in tests
        global.MutationObserver = class extends ActualMutationObserver {
            callback: MockMutationCallback;
            constructor(callback: MockMutationCallback) {
                super(callback);
                this.callback = callback;
                mockMutationObserverInstance = this as MutationObserver & {
                    trigger: (_mutations: MutationRecord[]) => void;
                };
            }
            trigger(_mutations: MutationRecord[]): void {
                this.callback(_mutations, this);
            }
        } as unknown as typeof MutationObserver;
    });

    afterEach(() => {
        // The app tears itself down on unload; that listener is the only path to #disconnect.
        window.dispatchEvent(new Event('beforeunload'));
        vi.useRealTimers();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        global.MutationObserver = ActualMutationObserver;
    });

    describe('startup', () => {
        it('throws when the app is initialised twice', () => {
            const app = buildApp();

            app.init();

            expect(() => app.init()).toThrow('FlixMonkeyApp already initialised');
        });

        describe('service gating', () => {
            it.each([
                {
                    description: 'Netflix is disabled',
                    outcome: 'returns no app',
                    setup: async () => {
                        const { ServiceRegistry } = await import('../../../src/core/services/index.js');
                        vi.spyOn(ServiceRegistry, 'detect').mockReturnValue(new NetflixService());
                        return buildMockAdapter()
                            .withConfigGetReturning((key: string) => (key === 'enableNetflix' ? false : undefined))
                            .build();
                    },
                    expectedInstance: false,
                },
                {
                    description: 'Netflix is enabled',
                    outcome: 'returns an app',
                    setup: async () => {
                        const { ServiceRegistry } = await import('../../../src/core/services/index.js');
                        vi.spyOn(ServiceRegistry, 'detect').mockReturnValue(new NetflixService());
                        return buildMockAdapter()
                            .withConfigGetReturning((key: string) => (key === 'enableNetflix' ? true : undefined))
                            .build();
                    },
                    expectedInstance: true,
                },
                {
                    description: 'no service is detected',
                    outcome: 'returns no app',
                    setup: async () => {
                        const { ServiceRegistry } = await import('../../../src/core/services/index.js');
                        vi.spyOn(ServiceRegistry, 'detect').mockReturnValueOnce(undefined);
                        return buildMockAdapter().build();
                    },
                    expectedInstance: false,
                },
            ])('$outcome when $description', async ({ setup, expectedInstance }) => {
                const result = startApp(await setup());

                if (!expectedInstance) {
                    expect(result).toBeUndefined();
                    return;
                }

                expect(result).not.toBeUndefined();
                if (result) {
                    expect(result).toBeInstanceOf(FlixMonkeyApp);
                    expect(typeof result.redecorate).toBe('function');
                }
            });
        });
    });

    it('disconnects the MutationObserver on unload', () => {
        const mockAdapter = buildMockAdapter().withStorageGetResolvingTo({}).build();
        appRef = startApp(mockAdapter);

        const disconnectSpy = vi.spyOn(mockMutationObserverInstance as MutationObserver, 'disconnect');
        window.dispatchEvent(new Event('beforeunload'));
        expect(disconnectSpy).toHaveBeenCalled();
    });

    describe('navigation', () => {
        it('debounces navigation events', async () => {
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
            await flushAsyncWork();
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

            await vi.runAllTimersAsync();
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });

        it('decorates on replaceState', async () => {
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
    });

    describe('mutation handling', () => {
        it('decorates a card added by a DOM mutation', async () => {
            const mockAdapter = buildMockAdapter().withStorageGetResolvingTo({}).build();
            const spy = vi
                .spyOn(ApiClientManager.prototype, 'getData')
                .mockResolvedValue(buildTitle().withApiTitle('Test').build());

            appRef = startApp(mockAdapter);
            await flushAsyncWork();
            spy.mockClear();

            const container = document.createElement('div');
            container.innerHTML = `
            <div class="title-card">
                <a aria-label="New Movie"></a>
            </div>
        `;
            document.body.appendChild(container);

            requireMockObserver().trigger([
                {
                    addedNodes: [container] as unknown as NodeList,
                    target: document.body,
                    type: 'childList',
                    removedNodes: [] as unknown as NodeList,
                    previousSibling: null,
                    nextSibling: null,
                    attributeName: null,
                    attributeNamespace: null,
                    oldValue: null,
                },
            ]);

            await vi.runAllTimersAsync();
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });

        it('redecorates when a container is replaced', async () => {
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
            await vi.runAllTimersAsync();
            expect(spy).toHaveBeenCalledTimes(1);

            document.body.innerHTML = `
                <div class="title-card">
                    <a aria-label="Original Title"></a>
                </div>
            `;

            const titleCard = document.querySelector('.title-card');
            requireMockObserver().trigger([
                {
                    addedNodes: titleCard ? ([titleCard] as unknown as NodeList) : ([] as unknown as NodeList),
                    target: document.body,
                    type: 'childList',
                    removedNodes: [] as unknown as NodeList,
                    previousSibling: null,
                    nextSibling: null,
                    attributeName: null,
                    attributeNamespace: null,
                    oldValue: null,
                },
            ]);

            await vi.runAllTimersAsync();

            expect(spy).toHaveBeenCalledTimes(2);
            spy.mockRestore();
        });

        it('catches and logs errors thrown in the mutation handler', () => {
            const mockAdapter = buildMockAdapter().withStorageGetResolvingTo({}).build();
            const logSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

            appRef = startApp(mockAdapter);

            // addedNodes: null causes Array.from(null) to throw inside the handler
            expect(() => {
                requireMockObserver().trigger([{ addedNodes: null } as unknown as MutationRecord]);
            }).not.toThrow();

            expect(logSpy).toHaveBeenCalledWith('Mutation observer error', expect.any(Error));
        });

        it('decorates only the mutated subtree when nodes are added', async () => {
            const parent = document.createElement('div');
            document.body.appendChild(parent);

            appRef = startApp(buildMockAdapter().build());

            const discoverSpy = vi.spyOn(SurfaceManager.prototype, 'discover').mockReturnValue([]);

            // Trigger mutation on parent, with target set
            requireMockObserver().trigger([{ addedNodes: [parent], target: parent } as unknown as MutationRecord]);

            vi.advanceTimersByTime(DECORATION_DEBOUNCE_MS + 100);
            await vi.runAllTimersAsync();

            // discover should be called with parent, not document
            const roots = discoverSpy.mock.calls.map(c => c[0]);
            expect(roots.some(r => r === parent)).toBe(true);

            discoverSpy.mockRestore();
        });

        it('collects every mutated root in one observer batch', async () => {
            appRef = startApp(buildMockAdapter().build());

            const discoverSpy = vi.spyOn(SurfaceManager.prototype, 'discover').mockReturnValue([]);
            const firstParent = document.createElement('div');
            const secondParent = document.createElement('div');

            requireMockObserver().trigger([
                { addedNodes: [document.createElement('span')], target: firstParent } as unknown as MutationRecord,
                { addedNodes: [document.createElement('span')], target: secondParent } as unknown as MutationRecord,
            ]);

            vi.advanceTimersByTime(DECORATION_DEBOUNCE_MS + 100);
            await vi.runAllTimersAsync();

            const roots = discoverSpy.mock.calls.map(c => c[0]);
            expect(roots).toContain(firstParent);
            expect(roots).toContain(secondParent);

            discoverSpy.mockRestore();
        });
    });

    describe('decoration', () => {
        it('injects a loading overlay while the lookup is in flight', async () => {
            const mockAdapter = buildMockAdapter().withConfigGetReturning(undefined).build();

            document.body.innerHTML = `
            <div class="title-card">
                <a aria-label="Test Title"></a>
            </div>
        `;

            let resolveApi: (_value: Title) => void = () => {};
            const apiPromise = new Promise<Title>(resolve => {
                resolveApi = resolve;
            });

            vi.spyOn(ApiClientManager.prototype, 'getData').mockReturnValue(apiPromise);

            appRef = startApp(mockAdapter);

            // Flush the yield so the app enters the pending lookup with the loading overlay shown.
            await flushAsyncWork();

            const card = document.querySelector('.title-card');
            expect(card?.querySelector('.fm-loading')).not.toBeNull();

            resolveApi!(buildTitle().withApiTitle('Test Title').build());
            await apiPromise;

            await flushAsyncWork();

            expect(card?.querySelector('.fm-loading')).toBeNull();
            expect(card?.querySelector('.fm-rating-overlay')).not.toBeNull();
        });

        it('clears the data-fm-injected attribute during redecorate so containers can be decorated again', () => {
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

            requireApp().redecorate();

            // clearAllOverlays() must remove the overlay element AND the attribute,
            // leaving the container eligible for re-decoration
            expect(container.querySelector('.fm-rating-overlay')).toBeNull();
            expect(container.hasAttribute('data-fm-injected')).toBe(false);

            discoverSpy.mockRestore();
        });

        it('does not inject an overlay when the container leaves the DOM before the data resolves', async () => {
            const container = document.createElement('div');
            container.className = 'title-card';
            container.innerHTML = '<a aria-label="Detach Test"></a>';
            document.body.appendChild(container);

            let resolveData: (_value: Title) => void = () => {};
            vi.spyOn(ApiClientManager.prototype, 'getData').mockReturnValue(
                new Promise<Title>(resolve => {
                    resolveData = resolve;
                })
            );
            const injectSpy = vi.spyOn(OverlayRenderer.prototype, 'injectOverlay');

            appRef = startApp(buildMockAdapter().build());

            // Flush the yield so execution reaches the pending getData await.
            await flushAsyncWork();

            // Detach the container before the data resolves
            document.body.removeChild(container);

            // Now resolve the data - document.contains(container) is now false
            resolveData(buildTitle().withApiTitle('Detach Test').withImdbRating(7.0).build());
            await flushAsyncWork();

            expect(injectSpy).not.toHaveBeenCalled();
            injectSpy.mockRestore();
        });

        it('stamps data-fm-key on fadeable card containers after decoration', async () => {
            document.body.innerHTML = `
                <div class="title-card">
                    <a aria-label="Stamped Movie"></a>
                </div>
            `;
            const spy = vi
                .spyOn(ApiClientManager.prototype, 'getData')
                .mockResolvedValue(buildTitle().withImdbRating(7.0).withImdbId('tt1').build());
            appRef = startApp(buildMockAdapter().build());
            await vi.runAllTimersAsync();
            const card = document.querySelector('.title-card') as HTMLElement | null;
            expect(card?.dataset.fmKey).toBeTruthy();
            spy.mockRestore();
        });

        it('stamps data-fm-key on non-fadeable mini-modal containers for refresh support', async () => {
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
            await vi.runAllTimersAsync();
            const container = document.querySelector('.previewModal--player_container') as HTMLElement | null;
            expect(container?.querySelector('.fm-rating-overlay')).not.toBeNull();
            expect(container?.dataset.fmKey).toBeTruthy();
            spy.mockRestore();
        });
    });

    describe('lookup failures', () => {
        it('renders a not-found fallback when the lookup fails', async () => {
            document.body.innerHTML = `
                <div class="title-card">
                    <a aria-label="Boom Movie"></a>
                </div>
            `;
            const logSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
            vi.spyOn(ApiClientManager.prototype, 'getData').mockRejectedValue(new Error('boom'));

            appRef = startApp(buildMockAdapter().build());

            await vi.runAllTimersAsync();

            expect(document.querySelector('.title-card .fm-search')).not.toBeNull();
            expect(document.querySelector('.title-card .fm-loading')).toBeNull();
            expect(logSpy).toHaveBeenCalledWith('Failed to decorate "Boom Movie"', expect.any(Error));
            logSpy.mockRestore();
        });

        it('renders a not-found fallback and logs when a lookup times out', async () => {
            document.body.innerHTML = `
                <div class="title-card">
                    <a aria-label="Hanging Film"></a>
                </div>
            `;
            const logSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
            vi.spyOn(ApiClientManager.prototype, 'getData').mockReturnValue(new Promise(() => {})); // never resolves

            appRef = startApp(buildMockAdapter().build());

            // Advance past the lookup timeout.
            await vi.advanceTimersByTimeAsync(LOOKUP_TIMEOUT_MS + 1);

            expect(document.querySelector('.title-card .fm-loading')).toBeNull();
            expect(document.querySelector('.title-card .fm-search')).not.toBeNull();
            expect(logSpy).toHaveBeenCalledWith('Failed to decorate "Hanging Film"', expect.any(Error));
            logSpy.mockRestore();
        });

        it('keeps a render failure out of the not-found fallback', async () => {
            document.body.innerHTML = `
            <div class="title-card">
                <a aria-label="Broken Movie"></a>
            </div>
        `;
            const logSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
            vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue(
                buildTitle().withApiTitle('Broken Movie').build()
            );
            const injectSpy = vi.spyOn(OverlayRenderer.prototype, 'injectOverlay').mockImplementation(() => {
                throw new Error('render failure');
            });

            appRef = startApp(buildMockAdapter().build());

            // Advance only past the paint yield. Running every timer would loop:
            // the thrown render failure removes the loading overlay, that DOM
            // mutation schedules another debounced decoration, and the failure
            // repeats until Vitest aborts after 10000 timers.
            await flushAsyncWork();

            expect(injectSpy).toHaveBeenCalledTimes(1);
            expect(document.querySelector('.title-card .fm-loading')).toBeNull();
            expect(logSpy).toHaveBeenCalledWith('Failed to decorate "Broken Movie"', expect.any(Error));
            logSpy.mockRestore();
        });
        it.each([
            ['resolves', { title: buildTitle().withApiTitle('Settled Movie').withImdbRating(7.0).build() }],
            ['rejects', { error: new Error('API failure') }],
        ])('clears the lookup timeout when a lookup %s', async (_outcome, settled) => {
            document.body.innerHTML = `
                <div class="title-card">
                    <a aria-label="Settled Movie"></a>
                </div>
            `;
            const getDataSpy = vi.spyOn(ApiClientManager.prototype, 'getData');
            if ('error' in settled) {
                getDataSpy.mockRejectedValue(settled.error);
            } else {
                getDataSpy.mockResolvedValue(settled.title);
            }

            buildApp().redecorate();
            await vi.advanceTimersByTimeAsync(1);

            expect(getDataSpy).toHaveBeenCalled();
            expect(vi.getTimerCount()).toBe(0);
        });
    });

    describe.each([
        [
            'Netflix',
            NetflixService,
            '<div class="title-card"><a aria-label="Netflix Title"></a></div>',
            'Netflix Title',
        ],
        [
            'HBO Max',
            HboMaxService,
            '<div><a data-testid="id_tile" data-sonic-type="movie" aria-label="HBO Title. 1 of 20."></a></div>',
            'HBO Title',
        ],
        [
            'Disney+',
            DisneyPlusService,
            '<div><a data-testid="set-item" data-item-id="1" href="/browse/entity-1" aria-label="Disney Title Select for details on this title."></a></div>',
            'Disney Title',
        ],
    ])('%s surface wiring', (_name, Service, html, expectedTitle) => {
        it('discovers titles with the detected service surface definitions', async () => {
            document.body.innerHTML = html;
            const { ServiceRegistry } = await import('../../../src/core/services/index.js');
            vi.spyOn(ServiceRegistry, 'detect').mockReturnValue(new Service());
            const getDataSpy = vi
                .spyOn(ApiClientManager.prototype, 'getData')
                .mockResolvedValue(buildTitle().withApiTitle(expectedTitle).build());

            appRef = startApp(buildMockAdapter().build());

            await vi.runAllTimersAsync();
            expect(getDataSpy).toHaveBeenCalledWith(expectedTitle);
        });
    });

    describe('fade toggle', () => {
        it('renders a fade toggle badge in the mini-modal when enableFadeToggle is true', async () => {
            document.body.innerHTML = `
                <div class="previewModal--wrapper mini-modal">
                    <div class="previewModal--player_container">
                        <img alt="Toggle Movie">
                    </div>
                </div>
            `;
            const adapter = buildMockAdapter()
                .withConfigGetReturning((key: string) => (key === 'enableFadeToggle' ? true : undefined))
                .withStorageGetResolvingTo(undefined)
                .build();
            vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue(
                buildTitle().withImdbRating(7.0).withImdbId('tt3').build()
            );
            appRef = startApp(adapter);
            await vi.runAllTimersAsync();
            const container = document.querySelector('.previewModal--player_container') as HTMLElement | null;
            expect(container?.querySelector('.fm-fade-toggle')).not.toBeNull();
            expect((container?.querySelector('.fm-fade-toggle') as HTMLElement | null)?.dataset.state).toBe('auto');
        });

        it('applies a stored "always" fade override to browse title cards on reload', async () => {
            document.body.innerHTML = `
                <div class="title-card">
                    <a aria-label="Reload Movie"></a>
                </div>
            `;
            const storageGet = vi
                .fn()
                .mockImplementation((key: string) =>
                    key === 'fm-fade:reload_movie' ? Promise.resolve('always') : Promise.resolve(undefined)
                );
            const adapter = buildMockAdapter()
                .withConfigGetReturning((key: string) => (key === 'enableFadeUnderRating' ? false : undefined))
                .withStorageGetResolvingTo(storageGet)
                .build();
            vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue(
                buildTitle().withImdbRating(7.0).withImdbId('tt5').build()
            );
            appRef = startApp(adapter);
            await vi.runAllTimersAsync();
            const card = document.querySelector('.title-card') as HTMLElement | null;
            expect(card?.querySelector('.fm-rating-overlay:not(.fm-loading)')).not.toBeNull();
            expect(card?.classList.contains('fm-faded')).toBe(true);
        });

        it('cycles the fade toggle state on click and updates sibling cards', async () => {
            document.body.innerHTML = `
                <div class="title-card" id="card1"><a aria-label="Cycle Movie"></a></div>
                <div class="previewModal--wrapper mini-modal">
                    <div class="previewModal--player_container">
                        <img alt="Cycle Movie">
                    </div>
                </div>
            `;
            const storageGet = vi.fn().mockResolvedValue(undefined);
            const storageSet = vi.fn().mockResolvedValue(undefined);
            const storageDelete = vi.fn().mockResolvedValue(undefined);
            const adapter = buildMockAdapter()
                .withConfigGetReturning((key: string) => {
                    if (key === 'enableFadeToggle') return true;
                    if (key === 'enableFadeUnderRating') return false;
                    return undefined;
                })
                .withStorageGetResolvingTo(storageGet)
                .withStorageSetResolvingTo(storageSet)
                .withStorageDeleteResolvingTo(storageDelete)
                .build();
            vi.spyOn(ApiClientManager.prototype, 'getData').mockResolvedValue(
                buildTitle().withImdbRating(5.0).withImdbId('tt4').build()
            );
            appRef = startApp(adapter);
            await vi.runAllTimersAsync();
            const modal = document.querySelector('.previewModal--player_container') as HTMLElement | null;
            const toggle = modal?.querySelector('.fm-fade-toggle') as HTMLElement | null;
            if (!toggle) throw new Error('Toggle missing');
            const icon = toggle.querySelector('.fm-fade-toggle-icon');
            if (!icon) throw new Error('Toggle icon missing');
            const card = document.querySelector('.title-card');
            if (!(card instanceof HTMLElement)) throw new Error('Title card missing');
            expect(toggle.dataset.state).toBe('auto');
            expect(toggle.title).toBe('Fade: Auto');
            expect(icon.textContent).toBe('⭐');

            toggle.click();
            await flushAsyncWork();
            expect(toggle.dataset.state).toBe('always');
            expect(toggle.title).toBe('Fade: Always');
            expect(icon.textContent).toBe('👁️');
            expect(icon.classList.contains('fm-fade-toggle--faded')).toBe(true);
            expect(storageSet).toHaveBeenCalledWith(expect.stringContaining('fm-fade:'), 'always');
            expect(card.classList.contains('fm-faded')).toBe(true);

            toggle.click();
            await flushAsyncWork();
            expect(toggle.dataset.state).toBe('never');
            expect(toggle.title).toBe('Fade: Never');
            expect(icon.classList.contains('fm-fade-toggle--faded')).toBe(false);
            expect(storageSet).toHaveBeenCalledWith(expect.stringContaining('fm-fade:'), 'never');
            expect(card.classList.contains('fm-faded')).toBe(false);

            toggle.click();
            await flushAsyncWork();
            expect(toggle.dataset.state).toBe('auto');
            expect(toggle.title).toBe('Fade: Auto');
            expect(icon.textContent).toBe('⭐');
            expect(storageDelete).toHaveBeenCalledWith(expect.stringContaining('fm-fade:'));
        });
    });

    describe('IMDb ID override and refresh handlers', () => {
        let mockOverrideManager: { getImdbId: Mock; setImdbId: Mock };
        let mockCache: { delete: Mock };
        let mockRenderer: Record<string, { mock: { calls: unknown[][] } }>;
        let appLogger: Logger;
        let cache: CacheManager;
        let fadeManager: FadeManager;
        let overrideManager: IdOverrideManager;
        let renderer: OverlayRenderer;
        let surfaces: SurfaceManager;
        let api: ApiClientManager;

        /**
         * Decorates `container` and resolves with the click callbacks the app wires into
         * the overlay. That wiring is the only production path to the private handlers.
         *
         * @param container - Element to decorate.
         * @returns Captured click callbacks and the app logger.
         */
        const decorateAndCaptureActions = async (
            container: HTMLElement
        ): Promise<{
            onEditClick: (_displayTitle: string) => Promise<void>;
            onRefreshClick: (_displayTitle: string) => Promise<void>;
            logger: Logger;
        }> => {
            mockRenderer = {
                hasOverlay: vi.spyOn(renderer, 'hasOverlay').mockReturnValue(false),
                isLoading: vi.spyOn(renderer, 'isLoading').mockReturnValue(false),
                ensureRelative: vi.spyOn(renderer, 'ensureRelative').mockImplementation(() => undefined),
                injectLoadingOverlay: vi.spyOn(renderer, 'injectLoadingOverlay').mockImplementation(() => undefined),
                injectOverlay: vi.spyOn(renderer, 'injectOverlay').mockImplementation(() => undefined),
                injectStyles: vi.spyOn(renderer, 'injectStyles').mockImplementation(() => undefined),
                removeLoadingOverlay: vi.spyOn(renderer, 'removeLoadingOverlay').mockImplementation(() => undefined),
                applyFade: vi.spyOn(renderer, 'applyFade').mockImplementation(() => undefined),
            };
            vi.spyOn(surfaces, 'discover').mockReturnValue([
                { container, title: 'Test Movie', fadeable: false, showFadeToggle: false },
            ]);
            vi.spyOn(api, 'getData').mockResolvedValue(buildTitle.ratedMovie());

            const app = new FlixMonkeyApp(appLogger, cache, fadeManager, overrideManager, renderer, surfaces, api);
            app.init();

            const { injectOverlay } = mockRenderer;
            // Narrow the Record index (noUncheckedIndexedAccess) before using the spy.
            if (injectOverlay === undefined) throw new Error('injectOverlay spy is not configured');
            await vi.runAllTimersAsync();
            const [firstCall] = injectOverlay.mock.calls;
            if (firstCall === undefined) throw new Error('injectOverlay was not called');
            const [, , interaction] = firstCall as [HTMLElement, Title, OverlayInteraction];
            return {
                onEditClick: interaction.onEditClick as (_displayTitle: string) => Promise<void>,
                onRefreshClick: interaction.onRefreshClick as (_displayTitle: string) => Promise<void>,
                logger: appLogger,
            };
        };

        const withPromptResult = async (
            promptResult: string | null,
            fn: () => Promise<void>
        ): Promise<() => string | null> => {
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
            ({
                logger: appLogger,
                cache,
                fadeManager,
                overrideManager,
                renderer,
                surfaces,
                api,
            } = buildAppDependencies());

            mockCache = { delete: vi.spyOn(cache, 'delete').mockResolvedValue(undefined) };
            mockOverrideManager = {
                getImdbId: vi.spyOn(overrideManager, 'getImdbId').mockResolvedValue(undefined),
                setImdbId: vi.spyOn(overrideManager, 'setImdbId').mockResolvedValue(undefined),
            };
        });

        it('cancels the override when the prompt is dismissed', async () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            const { onEditClick } = await decorateAndCaptureActions(container);

            await withPromptResult(null, () => onEditClick('Test Movie'));

            expect(mockOverrideManager.setImdbId).not.toHaveBeenCalled();
            expect(mockCache.delete).not.toHaveBeenCalled();
        });

        it('alerts on an invalid IMDb ID', async () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            const { onEditClick } = await decorateAndCaptureActions(container);
            const originalAlert = window.alert;
            window.alert = vi.fn();

            try {
                await withPromptResult('invalid-id', () => onEditClick('Test Movie'));
                expect(window.alert).toHaveBeenCalledWith(
                    'Invalid IMDb ID. Must be tt followed by numbers (e.g., tt0133093)'
                );
                expect(mockOverrideManager.setImdbId).not.toHaveBeenCalled();
                expect(mockCache.delete).not.toHaveBeenCalled();
            } finally {
                window.alert = originalAlert;
            }
        });

        it('sets the override and evicts the cache for a valid IMDb ID', async () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            const { onEditClick } = await decorateAndCaptureActions(container);

            await withPromptResult('tt0133093', () => onEditClick('Test Movie'));

            expect(mockOverrideManager.setImdbId).toHaveBeenCalledWith('Test Movie', 'tt0133093');
            expect(mockCache.delete).toHaveBeenCalledWith('test_movie');
        });

        it('extracts the IMDb ID from an IMDb URL', async () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            const { onEditClick } = await decorateAndCaptureActions(container);

            await withPromptResult('https://www.imdb.com/title/tt0133093/', () => onEditClick('Test Movie'));

            expect(mockOverrideManager.setImdbId).toHaveBeenCalledWith('Test Movie', 'tt0133093');
            expect(mockCache.delete).toHaveBeenCalledWith('test_movie');
        });

        it('prefills the prompt with the current override before the API IMDb ID', async () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            mockOverrideManager.getImdbId.mockResolvedValue('tt0000001');
            const { onEditClick } = await decorateAndCaptureActions(container);

            const promptMock = await withPromptResult(null, () => onEditClick('Test Movie'));

            expect(promptMock).toHaveBeenCalledWith('IMDb ID for Test Movie:', 'tt0000001');
        });

        it('evicts the cache and re-decorates on refresh', async () => {
            const container = document.createElement('div');
            container.setAttribute('data-fm-key', 'test_movie');
            document.body.appendChild(container);
            const { onRefreshClick } = await decorateAndCaptureActions(container);

            await onRefreshClick('Test Movie');

            expect(mockCache.delete).toHaveBeenCalledWith('test_movie');
            expect(mockRenderer.removeLoadingOverlay).toHaveBeenCalled();
        });

        it('does not set an override or evict the cache and logs when editing the IMDb ID fails', async () => {
            mockOverrideManager.getImdbId.mockRejectedValue(new Error('storage failure'));
            const container = document.createElement('div');
            document.body.appendChild(container);
            const { onEditClick, logger } = await decorateAndCaptureActions(container);

            void onEditClick('Test Movie');

            await flushAsyncWork();
            expect(mockOverrideManager.setImdbId).not.toHaveBeenCalled();
            expect(mockCache.delete).not.toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith('Failed to edit IMDb ID for "Test Movie"', expect.any(Error));
        });

        it('evicts the cache and logs when refreshing ratings fails', async () => {
            mockCache.delete.mockRejectedValue(new Error('storage failure'));
            const container = document.createElement('div');
            document.body.appendChild(container);
            const { onRefreshClick, logger } = await decorateAndCaptureActions(container);

            void onRefreshClick('Test Movie');

            await flushAsyncWork();
            expect(mockCache.delete).toHaveBeenCalledWith('test_movie');
            expect(logger.error).toHaveBeenCalledWith('Failed to refresh ratings for "Test Movie"', expect.any(Error));
        });
    });
});
