import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CacheManager } from '../../../src/core/cache.js';

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
});
