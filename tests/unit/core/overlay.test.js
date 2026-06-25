/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { OverlayRenderer } from '../../../src/core/overlay.js';
import { ConfigManager } from '../../../src/core/config-manager.js';
import { TOP_10_BADGE } from '../../../src/core/constants.js';
import { createMockAdapter } from '../../mocks/adapter.js';
import { Title } from '../../../src/core/title.js';

describe('OverlayRenderer', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
    });

    it('should inject styles into document head', () => {
        const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
        renderer.injectStyles();
        const style = document.head.querySelector('style');
        expect(style).not.toBeNull();
        expect(style.textContent).toContain('.fm-rating-overlay');
    });

    it('should inject styles only once per instance', () => {
        const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
        renderer.injectStyles();
        renderer.injectStyles();
        const styles = document.head.querySelectorAll('style');
        expect(styles).toHaveLength(1);
        expect(document.head.querySelector('#fm-overlay-styles')).not.toBeNull();
    });

    it('should update the existing style tag when injectStyles is called again', () => {
        const configLeft = new ConfigManager(
            createMockAdapter({ configGet: key => (key === 'overlayCorner' ? 'top-left' : undefined) })
        );
        const configRight = new ConfigManager(
            createMockAdapter({ configGet: key => (key === 'overlayCorner' ? 'top-right' : undefined) })
        );
        const rendererA = new OverlayRenderer(configLeft);
        const rendererB = new OverlayRenderer(configRight);

        rendererA.injectStyles();
        expect(document.head.querySelectorAll('style')).toHaveLength(1);
        expect(document.head.querySelector('#fm-overlay-styles').textContent).toContain('left:6px');

        rendererB.injectStyles();
        expect(document.head.querySelectorAll('style')).toHaveLength(1);
        expect(document.head.querySelector('#fm-overlay-styles').textContent).toContain('right:6px');
    });

    it('should use TOP_10_BADGE constant in injected CSS', () => {
        const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
        renderer.injectStyles();
        const style = document.head.querySelector('style');
        expect(style.textContent).toContain(`.${TOP_10_BADGE}`);
    });

    it('should include TOP_10_BADGE offset rule for left-side corners', () => {
        const config = new ConfigManager(
            createMockAdapter({ configGet: key => (key === 'overlayCorner' ? 'top-left' : undefined) })
        );
        const renderer = new OverlayRenderer(config);
        renderer.injectStyles();
        const style = document.head.querySelector('style');
        expect(style.textContent).toContain(`.${TOP_10_BADGE}`);
    });

    it('should not include TOP_10_BADGE offset rule for right-side corners', () => {
        const config = new ConfigManager(
            createMockAdapter({ configGet: key => (key === 'overlayCorner' ? 'top-right' : undefined) })
        );
        const renderer = new OverlayRenderer(config);
        renderer.injectStyles();
        const style = document.head.querySelector('style');
        expect(style.textContent).not.toContain(`.${TOP_10_BADGE}`);
    });

    it('should render an IMDb badge for a zero rating', () => {
        const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
        const container = document.createElement('div');
        document.body.appendChild(container);
        const title = new Title({ imdbId: 'tt1234567', rating: 0 });
        renderer.injectOverlay(container, title);
        const overlay = container.querySelector('.fm-rating-overlay');
        expect(overlay).not.toBeNull();
        // rating=0 renders as "0.0", not as N/A or absent
        expect(overlay.querySelector('.fm-value')).not.toBeNull();
        expect(overlay.textContent).toContain('0.0');
    });

    it('should render RT and MC badges for zero percent ratings', () => {
        const config = new ConfigManager(
            createMockAdapter({
                configGet: key => {
                    if (key === 'showRtRating') return true;
                    if (key === 'showMcRating') return true;
                    return undefined;
                },
            })
        );
        const renderer = new OverlayRenderer(config);
        const container = document.createElement('div');
        document.body.appendChild(container);
        const title = new Title({ imdbId: 'tt1234567', rating: 5, rtRating: 0, mcRating: 0 });
        renderer.injectOverlay(container, title);
        const overlay = container.querySelector('.fm-rating-overlay');
        expect(overlay).not.toBeNull();
        // rtRating=0 and mcRating=0 each format as "0%"
        const percentBadges = [...overlay.querySelectorAll('.fm-value')].filter(el => el.textContent === '0%');
        expect(percentBadges.length).toBe(2);
    });

    it('should include fade toggle CSS in injected styles', () => {
        const renderer = new OverlayRenderer(new ConfigManager(createMockAdapter()));
        renderer.injectStyles();
        const style = document.head.querySelector('style');
        expect(style.textContent).toContain('.fm-fade-toggle');
        expect(style.textContent).toContain('.fm-toggle-track');
        expect(style.textContent).toContain('.fm-toggle-knob');
    });
});
