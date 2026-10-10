/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { CacheEntry } from '../../src/core/cache/index';
import type { Title } from '../../src/core/title';

type CacheEntryBuilder = {
    withDisplayTitle(_value: string): CacheEntryBuilder;
    withImdbId(_value: string | null): CacheEntryBuilder;
    withData(_value: Omit<Title, 'displayTitle'> | null): CacheEntryBuilder;
    withExpiry(_value: number | null): CacheEntryBuilder;
    build(): CacheEntry;
};

function buildCacheEntry(): CacheEntryBuilder {
    // Default all CacheEntry fields
    const props = {
        displayTitle: '',
        imdbId: null as string | null,
        data: null as Omit<Title, 'displayTitle'> | null,
        expires: null as number | null,
    };
    return {
        withDisplayTitle(_value: string): CacheEntryBuilder {
            props.displayTitle = _value;
            return this;
        },
        withImdbId(_value: string | null): CacheEntryBuilder {
            props.imdbId = _value;
            return this;
        },
        withData(_value: Omit<Title, 'displayTitle'> | null): CacheEntryBuilder {
            props.data = _value;
            return this;
        },
        withExpiry(_value: number | null): CacheEntryBuilder {
            props.expires = _value;
            return this;
        },
        build(): CacheEntry {
            return new CacheEntry(props.displayTitle, props.imdbId, props.data, props.expires);
        },
    };
}

// Static presets
buildCacheEntry.expired = (): CacheEntry => {
    return buildCacheEntry()
        .withDisplayTitle('Expired Movie')
        .withImdbId('tt1234567')
        .withData(null)
        .withExpiry(Date.now() - 1000)
        .build();
};

buildCacheEntry.indefinite = (): CacheEntry => {
    return buildCacheEntry()
        .withDisplayTitle('Indefinite Movie')
        .withImdbId('tt1234567')
        .withData(null)
        .withExpiry(null)
        .build();
};

// Parametrized presets
buildCacheEntry.withExpiry = (ms: number): CacheEntry => {
    return buildCacheEntry()
        .withDisplayTitle('Movie')
        .withImdbId('tt1234567')
        .withData(null)
        .withExpiry(Date.now() + ms)
        .build();
};

buildCacheEntry.fromTitle = (title: Title, expiryMs: number = 86400000): CacheEntry => {
    return buildCacheEntry()
        .withDisplayTitle(title.displayTitle ?? title.apiTitle ?? '')
        .withImdbId(title.imdbId ?? null)
        .withData(title.toCacheJSON())
        .withExpiry(Date.now() + expiryMs)
        .build();
};

export { buildCacheEntry };
