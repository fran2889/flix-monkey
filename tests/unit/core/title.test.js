import { describe, it, expect } from 'vitest';
import { Title } from '../../../src/core/title.js';

describe('Title', () => {
    it('should manage title updates', () => {
        const title = new Title('Test Title');
        expect(title).toBeDefined();
    });
});
