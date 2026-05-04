import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CacheManager } from '../../../src/core/cache.js';
import { Title } from '../../../src/core/title.js';
import { DAYS_TO_MS } from '../../../src/core/constants.js';

describe('CacheManager', () => {
    let adapter;
    let cacheManager;

    beforeEach(() => {
        adapter = {
            storageGet: vi.fn(),
            storageSet: vi.fn(),
        };
        cacheManager = new CacheManager(adapter);
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
        
        expect(adapter.storageSet).toHaveBeenCalledWith(
            'fm_cache',
            expect.stringContaining('Test Title')
        );
    });

    it('should clear cache', async () => {
        adapter.storageGet.mockResolvedValue(JSON.stringify({ key1: {} }));
        await cacheManager.clear();
        expect(adapter.storageSet).toHaveBeenCalledWith('fm_cache', '{}');
    });

    it('should return null for expired cache', async () => {
        vi.useFakeTimers();
        const now = Date.now();
        vi.setSystemTime(now);
        
        const titleData = { displayTitle: 'Old Title', year: 2020 };
        const titleObj = new Title(titleData);
        adapter.storageGet.mockResolvedValue(JSON.stringify({
            'old_title_2020': { data: titleObj, expires: now - 1000 }
        }));
        
        const result = await cacheManager.read('Old Title', 2020);
        expect(result).toBeNull();
        vi.useRealTimers();
    });
});
