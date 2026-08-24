/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// These module-level variables are captured by the hoisted vi.mock() factory.
// They are mutated in beforeEach so each test run gets a fresh state.
let onChangedListener;
let mockAppHandle;
let migrationPromise;
let resolveMigrations;
let storedObject;

vi.mock('webextension-polyfill', () => ({
    default: {
        storage: {
            local: {
                // content.js calls browser.storage.local.get(null) to preload all config
                get: vi.fn().mockImplementation(() => Promise.resolve(storedObject)),
            },
            onChanged: {
                addListener: vi.fn(fn => {
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

vi.mock('../../../../src/core/app.js', () => ({
    startApp: vi.fn(() => mockAppHandle),
}));

describe('content.js entry point', () => {
    let startAppSpy;
    let browser;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        migrationPromise = new Promise(resolve => {
            resolveMigrations = resolve;
        });

        // Reset the stored object for each test
        storedObject = { overlayCorner: 'top-right' };

        // Reset the captured listener and app handle for each test run.
        onChangedListener = undefined;
        mockAppHandle = {
            redecorate: vi.fn(),
            clearCache: vi.fn(),
            disconnect: vi.fn(),
        };

        // Re-import so vi.resetModules() takes effect and content.js IIFE runs fresh.
        const appModule = await import('../../../../src/core/app.js');
        startAppSpy = appModule.startApp;
        vi.mocked(startAppSpy).mockReturnValue(mockAppHandle);

        browser = (await import('webextension-polyfill')).default;
    });

    async function startAfterMigrations() {
        const entryImport = import('../../../../src/targets/extension/content.js');
        await entryImport;
        resolveMigrations({});
        await Promise.resolve();
        await Promise.resolve();
    }

    it('waits for migrations before reading storage and starting the app', async () => {
        const entryImport = import('../../../../src/targets/extension/content.js');
        await entryImport;

        expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ type: 'FM_RUN_MIGRATIONS' });
        expect(browser.storage.local.get).not.toHaveBeenCalled();
        expect(startAppSpy).not.toHaveBeenCalled();

        resolveMigrations({});
        await Promise.resolve();
        await Promise.resolve();

        expect(browser.storage.local.get).toHaveBeenCalledAfter(browser.runtime.sendMessage);
        expect(startAppSpy).toHaveBeenCalledAfter(browser.storage.local.get);
    });

    it('should call startApp once', async () => {
        await startAfterMigrations();
        expect(startAppSpy).toHaveBeenCalledOnce();
    });

    it('should register a storage.onChanged listener', async () => {
        await startAfterMigrations();
        expect(onChangedListener).toBeDefined();
    });

    it('should call redecorate when overlayCorner changes', async () => {
        await startAfterMigrations();
        onChangedListener({ overlayCorner: { newValue: 'bottom-left' } });
        expect(mockAppHandle.redecorate).toHaveBeenCalledOnce();
    });

    it('should call redecorate when showRtRating changes', async () => {
        await startAfterMigrations();
        onChangedListener({ showRtRating: { newValue: true } });
        expect(mockAppHandle.redecorate).toHaveBeenCalledOnce();
    });

    it('should call redecorate when showMcRating changes', async () => {
        await startAfterMigrations();
        onChangedListener({ showMcRating: { newValue: false } });
        expect(mockAppHandle.redecorate).toHaveBeenCalledOnce();
    });

    it('should call redecorate when enableFadeUnderRating changes', async () => {
        await startAfterMigrations();
        onChangedListener({ enableFadeUnderRating: { newValue: true } });
        expect(mockAppHandle.redecorate).toHaveBeenCalledOnce();
    });

    it('should call redecorate when fadeRatingThreshold changes', async () => {
        await startAfterMigrations();
        onChangedListener({ fadeRatingThreshold: { newValue: 50 } });
        expect(mockAppHandle.redecorate).toHaveBeenCalledOnce();
    });

    it('should not call redecorate when an unrelated key changes', async () => {
        await startAfterMigrations();
        onChangedListener({ someOtherKey: { newValue: 'value' } });
        expect(mockAppHandle.redecorate).not.toHaveBeenCalled();
    });

    describe('stored object updates', () => {
        it('updates the stored object when storage changes', async () => {
            await startAfterMigrations();

            expect(storedObject.overlayCorner).toBe('top-right');

            onChangedListener({ overlayCorner: { newValue: 'bottom-left' } });

            expect(storedObject.overlayCorner).toBe('bottom-left');
        });

        it('updates multiple keys in stored object', async () => {
            await startAfterMigrations();

            onChangedListener({
                overlayCorner: { newValue: 'bottom-left' },
                showRtRating: { newValue: true },
            });

            expect(storedObject.overlayCorner).toBe('bottom-left');
            expect(storedObject.showRtRating).toBe(true);
        });

        it('updates stored object for non-visual settings', async () => {
            await startAfterMigrations();

            onChangedListener({ apiClient: { newValue: 'omdb' } });

            expect(storedObject.apiClient).toBe('omdb');
        });
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

        it('calls redecorate exactly once for each change event with multiple visual settings', async () => {
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
