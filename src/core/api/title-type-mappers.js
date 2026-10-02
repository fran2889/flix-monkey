/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { TitleType } from '../constants.js';

/**
 * Parses ratings from API response arrays.
 *
 * @param {Array} ratings - Array of rating objects from API response
 * @param {RegExp} sourcePattern - Regular expression to match rating source name
 * @returns {number|null} Rating value or null if not found
 */
export function parseRatings(ratings, sourcePattern) {
    if (!Array.isArray(ratings)) return null;
    const entry = ratings.find(r => r && sourcePattern.test(r.source || r.Source));
    return entry?.value ?? entry?.Value ?? null;
}

/**
 * Maps XMDb title type to canonical TitleType.
 *
 * @param {string|null} apiValue - XMDb API title type value
 * @returns {typeof TitleType.MOVIE|typeof TitleType.SERIES|null} Canonical title type or null
 */
export function mapXmdbTitleType(apiValue) {
    if (apiValue === 'Movie') return TitleType.MOVIE;
    if (apiValue === 'TV Series') return TitleType.SERIES;
    return null;
}

/**
 * Maps OMDb title type to canonical TitleType.
 *
 * @param {string|null} apiValue - OMDb API title type value
 * @returns {typeof TitleType.MOVIE|typeof TitleType.SERIES|null} Canonical title type or null
 */
export function mapOmdbTitleType(apiValue) {
    if (apiValue === 'movie') return TitleType.MOVIE;
    if (apiValue === 'series') return TitleType.SERIES;
    return null;
}

/**
 * Maps Agregarr title type to canonical TitleType.
 *
 * @param {string|null} apiValue - Agregarr API title type value
 * @returns {typeof TitleType.MOVIE|typeof TitleType.SERIES|null} Canonical title type or null
 */
export function mapAgregarrTitleType(apiValue) {
    if (apiValue === 'movie') return TitleType.MOVIE;
    if (apiValue === 'tvSeries' || apiValue === 'tvMiniSeries') return TitleType.SERIES;
    return null;
}
