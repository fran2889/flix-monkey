/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { CacheEntry } from '../../src/core/cache/index';
import type { Title, TitleData } from '../../src/core/title';

type CacheEntryBuilder = {
    withDisplayTitle(_value: string): CacheEntryBuilder;
    withImdbId(_value: string | undefined): CacheEntryBuilder;
    withData(_value: TitleData | undefined): CacheEntryBuilder;
    withExpiry(_value: number | undefined): CacheEntryBuilder;
    build(): CacheEntry;
};

function buildCacheEntry(): CacheEntryBuilder {
    // Default all CacheEntry fields
    const props = {
        displayTitle: '',
        imdbId: undefined as string | undefined,
        data: undefined as TitleData | undefined,
        expires: undefined as number | undefined,
    };
    return {
        withDisplayTitle(_value: string): CacheEntryBuilder {
            props.displayTitle = _value;
            return this;
        },
        withImdbId(_value: string | undefined): CacheEntryBuilder {
            props.imdbId = _value;
            return this;
        },
        withData(_value: TitleData | undefined): CacheEntryBuilder {
            props.data = _value;
            return this;
        },
        withExpiry(_value: number | undefined): CacheEntryBuilder {
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
        .withData(undefined)
        .withExpiry(Date.now() - 1000)
        .build();
};

buildCacheEntry.indefinite = (): CacheEntry => {
    return buildCacheEntry()
        .withDisplayTitle('Indefinite Movie')
        .withImdbId('tt1234567')
        .withData(undefined)
        .withExpiry(undefined)
        .build();
};

// Parametrized presets
buildCacheEntry.withExpiry = (ms: number): CacheEntry => {
    return buildCacheEntry()
        .withDisplayTitle('Movie')
        .withImdbId('tt1234567')
        .withData(undefined)
        .withExpiry(Date.now() + ms)
        .build();
};

buildCacheEntry.fromTitle = (title: Title, expiryMs: number = 86400000): CacheEntry => {
    return buildCacheEntry()
        .withDisplayTitle(title.displayTitle)
        .withImdbId(title.imdbId ?? undefined)
        .withData(title.toCacheJSON())
        .withExpiry(Date.now() + expiryMs)
        .build();
};

export { buildCacheEntry };
