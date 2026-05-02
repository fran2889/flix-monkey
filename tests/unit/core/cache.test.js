import { describe, it, expect } from 'vitest';
import { CacheManager } from '../../../src/core/cache.js';

describe('CacheManager', () => {
  it('should be instantiable', () => {
    const mockAdapter = { storageGet: () => null, storageSet: () => null };
    const cache = new CacheManager(mockAdapter);
    expect(cache).toBeDefined();
  });
});
