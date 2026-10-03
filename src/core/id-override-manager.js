/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { slugify } from './utils/index.js';

/**
 * Manages per-title ID overrides stored persistently.
 * Overrides allow users to correct search mismatches by specifying
 * the correct ID for a streaming service title.
 */
export class IdOverrideManager {
    #adapter;
    #prefix = 'fm-idoverride:';

    /**
     * @param {import('../platform/adapter.js').PlatformAdapter} adapter
     */
    constructor(adapter) {
        this.#adapter = adapter;
    }

    /**
     * Retrieve stored ID override for a title.
     *
     * @param {string} displayTitle - The streaming service display title
     * @returns {Promise<string|null>} The IMDb ID if override exists, null otherwise
     */
    async getImdbId(displayTitle) {
        const key = this.#getKey(displayTitle);
        const raw = await this.#adapter.storageGet(key);
        if (raw === null || raw === undefined) return null;
        try {
            const data = JSON.parse(raw);
            return data.imdbId || null;
        } catch {
            return null;
        }
    }

    #getKey(displayTitle) {
        return `${this.#prefix}${slugify(displayTitle)}`;
    }

    /**
     * Store ID override for a title.
     *
     * @param {string} displayTitle - The streaming service display title
     * @param {string} imdbId - The IMDb ID to store (e.g., "tt0133093")
     * @returns {Promise<void>}
     */
    async setImdbId(displayTitle, imdbId) {
        const key = this.#getKey(displayTitle);
        await this.#adapter.storageSet(key, JSON.stringify({ imdbId }));
    }
}
