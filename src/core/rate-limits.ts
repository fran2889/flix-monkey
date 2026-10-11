/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { ApiSource } from './constants';

/**
 * Rate limits in milliseconds for each API source.
 */
export interface RateLimits {
    [ApiSource.XMDB]: number;
    [ApiSource.OMDB]: number;
    [ApiSource.AGREGARR]: number;
}

export const RATE_LIMITS: RateLimits = Object.freeze({
    [ApiSource.XMDB]: 1500,
    [ApiSource.OMDB]: 250,
    [ApiSource.AGREGARR]: 250,
});
