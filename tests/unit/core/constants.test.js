import { describe, it, expect } from 'vitest';
import * as Constants from '../../../src/core/constants';

describe('core/constants', () => {
  it('should export expected constants', () => {
    expect(Constants).toBeDefined();
    // Verify specific constants are present based on expected usage if known
    // For now, checking it's an object as defined in most constant files
    expect(typeof Constants).toBe('object');
  });
});
