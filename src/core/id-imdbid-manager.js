/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { slugify } from './utils.js';

/**
 * Manages per-title IMDb ID overrides stored persistently.
 * Overrides allow users to correct search mismatches by specifying
 * the correct IMDb ID for a streaming service title.
 */
export class IdImdbIdManager {
    #adapter;
    #prefix = 'fm-imdbid:';

    /**
     * @param {import('../platform/adapter.js').PlatformAdapter} adapter
     */
    constructor(adapter) {
        this.#adapter = adapter;
    }

    /**
     * Retrieve stored IMDb ID override for a title.
     *
     * @param {string} displayTitle - The streaming service display title
     * @returns {Promise<string|null>} The IMDb ID if override exists, null otherwise
     */
    async getImdbId(displayTitle) {
        const key = this.#getKey(displayTitle);
        const raw = await this.#adapter.storageGet(key);
        if (raw === null || raw === undefined) return null;
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    /**
     * Store IMDb ID override for a title.
     *
     * @param {string} displayTitle - The streaming service display title
     * @param {string} imdbId - The IMDb ID to store (e.g., "tt0133093")
     * @returns {Promise<void>}
     */
    async setImdbId(displayTitle, imdbId) {
        const key = this.#getKey(displayTitle);
        await this.#adapter.storageSet(key, JSON.stringify(imdbId));
    }

    #getKey(displayTitle) {
        return `${this.#prefix}${slugify(displayTitle)}`;
    }
}
