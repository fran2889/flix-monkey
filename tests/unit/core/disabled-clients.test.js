import { describe, it, expect, vi } from 'vitest';
import { DisabledClientsManager } from '../../../src/core/disabled-clients.js';

describe('DisabledClients', () => {
  it('should track disabled clients', () => {
    const mockAdapter = {
        get: vi.fn(),
        set: vi.fn()
    };
    const disabled = new DisabledClientsManager(mockAdapter);
    expect(disabled).toBeDefined();
  });
});
