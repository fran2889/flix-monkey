import { describe, it, expect, vi } from 'vitest';
import { startApp } from '../../../src/core/app.js';

describe('App', () => {
  it('should initialize and hold state', () => {
    const mockAdapter = {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn()
    };
    const { api, cache } = startApp(mockAdapter);
    expect(api).toBeDefined();
    expect(cache).toBeDefined();
  });
});
