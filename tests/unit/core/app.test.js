import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startApp } from '../../../src/core/app.js';

describe('App', () => {
  beforeEach(() => {
    class MockMutationObserver {
        constructor() {}
        observe = vi.fn();
        disconnect = vi.fn();
    }
    vi.stubGlobal('MutationObserver', MockMutationObserver);
    vi.stubGlobal('document', { 
        body: {},
        head: { appendChild: vi.fn() },
        addEventListener: vi.fn(),
        createElement: vi.fn(() => ({ style: {}, appendChild: vi.fn() }))
    });
    vi.stubGlobal('window', { addEventListener: vi.fn(), fmApi: null });
    vi.stubGlobal('history', { pushState: vi.fn(), replaceState: vi.fn() });
    vi.stubGlobal('Node', { ELEMENT_NODE: 1 });
  });

  it('should initialize and hold state', () => {
    const mockAdapter = {
        storageGet: vi.fn().mockResolvedValue({}),
        storageSet: vi.fn(),
        httpFetch: vi.fn()
    };
    const { api, cache } = startApp(mockAdapter);
    expect(api).toBeDefined();
    expect(cache).toBeDefined();
    expect(window.fmApi).toBe(api);
  });
});
