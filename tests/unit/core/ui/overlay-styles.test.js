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
            top10Selectors: [],
            top10Offset: '50%',
        });

        expect(css).toContain('bottom:6px;right:6px;');
        expect(css).toContain('flex-direction: column-reverse');
    });

    it('offsets configured Top 10 selectors on left corners', () => {
        const css = buildOverlayStyles({
            overlayClass: 'fm-rating-overlay',
            corner: 'top-left',
            top10Selectors: ['.ranked'],
            top10Offset: '30%',
        });

        expect(css).toContain('.ranked .fm-rating-overlay');
        expect(css).toContain('left: calc(30% + 6px)');
    });

    it('treats null Top 10 selectors as an empty list', () => {
        const css = buildOverlayStyles({
            overlayClass: 'fm-rating-overlay',
            corner: 'top-left',
            top10Selectors: null,
        });

        expect(css).not.toContain('left: calc(');
    });

    it('uses the default Top 10 offset when the configured offset is null', () => {
        const css = buildOverlayStyles({
            overlayClass: 'fm-rating-overlay',
            corner: 'top-left',
            top10Selectors: ['.ranked'],
            top10Offset: null,
        });

        expect(css).toContain('left: calc(50% + 6px)');
    });

    it.each([
        ['top-left', '50%'],
        ['bottom-left', '50%'],
        ['top-left', '30%'],
        ['bottom-left', '30%'],
    ])('offsets Top 10 selectors for %s corners', (corner, top10Offset) => {
        const css = buildOverlayStyles({
            overlayClass: 'fm-rating-overlay',
            corner,
            top10Selectors: ['.custom-top-10', '[data-uia="custom-ranked-card"]'],
            top10Offset,
        });

        expect(css).toContain('.custom-top-10 .fm-rating-overlay');
        expect(css).toContain('[data-uia="custom-ranked-card"] .fm-rating-overlay');
        expect(css).toContain(`left: calc(${top10Offset} + 6px)`);
    });

    it.each(['top-right', 'bottom-right'])('does not offset Top 10 selectors for %s corners', corner => {
        const css = buildOverlayStyles({
            overlayClass: 'fm-rating-overlay',
            corner,
            top10Selectors: ['.custom-top-10', '[data-uia="custom-ranked-card"]'],
        });

        expect(css).not.toContain('.custom-top-10 .fm-rating-overlay');
        expect(css).not.toContain('[data-uia="custom-ranked-card"] .fm-rating-overlay');
    });

    it('includes base overlay and fade toggle styles', () => {
        const css = buildOverlayStyles({ overlayClass: 'fm-rating-overlay', corner: 'top-left' });

        expect(css).toContain('.fm-rating-overlay > *');
        expect(css).toContain('pointer-events: none;');
        expect(css).toContain('pointer-events: auto;');
        expect(css).toContain('.fm-faded { opacity: 0.30; transition: opacity 0.2s; }');
        expect(css).toContain('.fm-rating-overlay .fm-fade-toggle');
        expect(css).toContain(':hover > .fm-rating-overlay .fm-fade-toggle');
    });
});
