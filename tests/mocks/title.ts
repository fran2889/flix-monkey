/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { Title } from '../../src/core/title';

function buildTitle() {
    // Default all optional Title fields to undefined for consistency
    const props: {
        displayTitle: string;
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
        displayTitle: 'Test Title',
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
        withDisplayTitle(value: string) {
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

export { buildTitle };
