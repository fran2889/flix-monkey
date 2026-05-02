import { describe, it, expect } from 'vitest';
import { OverlayRenderer } from '../../../src/core/overlay.js';

describe('Overlay', () => {
  it('should create an overlay element', () => {
    const overlay = new OverlayRenderer();
    expect(overlay).toBeDefined();
  });
});
