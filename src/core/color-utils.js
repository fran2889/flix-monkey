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

/**
 * Parse hex color string to RGB object.
 *
 * @param {string} hex - Hex color string with leading # (e.g., '#ff0000')
 * @returns {{r: number, g: number, b: number}} RGB object with values 0-255
 */
export function parseHex(hex) {
    return {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16),
    };
}

/**
 * Convert RGB color values to HSL color space.
 *
 * @param {number} r - Red component (0-255)
 * @param {number} g - Green component (0-255)
 * @param {number} b - Blue component (0-255)
 * @returns {{h: number, s: number, l: number}} HSL object (h: 0-360, s: 0-1, l: 0-1)
 */
export function rgbToHsl(r, g, b) {
    const rf = r / 255;
    const gf = g / 255;
    const bf = b / 255;

    const max = Math.max(rf, gf, bf);
    const min = Math.min(rf, gf, bf);
    const delta = max - min;

    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (delta !== 0) {
        s = l < 0.5 ? delta / (max + min) : delta / (2 - max - min);

        if (max === rf) {
            h = ((gf - bf) / delta) % 6;
        } else if (max === gf) {
            h = (bf - rf) / delta + 2;
        } else {
            h = (rf - gf) / delta + 4;
        }

        h = h * 60;
        if (h < 0) h += 360;
    }

    return { h, s, l };
}

/**
 * Convert HSL color values to RGB color space.
 *
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-1)
 * @param {number} l - Lightness (0-1)
 * @returns {{r: number, g: number, b: number}} RGB object with values 0-255
 */
export function hslToRgb(h, s, l) {
    if (s === 0) {
        const val = Math.round(l * 255);
        return { r: val, g: val, b: val };
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    const hk = h / 360;
    const tr = hueToRgb(p, q, hk + 1 / 3);
    const tg = hueToRgb(p, q, hk);
    const tb = hueToRgb(p, q, hk - 1 / 3);

    return {
        r: Math.round(tr * 255),
        g: Math.round(tg * 255),
        b: Math.round(tb * 255),
    };
}

/**
 * Helper function for HSL to RGB conversion.
 *
 * @param {number} p - First parameter
 * @param {number} q - Second parameter
 * @param {number} t - Third parameter (0-1)
 * @returns {number} RGB component value (0-1)
 */
export function hueToRgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
}

/**
 * Interpolate between two hex colors using HSL color space.
 * Produces smoother gradients that pass through true yellow when going from red to green.
 * RGB values are clamped to stay within the bounds of the endpoint colors.
 *
 * @param {number} progress - Interpolation progress (0 = start, 1 = end)
 * @param {string} startHex - Starting color as hex string (e.g., '#ff0000')
 * @param {string} endHex - Ending color as hex string (e.g., '#00dd00')
 * @returns {string} RGB color string in format 'rgb(r, g, b)'
 */
export function interpolateColor(progress, startHex, endHex) {
    const startRgb = parseHex(startHex);
    const endRgb = parseHex(endHex);

    const startHsl = rgbToHsl(startRgb.r, startRgb.g, startRgb.b);
    const endHsl = rgbToHsl(endRgb.r, endRgb.g, endRgb.b);

    // Interpolate in HSL space
    const h = startHsl.h + (endHsl.h - startHsl.h) * progress;
    const s = startHsl.s + (endHsl.s - startHsl.s) * progress;
    const l = startHsl.l + (endHsl.l - startHsl.l) * progress;

    // Convert back to RGB
    const rgb = hslToRgb(h, s, l);

    // Clamp RGB values to stay within endpoint color bounds
    const clampedR = Math.max(Math.min(rgb.r, Math.max(startRgb.r, endRgb.r)), Math.min(startRgb.r, endRgb.r));
    const clampedG = Math.max(Math.min(rgb.g, Math.max(startRgb.g, endRgb.g)), Math.min(startRgb.g, endRgb.g));
    const clampedB = Math.max(Math.min(rgb.b, Math.max(startRgb.b, endRgb.b)), Math.min(startRgb.b, endRgb.b));

    return `rgb(${clampedR}, ${clampedG}, ${clampedB})`;
}
