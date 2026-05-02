import { describe, it, expect, vi } from 'vitest';
import { RequestQueue } from '../../../src/core/request-queue.js';

describe('RequestQueue', () => {
    it('should process queued requests', async () => {
        const mockAdapter = { storageGet: vi.fn().mockResolvedValue(null), storageSet: vi.fn() };
        const queue = new RequestQueue(10, null, mockAdapter);
        const fetchFn = vi.fn().mockResolvedValue('success');
        
        const promise = queue.enqueue('https://api.test', 0, fetchFn, 'json');
        const result = await promise;
        
        expect(result).toBe('success');
        expect(fetchFn).toHaveBeenCalled();
    });

    it('should clear queue', () => {
        const queue = new RequestQueue(999999); 
        
        // Add items to queue and catch the rejection from clear()
        queue.enqueue('url1', 0, () => new Promise(() => {}), 'json').catch(() => {});
        queue.enqueue('url2', 0, () => new Promise(() => {}), 'json').catch(() => {});
        
        const count = queue.clear();
        expect(count).toBe(2);
    });
});
