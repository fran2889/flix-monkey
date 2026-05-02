import { describe, it, expect } from 'vitest';
import { SurfaceManager } from '../../../src/core/surfaces.js';

describe('Surfaces', () => {
  it('should discover surfaces', () => {
    const surfaces = new SurfaceManager();
    const mockRoot = {
        querySelectorAll: () => []
    };
    const results = surfaces.discover(mockRoot);
    expect(results).toBeInstanceOf(Array);
  });
});
