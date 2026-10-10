/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { TitleType, type TitleTypeType } from '../constants';

/**
 * Maps XMDb title type to canonical TitleType.
 *
 * @param apiValue - XMDb API title type value
 * @returns Canonical title type or null
 */
export function mapXmdbTitleType(apiValue: string | null): TitleTypeType | null {
    if (apiValue === 'Movie') return TitleType.MOVIE;
    if (apiValue === 'TV Series') return TitleType.SERIES;
    return null;
}

/**
 * Maps OMDb title type to canonical TitleType.
 *
 * @param apiValue - OMDb API title type value
 * @returns Canonical title type or null
 */
export function mapOmdbTitleType(apiValue: string | null): TitleTypeType | null {
    if (apiValue === 'movie') return TitleType.MOVIE;
    if (apiValue === 'series') return TitleType.SERIES;
    return null;
}

/**
 * Maps Agregarr title type to canonical TitleType.
 *
 * @param apiValue - Agregarr API title type value
 * @returns Canonical title type or null
 */
export function mapAgregarrTitleType(apiValue: string | null): TitleTypeType | null {
    if (apiValue === 'movie') return TitleType.MOVIE;
    if (apiValue === 'tvSeries' || apiValue === 'tvMiniSeries') return TitleType.SERIES;
    return null;
}
