/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it } from 'vitest';

import { mapAgregarrTitleType, mapOmdbTitleType, mapXmdbTitleType } from '../../../../src/core/api/title-type-mappers';
import { TitleType } from '../../../../src/core/constants';

describe('mapXmdbTitleType', () => {
    it('should map Movie to MOVIE', () => {
        expect(mapXmdbTitleType('Movie')).toBe(TitleType.MOVIE);
    });

    it('should map TV Series to SERIES', () => {
        expect(mapXmdbTitleType('TV Series')).toBe(TitleType.SERIES);
    });

    it.each(['TV Mini Series', 'movie', 'MOVIE', 'tv series', 'Series'])(
        'should return undefined for unrecognised value %s',
        value => {
            expect(mapXmdbTitleType(value)).toBeUndefined();
        }
    );

    it('should return undefined for undefined', () => {
        expect(mapXmdbTitleType(undefined)).toBeUndefined();
    });
});

describe('mapOmdbTitleType', () => {
    it('should map movie to MOVIE', () => {
        expect(mapOmdbTitleType('movie')).toBe(TitleType.MOVIE);
    });

    it('should map series to SERIES', () => {
        expect(mapOmdbTitleType('series')).toBe(TitleType.SERIES);
    });

    it.each(['Movie', 'Series', 'MOVIE', 'TV Series', 'episode'])(
        'should return undefined for unrecognised value %s',
        value => {
            expect(mapOmdbTitleType(value)).toBeUndefined();
        }
    );

    it('should return undefined for undefined', () => {
        expect(mapOmdbTitleType(undefined)).toBeUndefined();
    });
});

describe('mapAgregarrTitleType', () => {
    it('should map movie to MOVIE', () => {
        expect(mapAgregarrTitleType('movie')).toBe(TitleType.MOVIE);
    });

    it.each(['tvSeries', 'tvMiniSeries'])('should map %s to SERIES', value => {
        expect(mapAgregarrTitleType(value)).toBe(TitleType.SERIES);
    });

    it.each(['tvShow', 'Movie', 'series', 'tvMovie', 'videoGame'])(
        'should return undefined for unrecognised value %s',
        value => {
            expect(mapAgregarrTitleType(value)).toBeUndefined();
        }
    );

    it('should return undefined for undefined', () => {
        expect(mapAgregarrTitleType(undefined)).toBeUndefined();
    });
});
