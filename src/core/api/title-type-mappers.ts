/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { TitleType, type TitleTypeType } from '../constants';

/**
 * Maps XMDb title type to canonical TitleType.
 *
 * @param apiValue - XMDb API title type value
 * @returns Canonical title type or undefined
 */
export function mapXmdbTitleType(apiValue: string | undefined): TitleTypeType | undefined {
    if (apiValue === 'Movie') return TitleType.MOVIE;
    if (apiValue === 'TV Series') return TitleType.SERIES;
    return undefined;
}

/**
 * Maps OMDb title type to canonical TitleType.
 *
 * @param apiValue - OMDb API title type value
 * @returns Canonical title type or undefined
 */
export function mapOmdbTitleType(apiValue: string | undefined): TitleTypeType | undefined {
    if (apiValue === 'movie') return TitleType.MOVIE;
    if (apiValue === 'series') return TitleType.SERIES;
    return undefined;
}

/**
 * Maps Agregarr title type to canonical TitleType.
 *
 * @param apiValue - Agregarr API title type value
 * @returns Canonical title type or undefined
 */
export function mapAgregarrTitleType(apiValue: string | undefined): TitleTypeType | undefined {
    if (apiValue === 'movie') return TitleType.MOVIE;
    if (apiValue === 'tvSeries' || apiValue === 'tvMiniSeries') return TitleType.SERIES;
    return undefined;
}
