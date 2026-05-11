import { describe, it, expect } from 'vitest';
import { CONFIG } from '../../../src/core/config';

describe('core/config', () => {
    it('should be defined', () => {
        expect(CONFIG).toBeDefined();
    });
});
