/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/** @typedef {'xmdb'|'omdb'|'agregarr'} ApiSourceValue */
/** @typedef {'movie'|'series'} TitleTypeValue */

/**
 * Options for creating a Title instance.
 * @typedef {object} TitleOptions
 * @property {readonly string|null} [displayTitle=null] - Title as shown by the streaming service.
 * @property {readonly string|null} [apiTitle=null] - Canonical title returned by the API.
 * @property {readonly string|null} [imdbId=null] - IMDb ID.
 * @property {readonly number|string|null} [year=null] - Release year; coerced to integer.
 * @property {readonly number|string|null} [imdbRating=null] - IMDb rating (0-10); coerced to float.
 * @property {readonly number|string|null} [imdbVotes=null] - IMDb vote count; coerced to integer.
 * @property {readonly number|string|null} [rtRating=null] - Rotten Tomatoes score (0-100); coerced to integer.
 * @property {readonly number|string|null} [mcRating=null] - Metacritic score (0-100); coerced to integer.
 * @property {readonly ApiSourceValue|null} [source=null] - API source.
 * @property {readonly TitleTypeValue|null} [type=null] - Movie or series.
 */

export {};
