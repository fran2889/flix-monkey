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
import { describe, it, expect } from 'vitest';
import * as Constants from '../../../src/core/constants';

describe('core/constants', () => {
    it('should export expected constant values', () => {
        expect(Constants.DAYS_TO_MS).toBe(86400000);
        expect(Constants.NAVIGATION_DEBOUNCE_MS).toBe(800);
        expect(Constants.CLIENT_DISABLE_DURATION).toBe(3600000);
        expect(Constants.ApiSource.XMDB).toBe('xmdb');
    });

    it('should have correct rate limits configured', () => {
        expect(Constants.RATE_LIMITS).toEqual({
            [Constants.ApiSource.XMDB]: 1500,
            [Constants.ApiSource.OMDB]: 0,
            [Constants.ApiSource.IMDBAPI]: 1000,
        });
    });
});
