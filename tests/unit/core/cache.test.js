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
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CacheManager } from '../../../src/core/cache.js';
import { Title } from '../../../src/core/title.js';
import { _DAYS_TO_MS } from '../../../src/core/constants.js';
import { ConfigManager } from '../../../src/core/config-manager.js';

describe('CacheManager', () => {
    let adapter;
    let cacheManager;
    let config;

    beforeEach(() => {
        adapter = {
            storageGet: vi.fn(),
            storageSet: vi.fn(),
        };
        config = new ConfigManager();
        cacheManager = new CacheManager(adapter, config);
    });

    it('should initialize correctly', () => {
        expect(cacheManager).toBeInstanceOf(CacheManager);
    });

    it('should return null when cache is empty', async () => {
        adapter.storageGet.mockResolvedValue(null);
        const result = await cacheManager.read('Some Title', '2023');
        expect(result).toBeNull();
    });

    it('should write data to storage', async () => {
        adapter.storageGet.mockResolvedValue(JSON.stringify({}));
        const title = new Title({ apiTitle: 'Test Title' });
        await cacheManager.write('Test Title', '2023', title);

        expect(adapter.storageSet).toHaveBeenCalledWith('fm_cache', expect.stringContaining('Test Title'));
    });

    it('should clear cache', async () => {
        adapter.storageGet.mockResolvedValue(JSON.stringify({ key1: {} }));
        await cacheManager.clear();
        expect(adapter.storageSet).toHaveBeenCalledWith('fm_cache', '{}');
    });

    it('should write and read cache entry', async () => {
        const titleData = { displayTitle: 'Test Title', year: 2026, rating: '8.0' };
        const titleObj = new Title(titleData);
        adapter.storageGet.mockResolvedValue('{}');

        await cacheManager.write('Test Title', 2026, titleObj);
        expect(adapter.storageSet).toHaveBeenCalled();

        adapter.storageGet.mockResolvedValue(
            JSON.stringify({
                test_title_2026: { data: titleObj, expires: Date.now() + 10000 },
            })
        );

        const result = await cacheManager.read('Test Title', 2026);
        expect(result.displayTitle).toEqual(titleObj.displayTitle);
        expect(result.year).toEqual(titleObj.year);
    });

    it('should return null for expired cache', async () => {
        vi.useFakeTimers();
        const now = Date.now();
        vi.setSystemTime(now);

        const titleData = { displayTitle: 'Old Title', year: 2020 };
        const titleObj = new Title(titleData);
        adapter.storageGet.mockResolvedValue(
            JSON.stringify({
                old_title_2020: { data: titleObj, expires: now - 1000 },
            })
        );

        const result = await cacheManager.read('Old Title', 2020);
        expect(result).toBeNull();
        vi.useRealTimers();
    });
});
