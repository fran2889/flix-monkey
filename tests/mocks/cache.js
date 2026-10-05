/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { CacheEntry } from '../../src/core/cache/index.js';

function buildCacheEntry() {
    // Default all CacheEntry fields to null for consistency
    const props = {
        displayTitle: null,
        imdbId: null,
        data: null,
        expires: null,
    };
    return {
        withDisplayTitle(value) {
            props.displayTitle = value;
            return this;
        },
        withImdbId(value) {
            props.imdbId = value;
            return this;
        },
        withData(value) {
            props.data = value;
            return this;
        },
        withExpiry(value) {
            props.expires = value;
            return this;
        },
        build() {
            return new CacheEntry(props.displayTitle, props.imdbId, props.data, props.expires);
        },
    };
}

// Static presets
buildCacheEntry.expired = () => {
    return buildCacheEntry()
        .withDisplayTitle('Expired Movie')
        .withImdbId('tt1234567')
        .withData(null)
        .withExpiry(Date.now() - 1000)
        .build();
};

buildCacheEntry.indefinite = () => {
    return buildCacheEntry()
        .withDisplayTitle('Indefinite Movie')
        .withImdbId('tt1234567')
        .withData(null)
        .withExpiry(null)
        .build();
};

// Parametrized presets
buildCacheEntry.withExpiry = ms => {
    return buildCacheEntry()
        .withDisplayTitle('Movie')
        .withImdbId('tt1234567')
        .withData(null)
        .withExpiry(Date.now() + ms)
        .build();
};

buildCacheEntry.fromTitle = (title, expiryMs = 86400000) => {
    return buildCacheEntry()
        .withDisplayTitle(title.displayTitle ?? title.apiTitle ?? null)
        .withImdbId(title.imdbId ?? null)
        .withData(title.toCacheJSON())
        .withExpiry(Date.now() + expiryMs)
        .build();
};

export { buildCacheEntry };
