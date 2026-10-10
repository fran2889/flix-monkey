/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { PlatformAdapter } from '../platform/adapter';
import { slugify } from './utils/index';

/**
 * Manages per-title ID overrides stored persistently.
 * Overrides allow users to correct search mismatches by specifying
 * the correct ID for a streaming service title.
 */
export class IdOverrideManager {
    #adapter: PlatformAdapter;
    #prefix = 'fm-idoverride:';

    /**
     * @param adapter - Platform adapter for storage.
     */
    constructor(adapter: PlatformAdapter) {
        this.#adapter = adapter;
    }

    /**
     * Retrieve stored ID override for a title.
     *
     * @param displayTitle - The streaming service display title
     * @returns The IMDb ID if override exists, null otherwise
     */
    async getImdbId(displayTitle: string): Promise<string | null> {
        const key = this.#getKey(displayTitle);
        const raw = await this.#adapter.storageGet(key);
        if (raw === null || raw === undefined) return null;
        try {
            const data = JSON.parse(raw as string);
            return (data as { imdbId?: string }).imdbId ?? null;
        } catch {
            return null;
        }
    }

    #getKey(displayTitle: string): string {
        return `${this.#prefix}${slugify(displayTitle)}`;
    }

    /**
     * Store ID override for a title.
     *
     * @param displayTitle - The streaming service display title
     * @param imdbId - The IMDb ID to store (e.g., "tt0133093")
     */
    async setImdbId(displayTitle: string, imdbId: string): Promise<void> {
        const key = this.#getKey(displayTitle);
        await this.#adapter.storageSet(key, JSON.stringify({ imdbId }));
    }
}
