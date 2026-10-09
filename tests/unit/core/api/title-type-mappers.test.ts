/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it } from 'vitest';

import {
    mapAgregarrTitleType,
    mapOmdbTitleType,
    mapXmdbTitleType,
} from '../../../../src/core/api/title-type-mappers.js';
import { TitleType } from '../../../../src/core/constants.js';

describe('mapXmdbTitleType', () => {
    it('should map Movie to MOVIE', () => {
        expect(mapXmdbTitleType('Movie')).toBe(TitleType.MOVIE);
    });

    it('should map TV Series to SERIES', () => {
        expect(mapXmdbTitleType('TV Series')).toBe(TitleType.SERIES);
    });

    it.each(['TV Mini Series', 'movie', 'MOVIE', 'tv series', 'Series'])(
        'should return null for unrecognised value %s',
        value => {
            expect(mapXmdbTitleType(value)).toBeNull();
        }
    );

    it('should return null for null', () => {
        expect(mapXmdbTitleType(null)).toBeNull();
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
        'should return null for unrecognised value %s',
        value => {
            expect(mapOmdbTitleType(value)).toBeNull();
        }
    );

    it('should return null for null', () => {
        expect(mapOmdbTitleType(null)).toBeNull();
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
        'should return null for unrecognised value %s',
        value => {
            expect(mapAgregarrTitleType(value)).toBeNull();
        }
    );

    it('should return null for null', () => {
        expect(mapAgregarrTitleType(null)).toBeNull();
    });
});
