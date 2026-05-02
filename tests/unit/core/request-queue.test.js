import { describe, it, expect } from 'vitest';
import { RequestQueue } from '../../../src/core/request-queue.js';

describe('RequestQueue', () => {
    it('should clear queue', () => {
        const queue = new RequestQueue();
        const p1 = queue.enqueue('url1', 1, () => Promise.resolve(), 'json');
        const p2 = queue.enqueue('url2', 1, () => Promise.resolve(), 'json');
        p1.catch(() => {});
        p2.catch(() => {});
        const count = queue.clear();
        expect(count).toBe(2);
    });
});
