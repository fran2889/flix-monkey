/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

export function parseHex(hex) {
    return {
        r: Number.parseInt(hex.slice(1, 3), 16),
        g: Number.parseInt(hex.slice(3, 5), 16),
        b: Number.parseInt(hex.slice(5, 7), 16),
    };
}

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

export function hueToRgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
}

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
