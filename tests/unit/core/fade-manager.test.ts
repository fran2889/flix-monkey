/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it } from 'vitest';

import { FadeManager, type FadeOverrideState, nextFadeState } from '../../../src/core/fade-manager';
import { buildMockAdapter } from '../../mocks/adapter';
import { buildConfig } from '../../mocks/config';

describe('FadeManager', () => {
    describe('getOverride', () => {
        it.each([
            { description: 'an absent key', key: 'tt1234567', stored: undefined, expected: undefined },
            { description: 'a stored "always"', key: 'k', stored: 'always', expected: 'always' },
            { description: 'a stored "never"', key: 'k', stored: 'never', expected: 'never' },
            { description: 'an unknown stored value', key: 'k', stored: 'bad-value', expected: undefined },
        ])('returns $expected for $description', async ({ key, stored, expected }) => {
            const adapter = buildMockAdapter().withStorageGetResolvingTo(stored).build();
            const fm = new FadeManager(adapter, buildConfig().build());

            expect(await fm.getOverride(key)).toBe(expected);
            expect(adapter.storageGet).toHaveBeenCalledWith(`fm-fade:${key}`);
        });
    });

    describe('setOverride', () => {
        it.each([
            { description: 'writes "always" to storage', state: 'always', expectedWrite: 'always' },
            { description: 'writes "never" to storage', state: 'never', expectedWrite: 'never' },
            { description: 'deletes the key when state is undefined', state: undefined, expectedWrite: undefined },
        ] satisfies Array<{
            description: string;
            state: FadeOverrideState;
            expectedWrite: 'always' | 'never' | undefined;
        }>)('$description', async ({ state, expectedWrite }) => {
            const adapter = buildMockAdapter().build();
            await new FadeManager(adapter, buildConfig().build()).setOverride('tt1', state);

            if (expectedWrite === undefined) {
                expect(adapter.storageDelete).toHaveBeenCalledWith('fm-fade:tt1');
                expect(adapter.storageSet).not.toHaveBeenCalled();
            } else {
                expect(adapter.storageSet).toHaveBeenCalledWith('fm-fade:tt1', expectedWrite);
            }
        });
    });

    describe('shouldFade', () => {
        it.each([
            {
                description: 'returns true for an "always" override regardless of rating',
                override: 'always',
                enableFadeUnderRating: false,
                threshold: 6.0,
                rating: 9.9,
                expected: true,
            },
            {
                description: 'returns false for a "never" override regardless of rating',
                override: 'never',
                enableFadeUnderRating: true,
                threshold: 6.0,
                rating: 1.0,
                expected: false,
            },
            {
                description: 'returns false for an undefined override when enableFadeUnderRating is false',
                override: undefined,
                enableFadeUnderRating: false,
                threshold: 6.0,
                rating: 4.0,
                expected: false,
            },
            {
                description: 'returns true for an undefined override when rating is below threshold',
                override: undefined,
                enableFadeUnderRating: true,
                threshold: 6.0,
                rating: 5.9,
                expected: true,
            },
            {
                description: 'returns false for an undefined override when rating equals threshold',
                override: undefined,
                enableFadeUnderRating: true,
                threshold: 6.0,
                rating: 6.0,
                expected: false,
            },
            {
                description: 'returns false for an undefined override when rating is above threshold',
                override: undefined,
                enableFadeUnderRating: true,
                threshold: 6.0,
                rating: 7.5,
                expected: false,
            },
            {
                description: 'returns false for an undefined override when rating is not a number',
                override: undefined,
                enableFadeUnderRating: true,
                threshold: 6.0,
                rating: undefined,
                expected: false,
            },
        ] satisfies Array<{
            description: string;
            override: FadeOverrideState;
            enableFadeUnderRating: boolean;
            threshold: number;
            rating: number | undefined;
            expected: boolean;
        }>)('$description', ({ override, enableFadeUnderRating, threshold, rating, expected }) => {
            const fm = new FadeManager(
                buildMockAdapter().build(),
                buildConfig()
                    .withEnableFadeUnderRating(enableFadeUnderRating)
                    .withFadeRatingThreshold(threshold)
                    .build()
            );

            expect(fm.shouldFade(override, rating)).toBe(expected);
        });
    });

    describe('nextFadeState', () => {
        it.each([
            { description: 'cycles undefined -> "always"', current: undefined, expected: 'always' },
            { description: 'cycles "always" -> "never"', current: 'always', expected: 'never' },
            { description: 'cycles "never" -> undefined', current: 'never', expected: undefined },
        ] satisfies Array<{ description: string; current: FadeOverrideState; expected: FadeOverrideState }>)(
            '$description',
            ({ current, expected }) => {
                expect(nextFadeState(current)).toBe(expected);
            }
        );
    });
});
