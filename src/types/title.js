/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/** @typedef {'xmdb'|'omdb'|'agregarr'} ApiSourceValue */
/** @typedef {'movie'|'series'} TitleTypeValue */

/**
 * Options for creating a Title instance.
 * @typedef {Object} TitleOptions
 * @property {string|null} [displayTitle=null] - Title as shown by the streaming service.
 * @property {string|null} [apiTitle=null] - Canonical title returned by the API.
 * @property {string|null} [imdbId=null] - IMDb ID.
 * @property {number|string|null} [year=null] - Release year; coerced to integer.
 * @property {number|string|null} [imdbRating=null] - IMDb rating (0-10); coerced to float.
 * @property {number|string|null} [imdbVotes=null] - IMDb vote count; coerced to integer.
 * @property {number|string|null} [rtRating=null] - Rotten Tomatoes score (0-100); coerced to integer.
 * @property {number|string|null} [mcRating=null] - Metacritic score (0-100); coerced to integer.
 * @property {ApiSourceValue|null} [source=null] - API source.
 * @property {TitleTypeValue|null} [type=null] - Movie or series.
 */

export {};
