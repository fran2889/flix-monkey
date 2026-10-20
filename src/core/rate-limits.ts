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

/**
 * Per-provider storage keys for cross-tab request timing.
 *
 * Keeping these separate prevents one provider's traffic from throttling another
 * when multiple providers are queried for the same title.
 */
export const RATE_LIMIT_SYNC_KEYS = Object.freeze({
    [ApiSource.XMDB]: 'fm_last_req_xmdb',
    [ApiSource.OMDB]: 'fm_last_req_omdb',
    [ApiSource.AGREGARR]: 'fm_last_req_agregarr',
} as const);
