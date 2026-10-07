/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Builds the IMDb URL for a title, falling back to an IMDb search when no
 * IMDb ID is known.
 *
 * @param {object} params - Title identifiers.
 * @param {string|null} [params.imdbId=null] - IMDb ID (e.g. `"tt1234567"`).
 * @param {string|null} params.displayTitle - Search term used when `imdbId` is absent.
 * @returns {string} IMDb title URL, or an IMDb search URL.
 */
export function buildImdbUrl({ imdbId = null, displayTitle }) {
    return imdbId
        ? `https://www.imdb.com/title/${imdbId}/`
        : `https://www.imdb.com/find/?q=${encodeURIComponent(displayTitle ?? '')}`;
}
