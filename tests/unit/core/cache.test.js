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
import { ConfigManager } from '../../../src/core/config-manager.js';
import { logger } from '../../../src/core/logger.js';
import { createMockAdapter } from '../../mocks/adapter.js';

describe('CacheManager', () => {
    let adapter;
    let cacheManager;
    let config;

    beforeEach(() => {
        adapter = createMockAdapter({
            storageGet: vi.fn(),
            storageSet: vi.fn(),
            storageDelete: vi.fn(),
            storageGetKeys: vi.fn(),
        });
        config = new ConfigManager();
        cacheManager = new CacheManager(adapter, config);
    });

    it('should return null when cache is empty', async () => {
        adapter.storageGet.mockResolvedValue(null);
        const result = await cacheManager.read('Some Title');
        expect(result).toBeNull();
    });

    it('should write data to storage', async () => {
        adapter.storageGet.mockResolvedValue(null);
        const title = new Title({ apiTitle: 'Test Title' });
        await cacheManager.write('Test Title', title);

        expect(adapter.storageSet).toHaveBeenCalledWith('fmc:test_title', expect.stringContaining('Test Title'));
    });

    it('should clear cache', async () => {
        adapter.storageGetKeys.mockResolvedValue(['fmc:key1']);
        await cacheManager.clear();
        expect(adapter.storageDelete).toHaveBeenCalledWith('fmc:key1');
    });

    it('should write and read cache entry', async () => {
        const titleData = { displayTitle: 'Test Title', year: 2026, rating: '8.0' };
        const titleObj = new Title(titleData);
        adapter.storageGet.mockResolvedValue(
            JSON.stringify({
                data: titleObj,
                expires: Date.now() + 10000,
            })
        );

        await cacheManager.write('Test Title', titleObj);
        expect(adapter.storageSet).toHaveBeenCalledWith('fmc:test_title', expect.any(String));

        const result = await cacheManager.read('Test Title');
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
                data: titleObj,
                expires: now - 1000,
            })
        );

        const result = await cacheManager.read('Old Title');
        expect(result).toBeNull();
        vi.useRealTimers();
    });

    it('should store indefinite TTL as null in storage', async () => {
        const titleData = { displayTitle: 'Indefinite Title', hasRating: true, year: 1900 };
        const titleObj = new Title(titleData);

        // Configure to return -1 for TTL
        config.getInt = vi.fn().mockReturnValue(-1);

        await cacheManager.write('Indefinite Title', titleObj);

        const setCall = adapter.storageSet.mock.calls.find(call => call[0] === 'fmc:indefinite_title');
        const entry = JSON.parse(setCall[1]);
        expect(entry.expires).toBeNull();
    });

    it('should return valid entry for indefinite cache expiration (null)', async () => {
        const titleData = { displayTitle: 'Indefinite Title' };
        const titleObj = new Title(titleData);
        adapter.storageGet.mockResolvedValue(
            JSON.stringify({
                data: titleObj,
                expires: null,
            })
        );

        const result = await cacheManager.read('Indefinite Title');
        expect(result.displayTitle).toEqual(titleObj.displayTitle);
    });

    it('should return null and log a warning when JSON parsing fails in read', async () => {
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
        adapter.storageGet.mockResolvedValue('invalid-json{');

        const result = await cacheManager.read('Some Title');

        expect(result).toBeNull();
        expect(warnSpy).toHaveBeenCalledWith('Cache entry corrupt, treating as miss', { key: 'fmc:some_title' });
        warnSpy.mockRestore();
    });
});
