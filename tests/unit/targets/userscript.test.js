import { vi, describe, it, expect, beforeEach } from 'vitest';
import '../../mocks/userscript.js';

describe('Userscript Entry Point', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should initialize the app', async () => {
    // We import directly to trigger the top-level GM_config.init call
    await import('../../../src/targets/userscript/entry.js');

    // Check if GM_config.init was called, which confirms the entry point code executed
    expect(window.GM_config.init).toHaveBeenCalled();
  });
});
