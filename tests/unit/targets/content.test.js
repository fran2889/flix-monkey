/**
 * SPDX-FileCopyrightText: 2026 Fran
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// These module-level variables are captured by the hoisted vi.mock() factory.
// They are mutated in beforeEach so each test run gets a fresh state.
let onChangedListener;
let mockAppHandle;

vi.mock('webextension-polyfill', () => ({
    default: {
        storage: {
            local: {
                // content.js calls browser.storage.local.get(null) to preload all config
                get: vi.fn().mockResolvedValue({ overlayCorner: 'top-right' }),
            },
            onChanged: {
                addListener: vi.fn(fn => {
                    onChangedListener = fn;
                }),
            },
        },
        runtime: {
            sendMessage: vi.fn().mockResolvedValue({ data: {} }),
            id: 'test-extension-id',
        },
    },
}));

vi.mock('../../../src/core/app.js', () => ({
    startApp: vi.fn(() => mockAppHandle),
}));

describe('content.js entry point', () => {
    let startAppSpy;

    beforeEach(async () => {
        vi.resetModules();

        // Reset the captured listener and app handle for each test run.
        onChangedListener = undefined;
        mockAppHandle = {
            redecorate: vi.fn(),
            clearCache: vi.fn(),
            disconnect: vi.fn(),
        };

        // Re-import so vi.resetModules() takes effect and content.js IIFE runs fresh.
        const appModule = await import('../../../src/core/app.js');
        startAppSpy = appModule.startApp;
        vi.mocked(startAppSpy).mockReturnValue(mockAppHandle);

        await import('../../../src/targets/extension/content.js');

        // The content.js IIFE is async; wait one microtask tick so that the
        // await browser.storage.local.get(null) resolves before assertions run.
        await Promise.resolve();
    });

    it('should call startApp once', () => {
        expect(startAppSpy).toHaveBeenCalledOnce();
    });

    it('should register a storage.onChanged listener', () => {
        expect(onChangedListener).toBeDefined();
    });

    it('should call redecorate when overlayCorner changes', () => {
        onChangedListener({ overlayCorner: { newValue: 'bottom-left' } });
        expect(mockAppHandle.redecorate).toHaveBeenCalledOnce();
    });

    it('should call redecorate when showRtRating changes', () => {
        onChangedListener({ showRtRating: { newValue: true } });
        expect(mockAppHandle.redecorate).toHaveBeenCalledOnce();
    });

    it('should call redecorate when showMcRating changes', () => {
        onChangedListener({ showMcRating: { newValue: false } });
        expect(mockAppHandle.redecorate).toHaveBeenCalledOnce();
    });

    it('should call redecorate when enableFadeUnderRating changes', () => {
        onChangedListener({ enableFadeUnderRating: { newValue: true } });
        expect(mockAppHandle.redecorate).toHaveBeenCalledOnce();
    });

    it('should call redecorate when fadeRatingThreshold changes', () => {
        onChangedListener({ fadeRatingThreshold: { newValue: 50 } });
        expect(mockAppHandle.redecorate).toHaveBeenCalledOnce();
    });

    it('should not call redecorate when an unrelated key changes', () => {
        onChangedListener({ someOtherKey: { newValue: 'value' } });
        expect(mockAppHandle.redecorate).not.toHaveBeenCalled();
    });
});
