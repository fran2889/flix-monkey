/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { flushAsyncWork } from '../../../helpers/async';

// These module-level variables are captured by the hoisted vi.mock() factory.
// They are mutated in beforeEach so each test run gets a fresh state.
let onChangedListener: (_changes: Record<string, { newValue: unknown }>) => void;
let mockAppHandle: { redecorate: Mock; clearCache: Mock; disconnect: Mock };
let migrationPromise: Promise<unknown>;
let resolveMigrations: (_value: unknown) => void;
let storedObject: Record<string, unknown>;
let startAppSpy: Mock;
let browser: {
    runtime: { sendMessage: Mock; id: string };
    storage: { local: { get: Mock }; onChanged: { addListener: Mock } };
};

vi.mock('webextension-polyfill', () => ({
    default: {
        storage: {
            local: {
                // content.js calls browser.storage.local.get(null) to preload all config
                get: vi.fn().mockImplementation(() => Promise.resolve(storedObject)),
            },
            onChanged: {
                addListener: vi.fn((fn: (_changes: Record<string, { newValue: unknown }>) => void) => {
                    onChangedListener = fn;
                }),
            },
        },
        runtime: {
            sendMessage: vi.fn(() => migrationPromise),
            id: 'test-extension-id',
        },
    },
}));

vi.mock('../../../../src/core/app', () => ({
    startApp: vi.fn(() => mockAppHandle),
}));

