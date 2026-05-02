import { vi, describe, it, expect } from 'vitest';
import '../../mocks/webextension.js';

describe('WebExtension Entry Point', () => {
  it('should verify manifest structure', () => {
    const manifest = require('../../../src/targets/chrome/manifest.json');
    expect(manifest.manifest_version).toBe(3);
  });
});
