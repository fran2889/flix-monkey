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
import { describe, it, expect, beforeEach } from 'vitest';
import { FadeManager } from '../../../src/core/fade-manager.js';
import { ConfigManager } from '../../../src/core/config-manager.js';
import { createMockAdapter } from '../../mocks/adapter.js';

describe('FadeManager', () => {
    let adapter;
    let config;
    let fade;

    beforeEach(() => {
        adapter = createMockAdapter();
        config = new ConfigManager(adapter);
        fade = new FadeManager(adapter, config);
    });

    describe('getOverride', () => {
        it('should return true when stored value is "true"', async () => {
            adapter.storageGet.mockResolvedValue('true');
            expect(await fade.getOverride('some movie')).toBe(true);
            expect(adapter.storageGet).toHaveBeenCalledWith('fm-fade:some movie');
        });

        it('should return false when stored value is "false"', async () => {
            adapter.storageGet.mockResolvedValue('false');
            expect(await fade.getOverride('some movie')).toBe(false);
        });

        it('should return null when no stored value', async () => {
            adapter.storageGet.mockResolvedValue(null);
            expect(await fade.getOverride('some movie')).toBeNull();
        });

        it('should return null when stored value is undefined', async () => {
            adapter.storageGet.mockResolvedValue(undefined);
            expect(await fade.getOverride('some movie')).toBeNull();
        });
    });

    describe('setOverride', () => {
        it('should store "true" for fade override', async () => {
            await fade.setOverride('some movie', true);
            expect(adapter.storageSet).toHaveBeenCalledWith('fm-fade:some movie', 'true');
        });

        it('should store "false" for not-faded override', async () => {
            await fade.setOverride('some movie', false);
            expect(adapter.storageSet).toHaveBeenCalledWith('fm-fade:some movie', 'false');
        });

        it('should delete key for null (auto)', async () => {
            await fade.setOverride('some movie', null);
            expect(adapter.storageDelete).toHaveBeenCalledWith('fm-fade:some movie');
        });
    });

    describe('shouldFade', () => {
        it('should return true when override is true and toggle enabled', () => {
            const config = new ConfigManager(
                createMockAdapter({
                    configGet: key => {
                        if (key === 'enableFadeToggle') return true;
                        return undefined;
                    },
                })
            );
            const fm = new FadeManager(createMockAdapter(), config);
            expect(fm.shouldFade(true, 9.0, true)).toBe(true);
        });

        it('should return false when override is false and toggle enabled', () => {
            const config = new ConfigManager(
                createMockAdapter({
                    configGet: key => {
                        if (key === 'enableFadeToggle') return true;
                        return undefined;
                    },
                })
            );
            const fm = new FadeManager(createMockAdapter(), config);
            expect(fm.shouldFade(false, 3.0, true)).toBe(false);
        });

        it('should ignore override when toggle disabled', () => {
            const config = new ConfigManager(
                createMockAdapter({
                    configGet: key => {
                        if (key === 'enableFadeToggle') return false;
                        if (key === 'enableFadeUnderRating') return true;
                        if (key === 'fadeRatingThreshold') return 6.0;
                        return undefined;
                    },
                })
            );
            const fm = new FadeManager(createMockAdapter(), config);
            expect(fm.shouldFade(false, 3.0, true)).toBe(true);
        });

        it('should fall back to rating logic when override is null', () => {
            const config = new ConfigManager(
                createMockAdapter({
                    configGet: key => {
                        if (key === 'enableFadeToggle') return true;
                        if (key === 'enableFadeUnderRating') return true;
                        if (key === 'fadeRatingThreshold') return 6.0;
                        return undefined;
                    },
                })
            );
            const fm = new FadeManager(createMockAdapter(), config);
            expect(fm.shouldFade(null, 5.0, true)).toBe(true);
            expect(fm.shouldFade(null, 7.0, true)).toBe(false);
        });

        it('should not fade when not fadeable and no override', () => {
            const config = new ConfigManager(
                createMockAdapter({
                    configGet: key => {
                        if (key === 'enableFadeUnderRating') return true;
                        if (key === 'fadeRatingThreshold') return 6.0;
                        return undefined;
                    },
                })
            );
            const fm = new FadeManager(createMockAdapter(), config);
            expect(fm.shouldFade(null, 3.0, false)).toBe(false);
        });

        it('should not fade when rating auto-fade is disabled and no override', () => {
            const config = new ConfigManager(
                createMockAdapter({
                    configGet: key => {
                        if (key === 'enableFadeUnderRating') return false;
                        return undefined;
                    },
                })
            );
            const fm = new FadeManager(createMockAdapter(), config);
            expect(fm.shouldFade(null, 3.0, true)).toBe(false);
        });

        it('should not fade when rating is null and no override', () => {
            const config = new ConfigManager(
                createMockAdapter({
                    configGet: key => {
                        if (key === 'enableFadeUnderRating') return true;
                        if (key === 'fadeRatingThreshold') return 6.0;
                        return undefined;
                    },
                })
            );
            const fm = new FadeManager(createMockAdapter(), config);
            expect(fm.shouldFade(null, null, true)).toBe(false);
        });

        it('should not fade when fadeable is false even with a manual override', () => {
            const config = new ConfigManager(
                createMockAdapter({
                    configGet: key => {
                        if (key === 'enableFadeToggle') return true;
                        return undefined;
                    },
                })
            );
            const fm = new FadeManager(createMockAdapter(), config);
            expect(fm.shouldFade(true, 8.0, false)).toBe(false);
            expect(fm.shouldFade(false, 3.0, false)).toBe(false);
        });
    });

    describe('getToggleState', () => {
        it('should return "faded" when override is true', () => {
            expect(fade.getToggleState(true, false)).toBe('faded');
        });

        it('should return "not-faded" when override is false', () => {
            expect(fade.getToggleState(false, true)).toBe('not-faded');
        });

        it('should return "faded" when no override and rating-faded', () => {
            expect(fade.getToggleState(null, true)).toBe('faded');
        });

        it('should return "auto" when no override and not rating-faded', () => {
            expect(fade.getToggleState(null, false)).toBe('auto');
        });
    });

    describe('nextToggleState', () => {
        it('should cycle faded -> not-faded', () => {
            expect(fade.nextToggleState('faded')).toBe('not-faded');
        });

        it('should cycle not-faded -> auto', () => {
            expect(fade.nextToggleState('not-faded')).toBe('auto');
        });

        it('should cycle auto -> faded', () => {
            expect(fade.nextToggleState('auto')).toBe('faded');
        });

        it('should fall back to auto for unknown state', () => {
            expect(fade.nextToggleState('unknown')).toBe('auto');
            expect(fade.nextToggleState(undefined)).toBe('auto');
        });
    });

    describe('stateToOverride', () => {
        it('should return true for faded state', () => {
            expect(fade.stateToOverride('faded')).toBe(true);
        });

        it('should return false for not-faded state', () => {
            expect(fade.stateToOverride('not-faded')).toBe(false);
        });

        it('should return null for auto state', () => {
            expect(fade.stateToOverride('auto')).toBeNull();
        });

        it('should return null for unknown state', () => {
            expect(fade.stateToOverride('unknown')).toBeNull();
            expect(fade.stateToOverride(undefined)).toBeNull();
        });
    });
});
