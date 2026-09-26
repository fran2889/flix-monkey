/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it } from 'vitest';

import { buildOverlayStyles } from '../../../../src/core/ui/overlay-styles.js';

describe('buildOverlayStyles', () => {
    it('builds bottom-corner positioning and direction', () => {
        const css = buildOverlayStyles({
            overlayClass: 'fm-rating-overlay',
            corner: 'bottom-right',
        });

        expect(css).toContain('bottom:6px;right:6px;');
        expect(css).toContain('flex-direction: column-reverse');
    });

    it('includes base overlay and fade toggle styles', () => {
        const css = buildOverlayStyles({ overlayClass: 'fm-rating-overlay', corner: 'top-left' });

        expect(css).toContain('.fm-rating-overlay > *');
        expect(css).toContain('.fm-faded { opacity: 0.30; transition: opacity 0.2s; }');
        expect(css).toContain('.fm-rating-overlay .fm-fade-toggle');
        expect(css).toContain(':hover > .fm-rating-overlay .fm-fade-toggle');
    });

    it('keeps the overlay noninteractive while direct badges and links remain interactive', () => {
        const css = buildOverlayStyles({ overlayClass: 'fm-rating-overlay', corner: 'top-left' });

        expect(css).toMatch(/\.fm-rating-overlay\s*\{[^}]*pointer-events: none;/);
        expect(css).toMatch(/\.fm-rating-overlay > \*\s*\{[^}]*cursor: default;[^}]*pointer-events: auto;/);
    });
});
