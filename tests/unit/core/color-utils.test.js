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
        it('should parse red color', () => {
            const result = parseHex('#ff0000');
            expect(result).toEqual({ r: 255, g: 0, b: 0 });
        });

        it('should parse green color', () => {
            const result = parseHex('#00ff00');
            expect(result).toEqual({ r: 0, g: 255, b: 0 });
        });

        it('should parse blue color', () => {
            const result = parseHex('#0000ff');
            expect(result).toEqual({ r: 0, g: 0, b: 255 });
        });

        it('should parse white color', () => {
            const result = parseHex('#ffffff');
            expect(result).toEqual({ r: 255, g: 255, b: 255 });
        });

        it('should parse black color', () => {
            const result = parseHex('#000000');
            expect(result).toEqual({ r: 0, g: 0, b: 0 });
        });

        it('should parse mixed color', () => {
            const result = parseHex('#123456');
            expect(result).toEqual({ r: 0x12, g: 0x34, b: 0x56 });
        });
    });

    describe('rgbToHsl', () => {
        it('should convert red to HSL', () => {
            const result = rgbToHsl(255, 0, 0);
            expect(result.h).toBeCloseTo(0, 0.1);
            expect(result.s).toBeCloseTo(1, 0.01);
            expect(result.l).toBeCloseTo(0.5, 0.01);
        });

        it('should convert green to HSL', () => {
            const result = rgbToHsl(0, 255, 0);
            expect(result.h).toBeCloseTo(120, 0.1);
            expect(result.s).toBeCloseTo(1, 0.01);
            expect(result.l).toBeCloseTo(0.5, 0.01);
        });

        it('should convert blue to HSL', () => {
            const result = rgbToHsl(0, 0, 255);
            expect(result.h).toBeCloseTo(240, 0.1);
            expect(result.s).toBeCloseTo(1, 0.01);
            expect(result.l).toBeCloseTo(0.5, 0.01);
        });

        it('should convert yellow to HSL', () => {
            const result = rgbToHsl(255, 255, 0);
            expect(result.h).toBeCloseTo(60, 0.1);
            expect(result.s).toBeCloseTo(1, 0.01);
            expect(result.l).toBeCloseTo(0.5, 0.01);
        });

        it('should convert white to HSL', () => {
            const result = rgbToHsl(255, 255, 255);
            expect(result.h).toBe(0);
            expect(result.s).toBe(0);
            expect(result.l).toBeCloseTo(1, 0.01);
        });

        it('should convert black to HSL', () => {
            const result = rgbToHsl(0, 0, 0);
            expect(result.h).toBe(0);
            expect(result.s).toBe(0);
            expect(result.l).toBe(0);
        });
    });

    describe('hslToRgb', () => {
        it('should convert red HSL to RGB', () => {
            const result = hslToRgb(0, 1, 0.5);
            expect(result.r).toBe(255);
            expect(result.g).toBe(0);
            expect(result.b).toBe(0);
        });

        it('should convert green HSL to RGB', () => {
            const result = hslToRgb(120, 1, 0.5);
            expect(result.r).toBe(0);
            expect(result.g).toBe(255);
            expect(result.b).toBe(0);
        });

        it('should convert blue HSL to RGB', () => {
            const result = hslToRgb(240, 1, 0.5);
            expect(result.r).toBe(0);
            expect(result.g).toBe(0);
            expect(result.b).toBe(255);
        });

        it('should convert yellow HSL to RGB', () => {
            const result = hslToRgb(60, 1, 0.5);
            expect(result.r).toBe(255);
            expect(result.g).toBe(255);
            expect(result.b).toBe(0);
        });

        it('should convert white HSL to RGB', () => {
            const result = hslToRgb(0, 0, 1);
            expect(result.r).toBe(255);
            expect(result.g).toBe(255);
            expect(result.b).toBe(255);
        });

        it('should convert black HSL to RGB', () => {
            const result = hslToRgb(0, 0, 0);
            expect(result.r).toBe(0);
            expect(result.g).toBe(0);
            expect(result.b).toBe(0);
        });

        it('should handle zero saturation', () => {
            const result = hslToRgb(100, 0, 0.5);
            expect(result.r).toBeCloseTo(128, 1);
            expect(result.g).toBeCloseTo(128, 1);
            expect(result.b).toBeCloseTo(128, 1);
        });
    });

    describe('hueToRgb', () => {
        it('should return p for t < 0', () => {
            expect(hueToRgb(0.5, 1.0, -0.1)).toBeCloseTo(0.5, 0.001);
        });

        it('should return p for t > 1', () => {
            expect(hueToRgb(0.5, 1.0, 1.1)).toBeCloseTo(0.5, 0.001);
        });

        it('should return correct value for t in first sector', () => {
            const result = hueToRgb(0, 1, 0.1);
            expect(result).toBeCloseTo(0.6, 0.01);
        });

        it('should return q for t in second sector', () => {
            const result = hueToRgb(0, 1, 0.4);
            expect(result).toBeCloseTo(1, 0.001);
        });

        it('should return correct value for t in third sector', () => {
            const result = hueToRgb(0, 1, 0.7);
            expect(result).toBeCloseTo(0.4, 0.01);
        });
    });

    describe('interpolateColor', () => {
        it('should return start color at progress 0', () => {
            const result = interpolateColor(0, '#ff0000', '#00dd00');
            expect(result).toBe('rgb(255, 0, 0)');
        });

        it('should return end color at progress 1', () => {
            const result = interpolateColor(1, '#ff0000', '#00dd00');
            expect(result).toBe('rgb(0, 221, 0)');
        });

        it('should return valid rgb string at progress 0.5', () => {
            const result = interpolateColor(0.5, '#ff0000', '#00dd00');
            expect(result).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
        });

        it('should clamp RGB values to endpoint bounds', () => {
            const result = interpolateColor(0.5, '#ff0000', '#00dd00');
            // Parse the result to check values
            const match = result.match(/^rgb\((\d+), (\d+), (\d+)\)$/);
            expect(match).not.toBeNull();
            const r = parseInt(match[1], 10);
            const g = parseInt(match[2], 10);
            const b = parseInt(match[3], 10);

            // Clamped to [0, 255] and within endpoint bounds
            expect(r).toBeGreaterThanOrEqual(0);
            expect(r).toBeLessThanOrEqual(255);
            expect(g).toBeGreaterThanOrEqual(0);
            expect(g).toBeLessThanOrEqual(221); // Clamped to green's max
            expect(b).toBeGreaterThanOrEqual(0);
            expect(b).toBeLessThanOrEqual(0); // Both endpoints have b=0
        });

        it('should work with different color pairs', () => {
            const result = interpolateColor(0.5, '#ff0000', '#0000ff');
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
        it('should convert RGB to HSL and back for red', () => {
            const rgb = { r: 255, g: 0, b: 0 };
            const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
            const result = hslToRgb(hsl.h, hsl.s, hsl.l);
            expect(result.r).toBe(rgb.r);
            expect(result.g).toBe(rgb.g);
            expect(result.b).toBe(rgb.b);
        });

        it('should convert RGB to HSL and back for green', () => {
            const rgb = { r: 0, g: 255, b: 0 };
            const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
            const result = hslToRgb(hsl.h, hsl.s, hsl.l);
            expect(result.r).toBe(rgb.r);
            expect(result.g).toBe(rgb.g);
            expect(result.b).toBe(rgb.b);
        });

        it('should convert RGB to HSL and back for blue', () => {
            const rgb = { r: 0, g: 0, b: 255 };
            const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
            const result = hslToRgb(hsl.h, hsl.s, hsl.l);
            expect(result.r).toBe(rgb.r);
            expect(result.g).toBe(rgb.g);
            expect(result.b).toBe(rgb.b);
        });

        it('should convert RGB to HSL and back for white', () => {
            const rgb = { r: 255, g: 255, b: 255 };
            const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
            const result = hslToRgb(hsl.h, hsl.s, hsl.l);
            expect(result.r).toBe(rgb.r);
            expect(result.g).toBe(rgb.g);
            expect(result.b).toBe(rgb.b);
        });

        it('should convert RGB to HSL and back for black', () => {
            const rgb = { r: 0, g: 0, b: 0 };
            const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
            const result = hslToRgb(hsl.h, hsl.s, hsl.l);
            expect(result.r).toBe(rgb.r);
            expect(result.g).toBe(rgb.g);
            expect(result.b).toBe(rgb.b);
        });
    });
});
