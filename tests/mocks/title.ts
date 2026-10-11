/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { Title } from '../../src/core/title';

function buildTitle() {
    // Default all Title fields to null for consistency
    const props: {
        displayTitle: string | null;
        apiTitle: string | null;
        imdbId: string | null;
        imdbRating: string | number | null;
        imdbVotes: string | number | null;
        rtRating: string | number | null;
        mcRating: string | number | null;
        year: string | number | null;
        source: string | null;
        type: string | null;
    } = {
        displayTitle: null,
        apiTitle: null,
        imdbId: null,
        imdbRating: null,
        imdbVotes: null,
        rtRating: null,
        mcRating: null,
        year: null,
        source: null,
        type: null,
    };
    return {
        withDisplayTitle(value: string | null) {
            props.displayTitle = value;
            return this;
        },
        withApiTitle(value: string | null) {
            props.apiTitle = value;
            return this;
        },
        withImdbId(value: string | null) {
            props.imdbId = value;
            return this;
        },
        withImdbRating(value: string | number | null) {
            props.imdbRating = value;
            return this;
        },
        withImdbVotes(value: string | number | null) {
            props.imdbVotes = value;
            return this;
        },
        withRtRating(value: string | number | null) {
            props.rtRating = value;
            return this;
        },
        withMcRating(value: string | number | null) {
            props.mcRating = value;
            return this;
        },
        withYear(value: string | number | null) {
            props.year = value;
            return this;
        },
        withSource(value: string | null) {
            props.source = value;
            return this;
        },
        withType(value: string | null) {
            props.type = value;
            return this;
        },
        build() {
            return new Title(props);
        },
    };
}

// Static presets
buildTitle.ratedMovie = () => {
    return buildTitle()
        .withApiTitle('Test Movie')
        .withDisplayTitle('Test Movie')
        .withImdbId('tt1234567')
        .withImdbRating(7.5)
        .withYear(2024)
        .withSource('agregarr')
        .build();
};

buildTitle.unrated = () => {
    return buildTitle()
        .withApiTitle('Unrated Movie')
        .withDisplayTitle('Unrated Movie')
        .withImdbId('tt9999999')
        .withImdbRating(null)
        .withRtRating(null)
        .withMcRating(null)
        .withYear(2024)
        .withSource('agregarr')
        .build();
};

buildTitle.missingImdbId = () => {
    return buildTitle()
        .withApiTitle('No ID Movie')
        .withDisplayTitle('No ID Movie')
        .withImdbId(null)
        .withImdbRating(7.0)
        .withYear(2024)
        .withSource('agregarr')
        .build();
};

// Parametrized presets
buildTitle.withRating = (rating: string | number | null) => {
    return buildTitle()
        .withImdbId('tt1234567')
        .withImdbRating(rating)
        .withApiTitle('Rated Movie')
        .withDisplayTitle('Rated Movie')
        .build();
};

function extractFromObj(obj: Record<string, unknown> | null | undefined, key: string): unknown {
    return obj?.[key];
}

buildTitle.fromCacheJSON = (json: unknown) => {
    const obj = json as Record<string, unknown> | null;
    if (!obj) return null;
    return new Title({
        apiTitle: (extractFromObj(obj, 'apiTitle') as string | null) ?? null,
        displayTitle: (extractFromObj(obj, 'displayTitle') as string | null) ?? null,
        imdbId: (extractFromObj(obj, 'imdbId') as string | null) ?? null,
        imdbRating: (extractFromObj(obj, 'imdbRating') as string | number | null) ?? null,
        imdbVotes: (extractFromObj(obj, 'imdbVotes') as string | number | null) ?? null,
        rtRating: (extractFromObj(obj, 'rtRating') as string | number | null) ?? null,
        mcRating: (extractFromObj(obj, 'mcRating') as string | number | null) ?? null,
        year: (extractFromObj(obj, 'year') as string | number | null) ?? null,
        source: (extractFromObj(obj, 'source') as string | null) ?? null,
        type: (extractFromObj(obj, 'type') as string | null) ?? null,
    });
};

export { buildTitle };
