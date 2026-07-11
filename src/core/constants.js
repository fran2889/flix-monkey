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

export const TOP_10_BADGE = 'title-card-top-10';

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
