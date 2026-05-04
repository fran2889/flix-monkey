import { describe, it, expect } from 'vitest';
import * as Constants from '../../../src/core/constants';

describe('core/constants', () => {
  it('should export expected constant values', () => {
    expect(Constants.DAYS_TO_MS).toBe(86400000);
    expect(Constants.NAVIGATION_DEBOUNCE_MS).toBe(800);
    expect(Constants.HTTP_TIMEOUT).toBe(8000);
    expect(Constants.CLIENT_DISABLE_DURATION).toBe(3600000);
    expect(Constants.ApiSource.XMDB).toBe('xmdb');
  });

  it('should have correct rate limits configured', () => {
    expect(Constants.RATE_LIMITS).toEqual({
        [Constants.ApiSource.XMDB]: 1500,
        [Constants.ApiSource.OMDB]: 0,
        [Constants.ApiSource.IMDBAPI]: 1000
    });
  });
});
