import { describe, it, expect } from 'vitest';
import { RequestQueue } from '../../../src/core/request-queue.js';

describe('RequestQueue', () => {
    it('should clear queue', async () => {
        const queue = new RequestQueue(999999);
        const p1 = queue.enqueue('url1', 1, () => new Promise(() => {}), 'json').catch(() => {});
        const p2 = queue.enqueue('url2', 1, () => new Promise(() => {}), 'json').catch(() => {});
        
        const count = queue.clear();
        expect(count).toBe(1);
    });
});
