/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { ApiSource, type ApiSourceType } from './constants';

/**
 * Rate-limit policy and cross-tab synchronization for one API provider.
 */
export interface ProviderRateLimit {
    /** Minimum delay between dispatched requests in milliseconds. */
    readonly minIntervalMs: number;
    /** Storage key used to coordinate request timing across tabs. */
    readonly syncKey: string;
}

/**
 * Per-provider rate-limit policy and cross-tab synchronization keys.
 *
 * Keeping both values together ensures each provider's interval and storage
 * key are defined and changed as one unit.
 */
export const PROVIDER_RATE_LIMITS = Object.freeze({
    [ApiSource.XMDB]: { minIntervalMs: 1500, syncKey: 'fm_last_req_xmdb' },
    [ApiSource.OMDB]: { minIntervalMs: 250, syncKey: 'fm_last_req_omdb' },
    [ApiSource.AGREGARR]: { minIntervalMs: 250, syncKey: 'fm_last_req_agregarr' },
} satisfies Record<ApiSourceType, ProviderRateLimit>);
