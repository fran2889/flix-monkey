/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Options for building an IMDb URL.
 */
export interface BuildImdbUrlOptions {
    imdbId?: string | null;
    displayTitle: string | null;
}

/**
 * Builds the IMDb URL for a title, falling back to an IMDb search when no
 * IMDb ID is known.
 *
 * @param {BuildImdbUrlOptions} params - URL building options
 * @returns {string} IMDb title URL, or an IMDb search URL.
 */
export function buildImdbUrl({ imdbId = null, displayTitle }: BuildImdbUrlOptions): string {
    return imdbId
        ? `https://www.imdb.com/title/${imdbId}/`
        : `https://www.imdb.com/find/?q=${encodeURIComponent(displayTitle ?? '')}`;
}
