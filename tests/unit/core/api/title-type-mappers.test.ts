/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it } from 'vitest';

import { mapAgregarrTitleType, mapOmdbTitleType, mapXmdbTitleType } from '../../../../src/core/api/title-type-mappers';
import { TitleType } from '../../../../src/core/constants';

describe('mapXmdbTitleType', () => {
    it('maps Movie to MOVIE', () => {
        expect(mapXmdbTitleType('Movie')).toBe(TitleType.MOVIE);
    });

    it('maps TV Series to SERIES', () => {
        expect(mapXmdbTitleType('TV Series')).toBe(TitleType.SERIES);
    });

    it.each(['TV Mini Series', 'movie', 'MOVIE', 'tv series', 'Series'])(
        'returns undefined for the unrecognised value %s',
        value => {
            expect(mapXmdbTitleType(value)).toBeUndefined();
        }
    );

    it('returns undefined for undefined', () => {
        expect(mapXmdbTitleType(undefined)).toBeUndefined();
    });
});

describe('mapOmdbTitleType', () => {
    it('maps movie to MOVIE', () => {
        expect(mapOmdbTitleType('movie')).toBe(TitleType.MOVIE);
    });

    it('maps series to SERIES', () => {
        expect(mapOmdbTitleType('series')).toBe(TitleType.SERIES);
    });

    it.each(['Movie', 'Series', 'MOVIE', 'TV Series', 'episode'])(
        'returns undefined for the unrecognised value %s',
        value => {
            expect(mapOmdbTitleType(value)).toBeUndefined();
        }
    );

    it('returns undefined for undefined', () => {
        expect(mapOmdbTitleType(undefined)).toBeUndefined();
    });
});

describe('mapAgregarrTitleType', () => {
    it.each(['movie', 'tvMovie', 'tvSpecial'])('maps %s to MOVIE', value => {
        expect(mapAgregarrTitleType(value)).toBe(TitleType.MOVIE);
    });

    it.each(['tvSeries', 'tvMiniSeries'])('maps %s to SERIES', value => {
        expect(mapAgregarrTitleType(value)).toBe(TitleType.SERIES);
    });

    it.each(['tvShow', 'Movie', 'series', 'tvShort', 'short', 'videoGame'])(
        'returns undefined for the unrecognised value %s',
        value => {
            expect(mapAgregarrTitleType(value)).toBeUndefined();
        }
    );

    it('returns undefined for undefined', () => {
        expect(mapAgregarrTitleType(undefined)).toBeUndefined();
    });
});
