import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { SurfaceManager } from '../../src/core/surfaces.js';
import { OverlayRenderer } from '../../src/core/overlay.js';
import { CONFIG, initConfig } from '../../src/core/config.js';
import fs from 'fs';
import path from 'path';

describe('Browse UI Surface', () => {
  let surfaceManager, overlayRenderer, fixtureHtml;

  beforeAll(() => {
    fixtureHtml = fs.readFileSync(path.resolve(__dirname, '../fixtures/netflix-browse.html'), 'utf8');
  });

  beforeEach(() => {
    document.body.innerHTML = fixtureHtml;
    surfaceManager = new SurfaceManager();
    overlayRenderer = new OverlayRenderer();
    // Ensure styles are injected for position checks if needed
    overlayRenderer.injectStyles();
  });

  it('should discover title cards on the browse grid', () => {
    const surfaces = surfaceManager.discover(document.body);
    expect(surfaces.length).toBeGreaterThan(0);
    
    const first = surfaces[0];
    expect(first.title).toBeTruthy();
    expect(first.container).toBeInstanceOf(HTMLElement);
    expect(first.fadeable).toBe(true);
  });

  it('should inject loading and rating overlays correctly', () => {
    const surfaces = surfaceManager.discover(document.body);
    const { container, title } = surfaces[0];

    overlayRenderer.injectLoadingOverlay(container, title);
    const loading = container.querySelector('.fm-loading');
    expect(loading).not.toBeNull();
    expect(loading.textContent).toContain('IMDb');
    expect(loading.title).toContain('Fetching ratings');

    const titleObj = {
      rating: 8.5,
      imdbUrl: 'https://www.imdb.com/title/tt1234567/',
      imdbId: 'tt1234567'
    };
    overlayRenderer.injectOverlay(container, titleObj);
    
    const overlay = container.querySelector('.fm-rating-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay.classList.contains('fm-loading')).toBe(false);
    expect(overlay.textContent).toContain('8.5');
    expect(overlay.getAttribute('href')).toBe(titleObj.imdbUrl);
  });

  it('should apply fading for low ratings', () => {
    const surfaces = surfaceManager.discover(document.body);
    const { container } = surfaces[0];
    
    // Set threshold high to ensure fading
    initConfig((key) => {
        if (key === 'enableFadeUnderRating') return true;
        if (key === 'fadeRatingThreshold') return 9.0;
        return null;
    });

    overlayRenderer.applyFade(container, { rating: 7.0 }, true);
    expect(container.classList.contains('fm-faded')).toBe(true);

    overlayRenderer.applyFade(container, { rating: 9.5 }, true);
    expect(container.classList.contains('fm-faded')).toBe(false);
  });
});
