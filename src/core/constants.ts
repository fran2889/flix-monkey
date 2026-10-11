/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

export const DAYS_TO_MS: number = 24 * 60 * 60 * 1000;
export const CACHE_TTL_INFINITE: number = -1;
export const DECORATION_DEBOUNCE_MS: number = 250;
export const AUTOSAVE_DEBOUNCE_MS: number = 1000;
export const HOVER_ACTION_DELAY_MS: number = 1000;
export const IDLE_CALLBACK_TIMEOUT_MS: number = 2000;
export const INFLIGHT_TIMEOUT_MS: number = 30_000;
export const CLIENT_DISABLE_DURATION: number = 60 * 60 * 1000; // 1 hour
export const DEFAULT_FETCH_TIMEOUT: number = 8000;

export const ApiSource = Object.freeze({
    XMDB: 'xmdb',
    OMDB: 'omdb',
    AGREGARR: 'agregarr',
} as const);

export const RATING_COLOR_LOW_THRESHOLD: number = 5.0; // IMDb: <=5.0, RT/MC: <=50%
export const RATING_COLOR_HIGH_THRESHOLD: number = 8.5; // IMDb: >=8.5, RT/MC: >=85%

export const RATING_COLOR_RED: string = '#ff0000';
export const RATING_COLOR_GREEN: string = '#00dd00';

export const TitleType = Object.freeze({
    MOVIE: 'movie',
    SERIES: 'series',
} as const);

// Type for ApiSource values
export type ApiSourceType = (typeof ApiSource)[keyof typeof ApiSource];

// Type for TitleType values
export type TitleTypeType = (typeof TitleType)[keyof typeof TitleType];
