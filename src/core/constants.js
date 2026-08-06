/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
export const DAYS_TO_MS = 24 * 60 * 60 * 1000;
export const CACHE_TTL_INFINITE = -1;
export const DECORATION_DEBOUNCE_MS = 250;
export const INFLIGHT_TIMEOUT_MS = 30_000;
export const CLIENT_DISABLE_DURATION = 60 * 60 * 1000; // 1 hour
export const DEFAULT_FETCH_TIMEOUT = 8000;

export const ApiSource = Object.freeze({
    XMDB: 'xmdb',
    OMDB: 'omdb',
    AGREGARR: 'agregarr',
});

// Rating color thresholds
export const RATING_COLOR_LOW_THRESHOLD = 5.0; // IMDb: \u22645.0, RT/MC: \u226450%
export const RATING_COLOR_HIGH_THRESHOLD = 8.5; // IMDb: \u22659.0, RT/MC: \u226590%

// Rating colors
export const RATING_COLOR_RED = '#ff0000'; // Pure red
export const RATING_COLOR_GREEN = '#00dd00'; // Dark green

export const TitleType = Object.freeze({
    MOVIE: 'movie',
    SERIES: 'series',
});
