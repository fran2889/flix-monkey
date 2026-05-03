import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { SurfaceManager } from '../../src/core/surfaces.js';
import { OverlayRenderer } from '../../src/core/overlay.js';
import fs from 'fs';
import path from 'path';

describe('Info UI Surface (Modal)', () => {
  let surfaceManager, overlayRenderer, fixtureHtml;

  beforeAll(() => {
    // Inject a minimal modal structure
    document.body.innerHTML = `
        <div class="previewModal">
            <h3 data-uia="previewModal-title">Beef</h3>
        </div>
    `;
  });

  beforeEach(() => {
    surfaceManager = new SurfaceManager();
    overlayRenderer = new OverlayRenderer();
  });

  it('should discover title in the preview modal', () => {
    const surfaces = surfaceManager.discover(document.body);
    const modal = surfaces.find(s => s.container.matches('.previewModal, .jawBone, .jawBoneContainer, .previewModal--detailsMetadata'));
    
    expect(modal).toBeDefined();
    expect(modal.title).toBeTruthy();
    expect(modal.fadeable).toBe(false);
  });

  it('should inject overlay into modal container', () => {
    const surfaces = surfaceManager.discover(document.body);
    const modal = surfaces.find(s => s.container.matches('.previewModal, .jawBone, .jawBoneContainer, .previewModal--detailsMetadata'));
    
    overlayRenderer.injectOverlay(modal.container, { rating: 7.8, imdbUrl: 'https://www.imdb.com/title/tt789/' });
    expect(modal.container.querySelector('.fm-rating-overlay')).not.toBeNull();
  });
});
