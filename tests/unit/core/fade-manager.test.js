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
import { describe, expect, it, vi } from 'vitest';

import { ConfigManager } from '../../../src/core/config-manager.js';
import { FadeManager } from '../../../src/core/fade-manager.js';
import { createMockAdapter } from '../../mocks/adapter.js';

function makeConfig(enableFadeUnderRating = false, fadeRatingThreshold = 6.0) {
    return new ConfigManager(
        createMockAdapter({
            configGet: key => {
                if (key === 'enableFadeUnderRating') return enableFadeUnderRating;
                if (key === 'fadeRatingThreshold') return fadeRatingThreshold;
                return undefined;
            },
        })
    );
}

describe('FadeManager', () => {
    describe('getOverride', () => {
        it('returns null when key is absent', async () => {
            const adapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue(null) });
            const fm = new FadeManager(adapter);
            expect(await fm.getOverride('tt1234567')).toBeNull();
            expect(adapter.storageGet).toHaveBeenCalledWith('fm-fade:tt1234567');
        });

        it('returns "always" when stored value is "always"', async () => {
            const adapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue('always') });
            expect(await new FadeManager(adapter).getOverride('k')).toBe('always');
        });

        it('returns "never" when stored value is "never"', async () => {
            const adapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue('never') });
            expect(await new FadeManager(adapter).getOverride('k')).toBe('never');
        });

        it('returns null for an unknown stored value', async () => {
            const adapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue('bad-value') });
            expect(await new FadeManager(adapter).getOverride('k')).toBeNull();
        });
    });

    describe('setOverride', () => {
        it('writes "always" to storage', async () => {
            const adapter = createMockAdapter();
            await new FadeManager(adapter).setOverride('tt1', 'always');
            expect(adapter.storageSet).toHaveBeenCalledWith('fm-fade:tt1', 'always');
        });

        it('writes "never" to storage', async () => {
            const adapter = createMockAdapter();
            await new FadeManager(adapter).setOverride('tt1', 'never');
            expect(adapter.storageSet).toHaveBeenCalledWith('fm-fade:tt1', 'never');
        });

        it('deletes key when state is null', async () => {
            const adapter = createMockAdapter();
            await new FadeManager(adapter).setOverride('tt1', null);
            expect(adapter.storageDelete).toHaveBeenCalledWith('fm-fade:tt1');
            expect(adapter.storageSet).not.toHaveBeenCalled();
        });
    });

    describe('shouldFade', () => {
        it('returns true for "always" override regardless of rating', () => {
            expect(new FadeManager(createMockAdapter()).shouldFade('always', 9.9, makeConfig(false))).toBe(true);
        });

        it('returns false for "never" override regardless of rating', () => {
            expect(new FadeManager(createMockAdapter()).shouldFade('never', 1.0, makeConfig(true, 6.0))).toBe(false);
        });

        it('returns false for null override when enableFadeUnderRating is false', () => {
            expect(new FadeManager(createMockAdapter()).shouldFade(null, 4.0, makeConfig(false, 6.0))).toBe(false);
        });

        it('returns true for null override when rating is below threshold', () => {
            expect(new FadeManager(createMockAdapter()).shouldFade(null, 5.9, makeConfig(true, 6.0))).toBe(true);
        });

        it('returns false for null override when rating equals threshold', () => {
            expect(new FadeManager(createMockAdapter()).shouldFade(null, 6.0, makeConfig(true, 6.0))).toBe(false);
        });

        it('returns false for null override when rating is above threshold', () => {
            expect(new FadeManager(createMockAdapter()).shouldFade(null, 7.5, makeConfig(true, 6.0))).toBe(false);
        });

        it('returns false for null override when rating is not a number', () => {
            expect(new FadeManager(createMockAdapter()).shouldFade(null, null, makeConfig(true, 6.0))).toBe(false);
            expect(new FadeManager(createMockAdapter()).shouldFade(null, undefined, makeConfig(true, 6.0))).toBe(false);
        });
    });

    describe('nextState', () => {
        it('cycles null → "always"', () => {
            expect(new FadeManager(createMockAdapter()).nextState(null)).toBe('always');
        });

        it('cycles "always" → "never"', () => {
            expect(new FadeManager(createMockAdapter()).nextState('always')).toBe('never');
        });

        it('cycles "never" → null', () => {
            expect(new FadeManager(createMockAdapter()).nextState('never')).toBeNull();
        });
    });
});
