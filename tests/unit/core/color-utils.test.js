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

import { describe, expect, it } from 'vitest';

import { hslToRgb, hueToRgb, interpolateColor, parseHex, rgbToHsl } from '../../../src/core/color-utils.js';

describe('Color Utilities', () => {
    describe('parseHex', () => {
        it.each([
            ['red', '#ff0000', { r: 255, g: 0, b: 0 }],
            ['green', '#00ff00', { r: 0, g: 255, b: 0 }],
            ['blue', '#0000ff', { r: 0, g: 0, b: 255 }],
            ['white', '#ffffff', { r: 255, g: 255, b: 255 }],
            ['black', '#000000', { r: 0, g: 0, b: 0 }],
            ['mixed', '#123456', { r: 0x12, g: 0x34, b: 0x56 }],
        ])('should parse %s', (_color, hex, expected) => {
            expect(parseHex(hex)).toEqual(expected);
        });
    });

    describe('rgbToHsl', () => {
        it.each([
            ['red', 255, 0, 0, 0, 1, 0.5],
            ['green', 0, 255, 0, 120, 1, 0.5],
            ['blue', 0, 0, 255, 240, 1, 0.5],
            ['yellow', 255, 255, 0, 60, 1, 0.5],
            ['white', 255, 255, 255, 0, 0, 1],
            ['black', 0, 0, 0, 0, 0, 0],
        ])('should convert %s to HSL', (_color, r, g, b, expectedH, expectedS, expectedL) => {
            const result = rgbToHsl(r, g, b);
            expect(result.h).toBeCloseTo(expectedH, 0.1);
            expect(result.s).toBeCloseTo(expectedS, 0.01);
            expect(result.l).toBeCloseTo(expectedL, 0.01);
        });
    });

    describe('hslToRgb', () => {
        it.each([
            ['red', 0, 1, 0.5, 255, 0, 0],
            ['green', 120, 1, 0.5, 0, 255, 0],
            ['blue', 240, 1, 0.5, 0, 0, 255],
            ['yellow', 60, 1, 0.5, 255, 255, 0],
            ['white', 0, 0, 1, 255, 255, 255],
            ['black', 0, 0, 0, 0, 0, 0],
            ['gray', 100, 0, 0.5, 128, 128, 128],
        ])('should convert %s HSL to RGB', (_color, h, s, l, er, eg, eb) => {
            const result = hslToRgb(h, s, l);
            expect(result.r).toBeCloseTo(er, 1);
            expect(result.g).toBeCloseTo(eg, 1);
            expect(result.b).toBeCloseTo(eb, 1);
        });
    });

    describe('hueToRgb', () => {
        it.each([
            ['t < 0 returns p', 0.5, 1.0, -0.1, 0.5, 0.001],
            ['t > 1 returns p', 0.5, 1.0, 1.1, 0.5, 0.001],
            ['t in first sector', 0, 1, 0.1, 0.6, 0.01],
            ['t in second sector returns q', 0, 1, 0.4, 1, 0.001],
            ['t in third sector', 0, 1, 0.7, 0.4, 0.01],
        ])('should %s', (_desc, p, q, t, expected, precision) => {
            expect(hueToRgb(p, q, t)).toBeCloseTo(expected, precision);
        });
    });

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
            const r = parseInt(match[1], 10);
            const g = parseInt(match[2], 10);
            const b = parseInt(match[3], 10);

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
    });

    describe('round-trip conversion', () => {
        it.each([
            ['gray', 128, 128, 128],
            ['pastel orange', 255, 165, 100],
            ['pastel green', 150, 255, 150],
            ['dark blue', 50, 50, 150],
            ['light pink', 255, 200, 220],
        ])('should convert RGB to HSL and back for %s', (_color, r, g, b) => {
            const hsl = rgbToHsl(r, g, b);
            const result = hslToRgb(hsl.h, hsl.s, hsl.l);
            expect(result.r).toBe(r);
            expect(result.g).toBe(g);
            expect(result.b).toBe(b);
        });
    });
});
