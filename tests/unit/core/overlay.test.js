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

describe('OverlayRenderer', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
    });

    it('should inject styles into document head', () => {
        const renderer = new OverlayRenderer(new ConfigManager());
        renderer.injectStyles();
        const style = document.head.querySelector('style');
        expect(style).not.toBeNull();
        expect(style.textContent).toContain('.fm-rating-overlay');
    });

    it('should inject styles only once per instance', () => {
        const renderer = new OverlayRenderer(new ConfigManager());
        renderer.injectStyles();
        renderer.injectStyles();
        const styles = document.head.querySelectorAll('style');
        expect(styles).toHaveLength(1);
    });

    it('should allow two separate instances to each inject styles independently', () => {
        const rendererA = new OverlayRenderer(new ConfigManager());
        const rendererB = new OverlayRenderer(new ConfigManager());

        rendererA.injectStyles();
        expect(document.head.querySelectorAll('style')).toHaveLength(1);

        rendererB.injectStyles();
        expect(document.head.querySelectorAll('style')).toHaveLength(2);
    });

    it('should use TOP_10_BADGE constant in injected CSS', () => {
        const renderer = new OverlayRenderer(new ConfigManager());
        renderer.injectStyles();
        const style = document.head.querySelector('style');
        expect(style.textContent).toContain(`.${TOP_10_BADGE}`);
    });

    it('should include TOP_10_BADGE offset rule only for left-side corners', () => {
        const leftConfig = new ConfigManager(key => (key === 'overlayCorner' ? 'top-left' : undefined));
        const leftRenderer = new OverlayRenderer(leftConfig);
        leftRenderer.injectStyles();
        const leftStyle = document.head.querySelector('style');
        expect(leftStyle.textContent).toContain(`.${TOP_10_BADGE}`);

        document.head.innerHTML = '';

        const rightConfig = new ConfigManager(key => (key === 'overlayCorner' ? 'top-right' : undefined));
        const rightRenderer = new OverlayRenderer(rightConfig);
        rightRenderer.injectStyles();
        const rightStyle = document.head.querySelector('style');
        expect(rightStyle.textContent).not.toContain(`.${TOP_10_BADGE}`);
    });

    it('should not have a static resetInternalState method', () => {
        expect(OverlayRenderer.resetInternalState).toBeUndefined();
    });
});
