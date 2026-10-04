/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it } from 'vitest';

import { FadeManager, nextFadeState } from '../../../src/core/fade-manager.js';
import { buildMockAdapter } from '../../mocks/adapter.js';
import { buildConfig } from '../../mocks/config.js';

describe('FadeManager', () => {
    describe('getOverride', () => {
        it('returns null when key is absent', async () => {
            const adapter = buildMockAdapter().withStorageGetResolvingTo(null).build();
            const fm = new FadeManager(adapter, buildConfig().build());
            expect(await fm.getOverride('tt1234567')).toBeNull();
            expect(adapter.storageGet).toHaveBeenCalledWith('fm-fade:tt1234567');
        });

        it('returns "always" when stored value is "always"', async () => {
            const adapter = buildMockAdapter().withStorageGetResolvingTo('always').build();
            expect(await new FadeManager(adapter, buildConfig().build()).getOverride('k')).toBe('always');
        });

        it('returns "never" when stored value is "never"', async () => {
            const adapter = buildMockAdapter().withStorageGetResolvingTo('never').build();
            expect(await new FadeManager(adapter, buildConfig().build()).getOverride('k')).toBe('never');
        });

        it('returns null for an unknown stored value', async () => {
            const adapter = buildMockAdapter().withStorageGetResolvingTo('bad-value').build();
            expect(await new FadeManager(adapter, buildConfig().build()).getOverride('k')).toBeNull();
        });
    });

    describe('setOverride', () => {
        it('writes "always" to storage', async () => {
            const adapter = buildMockAdapter().build();
            await new FadeManager(adapter, buildConfig().build()).setOverride('tt1', 'always');
            expect(adapter.storageSet).toHaveBeenCalledWith('fm-fade:tt1', 'always');
        });

        it('writes "never" to storage', async () => {
            const adapter = buildMockAdapter().build();
            await new FadeManager(adapter, buildConfig().build()).setOverride('tt1', 'never');
            expect(adapter.storageSet).toHaveBeenCalledWith('fm-fade:tt1', 'never');
        });

        it('deletes key when state is null', async () => {
            const adapter = buildMockAdapter().build();
            await new FadeManager(adapter, buildConfig().build()).setOverride('tt1', null);
            expect(adapter.storageDelete).toHaveBeenCalledWith('fm-fade:tt1');
            expect(adapter.storageSet).not.toHaveBeenCalled();
        });
    });

    describe('shouldFade', () => {
        const fm = (enable, threshold) =>
            new FadeManager(
                buildMockAdapter().build(),
                buildConfig().withEnableFadeUnderRating(enable).withFadeRatingThreshold(threshold).build()
            );

        it('returns true for "always" override regardless of rating', () => {
            expect(fm(false).shouldFade('always', 9.9)).toBe(true);
        });

        it('returns false for "never" override regardless of rating', () => {
            expect(fm(true).shouldFade('never', 1.0)).toBe(false);
        });

        it('returns false for null override when enableFadeUnderRating is false', () => {
            expect(fm(false).shouldFade(null, 4.0)).toBe(false);
        });

        it('returns true for null override when rating is below threshold', () => {
            expect(fm(true).shouldFade(null, 5.9)).toBe(true);
        });

        it('returns false for null override when rating equals threshold', () => {
            expect(fm(true).shouldFade(null, 6.0)).toBe(false);
        });

        it('returns false for null override when rating is above threshold', () => {
            expect(fm(true).shouldFade(null, 7.5)).toBe(false);
        });

        it('returns false for null override when rating is not a number', () => {
            expect(fm(true).shouldFade(null, null)).toBe(false);
            expect(fm(true).shouldFade(null, undefined)).toBe(false);
        });
    });

    describe('nextFadeState', () => {
        it('cycles null -> "always"', () => {
            expect(nextFadeState(null)).toBe('always');
        });

        it('cycles "always" -> "never"', () => {
            expect(nextFadeState('always')).toBe('never');
        });

        it('cycles "never" -> null', () => {
            expect(nextFadeState('never')).toBeNull();
        });
    });
});
