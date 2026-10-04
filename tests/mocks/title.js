/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { Title } from '../../src/core/title.js';

function buildTitle() {
    // Default all Title fields to null for consistency
    const props = {
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
    const builder = {
        withDisplayTitle(value) {
            props.displayTitle = value;
            return this;
        },
        withApiTitle(value) {
            props.apiTitle = value;
            return this;
        },
        withImdbId(value) {
            props.imdbId = value;
            return this;
        },
        withImdbRating(value) {
            props.imdbRating = value;
            return this;
        },
        withImdbVotes(value) {
            props.imdbVotes = value;
            return this;
        },
        withRtRating(value) {
            props.rtRating = value;
            return this;
        },
        withMcRating(value) {
            props.mcRating = value;
            return this;
        },
        withYear(value) {
            props.year = value;
            return this;
        },
        withSource(value) {
            props.source = value;
            return this;
        },
        withType(value) {
            props.type = value;
            return this;
        },
        build() {
            return new Title(props);
        },
    };
    return builder;
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
buildTitle.withRating = rating => {
    return buildTitle()
        .withImdbId('tt1234567')
        .withImdbRating(rating)
        .withApiTitle('Rated Movie')
        .withDisplayTitle('Rated Movie')
        .build();
};

buildTitle.fromCacheJSON = json => {
    return buildTitle()
        .withApiTitle(json.apiTitle ?? null)
        .withDisplayTitle(json.displayTitle ?? null)
        .withImdbId(json.imdbId ?? null)
        .withImdbRating(json.imdbRating ?? null)
        .withImdbVotes(json.imdbVotes ?? null)
        .withRtRating(json.rtRating ?? null)
        .withMcRating(json.mcRating ?? null)
        .withYear(json.year ?? null)
        .withSource(json.source ?? null)
        .withType(json.type ?? null)
        .build();
};

export { buildTitle };