describe('content.js entry point', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.useFakeTimers();

        migrationPromise = new Promise(resolve => {
            resolveMigrations = resolve;
        });

        storedObject = { overlayCorner: 'top-right' };

        onChangedListener = vi.fn() as unknown as (_changes: Record<string, { newValue: unknown }>) => void;
        mockAppHandle = {
            redecorate: vi.fn(),
            clearCache: vi.fn(),
            disconnect: vi.fn(),
        };

        // Re-import so vi.resetModules() takes effect and content.js IIFE runs fresh.
        const appModule = (await import('../../../../src/core/app')) as unknown as {
            startApp: Mock;
        };
        startAppSpy = appModule.startApp;
        vi.mocked(startAppSpy).mockReturnValue(mockAppHandle);

        browser = (await import('webextension-polyfill')).default as unknown as {
            runtime: { sendMessage: Mock; id: string };
            storage: { local: { get: Mock }; onChanged: { addListener: Mock } };
        };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    async function startAfterMigrations() {
        const entryImport = import('../../../../src/targets/extension/content');
        await entryImport;
        resolveMigrations({});
        await flushAsyncWork();
    }

    function startedAdapter(): { configGet: (_key: string) => unknown } {
        const [startCall] = startAppSpy.mock.calls;
        if (startCall === undefined) throw new Error('startApp was not called');
        return startCall[0] as { configGet: (_key: string) => unknown };
    }

    describe('startup', () => {
        it('waits for migrations before reading storage and starting the app', async () => {
            const entryImport = import('../../../../src/targets/extension/content');
            await entryImport;

            expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ type: 'FM_RUN_MIGRATIONS' });
            expect(browser.storage.local.get).not.toHaveBeenCalled();
            expect(startAppSpy).not.toHaveBeenCalled();

            resolveMigrations({});
            await flushAsyncWork();

            expect(browser.storage.local.get).toHaveBeenCalledAfter(browser.runtime.sendMessage);
            expect(startAppSpy).toHaveBeenCalled();
            expect(startAppSpy).toHaveBeenCalledAfter(browser.storage.local.get);
        });
        it('does not start the app or read storage and logs when migrations report an error', async () => {
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            migrationPromise = Promise.resolve({ error: 'migration boom' });

            await import('../../../../src/targets/extension/content');

            await flushAsyncWork();
            expect(errorSpy).toHaveBeenCalled();
            expect(startAppSpy).not.toHaveBeenCalled();
            expect(browser.storage.local.get).not.toHaveBeenCalled();
            expect(errorSpy).toHaveBeenCalledWith('FlixMonkey content script failed to start', expect.any(Error));
            errorSpy.mockRestore();
        });
        it('starts the app once', async () => {
            await startAfterMigrations();
            expect(startAppSpy).toHaveBeenCalledOnce();
        });
        it('seeds the config snapshot with only valid storage values', async () => {
            storedObject = { overlayCorner: 42, showRtRating: true };
            await startAfterMigrations();

            const adapter = startedAdapter();
            expect(adapter.configGet('overlayCorner')).toBeUndefined();
            expect(adapter.configGet('showRtRating')).toBe(true);
        });
    });

    describe('storage changes', () => {
        it('removes a setting from the snapshot when the new value has the wrong type', async () => {
            await startAfterMigrations();

            onChangedListener({ overlayCorner: { newValue: 42 } });

            expect(startedAdapter().configGet('overlayCorner')).toBeUndefined();
            expect(mockAppHandle.redecorate).toHaveBeenCalledOnce();
        });
        it('removes a setting from the snapshot when the key is deleted', async () => {
            storedObject = { showRtRating: true };
            await startAfterMigrations();

            onChangedListener({ showRtRating: { newValue: undefined } });

            expect(startedAdapter().configGet('showRtRating')).toBeUndefined();
        });
        describe('stored object updates', () => {
            it('updates the stored object when storage changes', async () => {
                await startAfterMigrations();

                expect(startedAdapter().configGet('overlayCorner')).toBe('top-right');

                onChangedListener({ overlayCorner: { newValue: 'bottom-left' } });

                expect(startedAdapter().configGet('overlayCorner')).toBe('bottom-left');
            });

            it('updates multiple keys in the stored config snapshot', async () => {
                await startAfterMigrations();

                onChangedListener({
                    overlayCorner: { newValue: 'bottom-left' },
                    showRtRating: { newValue: true },
                });

                expect(startedAdapter().configGet('overlayCorner')).toBe('bottom-left');
                expect(startedAdapter().configGet('showRtRating')).toBe(true);
            });

            it('updates the stored config snapshot for non-visual settings', async () => {
                await startAfterMigrations();

                onChangedListener({ apiClient: { newValue: 'omdb' } });

                expect(startedAdapter().configGet('apiClient')).toBe('omdb');
            });
        });
    });

    describe('redecorate', () => {
        it.each([
            ['overlayCorner', 'bottom-left'],
            ['showRtRating', true],
            ['showMcRating', false],
            ['enableFadeUnderRating', true],
            ['fadeRatingThreshold', '50'],
        ])('calls redecorate when %s changes', async (key, value) => {
            await startAfterMigrations();

            onChangedListener({ [key]: { newValue: value } });

            expect(mockAppHandle.redecorate).toHaveBeenCalledOnce();
        });
        it('does not call redecorate when an unrelated key changes', async () => {
            await startAfterMigrations();
            onChangedListener({ someOtherKey: { newValue: 'value' } });
            expect(mockAppHandle.redecorate).not.toHaveBeenCalled();
        });
        describe('multiple visual setting changes', () => {
            it('calls redecorate once for multiple visual setting changes', async () => {
                await startAfterMigrations();

                onChangedListener({
                    overlayCorner: { newValue: 'bottom-left' },
                    showRtRating: { newValue: true },
                    showMcRating: { newValue: true },
                });

                expect(mockAppHandle.redecorate).toHaveBeenCalledOnce();
            });

            it('calls redecorate for mixed visual and non-visual changes', async () => {
                await startAfterMigrations();

                onChangedListener({
                    overlayCorner: { newValue: 'bottom-left' },
                    apiClient: { newValue: 'omdb' },
                    debug: { newValue: true },
                });

                expect(mockAppHandle.redecorate).toHaveBeenCalledOnce();
            });

            it('does not call redecorate when only non-visual settings change', async () => {
                await startAfterMigrations();

                onChangedListener({
                    apiClient: { newValue: 'omdb' },
                    debug: { newValue: false },
                });

                expect(mockAppHandle.redecorate).not.toHaveBeenCalled();
            });

            it('calls redecorate once per change event with multiple visual settings', async () => {
                await startAfterMigrations();

                onChangedListener({
                    overlayCorner: { newValue: 'bottom-left' },
                    showRtRating: { newValue: true },
                });

                onChangedListener({
                    showMcRating: { newValue: true },
                });

                expect(mockAppHandle.redecorate).toHaveBeenCalledTimes(2);
            });
        });
    });
});
