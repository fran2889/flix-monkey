/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { describe, expect, it } from 'vitest';

import { interpolateColor } from '../../../../src/core/utils/index.js';

describe('Color Utilities', () => {
    describe('interpolateColor', () => {
        it.each([
            [0, '#ff0000', '#00dd00', 'rgb(255, 0, 0)'],
            [1, '#ff0000', '#00dd00', 'rgb(0, 221, 0)'],
        ])('should return %s at progress %d', (progress, start, end, expected) => {
            expect(interpolateColor(progress, start, end)).toBe(expected);
        });

        it('should return valid rgb string at progress 0.5', () => {
            const result = interpolateColor(0.5, '#ff0000', '#00dd00');
            expect(result).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
        });

        it('should clamp RGB values to endpoint bounds', () => {
            const result = interpolateColor(0.5, '#ff0000', '#00dd00');
            const match = result.match(/^rgb\((\d+), (\d+), (\d+)\)$/);
            expect(match).not.toBeNull();
            const r = parseInt(match![1], 10);
            const g = parseInt(match![2], 10);
            const b = parseInt(match![3], 10);

            expect(r).toBeGreaterThanOrEqual(0);
            expect(r).toBeLessThanOrEqual(255);
            expect(g).toBeGreaterThanOrEqual(0);
            expect(g).toBeLessThanOrEqual(221);
            expect(b).toBeGreaterThanOrEqual(0);
            expect(b).toBeLessThanOrEqual(0);
        });

        it.each([
            ['red to blue', '#ff0000', '#0000ff'],
            ['red to green', '#ff0000', '#00dd00'],
        ])('should work with %s color pairs', (_desc, start, end) => {
            const result = interpolateColor(0.5, start, end);
            expect(result).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
        });

        it('should return gradient color for progress between 0 and 1', () => {
            const result1 = interpolateColor(0.25, '#ff0000', '#00dd00');
            const result2 = interpolateColor(0.75, '#ff0000', '#00dd00');

            expect(result1).not.toBe(result2);
            expect(result1).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
            expect(result2).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
        });

        // Magenta sits at hue 300, so starting there exercises both hue wraparound
        // branches that red-to-green interpolation never reaches.
        it('should resolve a start hue above 240 without wrapping to the wrong color', () => {
            expect(interpolateColor(0, '#ff00ff', '#00dd00')).toBe('rgb(255, 0, 255)');
            expect(interpolateColor(1, '#ff00ff', '#00dd00')).toBe('rgb(0, 221, 0)');
        });

        it.each([
            ['identical greys', '#808080', '#808080'],
            ['black to white', '#000000', '#ffffff'],
            ['black to grey', '#000000', '#808080'],
        ])('should handle achromatic endpoints for %s', (_desc, start, end) => {
            const result = interpolateColor(0.5, start, end);
            const match = result.match(/\d+/g);
            expect(match).not.toBeNull();
            const [r, g, b] = match!.map(Number);

            // Achromatic interpolation must stay grey rather than picking up a hue.
            expect(r).toBe(g);
            expect(g).toBe(b);
        });
    });
});
