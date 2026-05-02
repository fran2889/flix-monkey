import { describe, it, expect } from 'vitest';
import { Config } from '../../../src/core/config';

describe('core/config', () => {
  it('should be instantiable', () => {
    const config = new Config();
    expect(config).toBeDefined();
  });
});
