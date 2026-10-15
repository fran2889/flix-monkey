/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { Title } from '../../src/core/title';

function buildTitle() {
    // Default all Title fields to undefined for consistency
    const props: {
        displayTitle: string | undefined;
        apiTitle: string | undefined;
        imdbId: string | undefined;
        imdbRating: number | undefined;
        imdbVotes: number | undefined;
        rtRating: number | undefined;
        mcRating: number | undefined;
        year: number | undefined;
        source: string | undefined;
        type: string | undefined;
    } = {
        displayTitle: undefined,
        apiTitle: undefined,
        imdbId: undefined,
        imdbRating: undefined,
        imdbVotes: undefined,
        rtRating: undefined,
        mcRating: undefined,
        year: undefined,
        source: undefined,
        type: undefined,
    };
    return {
        withDisplayTitle(value: string | undefined) {
            props.displayTitle = value;
            return this;
        },
        withApiTitle(value: string | undefined) {
            props.apiTitle = value;
            return this;
        },
        withImdbId(value: string | undefined) {
            props.imdbId = value;
            return this;
        },
        withImdbRating(value: number | undefined) {
            props.imdbRating = value;
            return this;
        },
        withImdbVotes(value: number | undefined) {
            props.imdbVotes = value;
            return this;
        },
        withRtRating(value: number | undefined) {
            props.rtRating = value;
            return this;
        },
        withMcRating(value: number | undefined) {
            props.mcRating = value;
            return this;
        },
        withYear(value: number | undefined) {
            props.year = value;
            return this;
        },
        withSource(value: string | undefined) {
            props.source = value;
            return this;
        },
        withType(value: string | undefined) {
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
        .withImdbRating(undefined)
        .withRtRating(undefined)
        .withMcRating(undefined)
        .withYear(2024)
        .withSource('agregarr')
        .build();
};

buildTitle.missingImdbId = () => {
    return buildTitle()
        .withApiTitle('No ID Movie')
        .withDisplayTitle('No ID Movie')
        .withImdbId(undefined)
        .withImdbRating(7.0)
        .withYear(2024)
        .withSource('agregarr')
        .build();
};

// Parametrized presets
buildTitle.withRating = (rating: number | undefined) => {
    return buildTitle()
        .withImdbId('tt1234567')
        .withImdbRating(rating)
        .withApiTitle('Rated Movie')
        .withDisplayTitle('Rated Movie')
        .build();
};

function extractFromObj(obj: Record<string, unknown> | undefined, key: string): unknown {
    return obj?.[key];
}

buildTitle.fromCacheJSON = (json: unknown) => {
    const obj = json as Record<string, unknown> | undefined;
    if (!obj) return undefined;
    return new Title({
        apiTitle: (extractFromObj(obj, 'apiTitle') as string | undefined) ?? undefined,
        displayTitle: (extractFromObj(obj, 'displayTitle') as string | undefined) ?? undefined,
        imdbId: (extractFromObj(obj, 'imdbId') as string | undefined) ?? undefined,
        imdbRating: (extractFromObj(obj, 'imdbRating') as number | undefined) ?? undefined,
        imdbVotes: (extractFromObj(obj, 'imdbVotes') as number | undefined) ?? undefined,
        rtRating: (extractFromObj(obj, 'rtRating') as number | undefined) ?? undefined,
        mcRating: (extractFromObj(obj, 'mcRating') as number | undefined) ?? undefined,
        year: (extractFromObj(obj, 'year') as number | undefined) ?? undefined,
        source: (extractFromObj(obj, 'source') as string | undefined) ?? undefined,
        type: (extractFromObj(obj, 'type') as string | undefined) ?? undefined,
    });
};

export { buildTitle };
