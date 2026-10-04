/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { CONFIG_DEFAULTS, ConfigManager } from '../../src/core/config/index.js';
import { buildMockAdapter } from './adapter.js';
import { buildLogger } from './logger.js';

function buildConfig() {
    // Default all config fields to null for consistency
    const overrides = {
        apiClient: null,
        xmdbApiKey: null,
        omdbApiKey: null,
        overlayCorner: null,
        showRtRating: null,
        showMcRating: null,
        cacheTtlRatedOldYear: null,
        cacheTtlRatedNewYear: null,
        cacheTtlNoRating: null,
        enableFadeUnderRating: null,
        fadeRatingThreshold: null,
        enableFadeToggle: null,
        debug: null,
    };
    const builder = {
        withApiClient(value) {
            overrides.apiClient = value;
            return this;
        },
        withXmdbApiKey(value) {
            overrides.xmdbApiKey = value;
            return this;
        },
        withOmdbApiKey(value) {
            overrides.omdbApiKey = value;
            return this;
        },
        withOverlayCorner(value) {
            overrides.overlayCorner = value;
            return this;
        },
        withShowRtRating(value) {
            overrides.showRtRating = value;
            return this;
        },
        withShowMcRating(value) {
            overrides.showMcRating = value;
            return this;
        },
        withCacheTtlRatedOldYear(value) {
            overrides.cacheTtlRatedOldYear = value;
            return this;
        },
        withCacheTtlRatedNewYear(value) {
            overrides.cacheTtlRatedNewYear = value;
            return this;
        },
        withCacheTtlNoRating(value) {
            overrides.cacheTtlNoRating = value;
            return this;
        },
        withEnableFadeUnderRating(value) {
            overrides.enableFadeUnderRating = value;
            return this;
        },
        withFadeRatingThreshold(value) {
            overrides.fadeRatingThreshold = value;
            return this;
        },
        withEnableFadeToggle(value) {
            overrides.enableFadeToggle = value;
            return this;
        },
        withDebug(value) {
            overrides.debug = value;
            return this;
        },
        build() {
            return new ConfigManager(
                buildMockAdapter()
                    .withConfigGetReturning(key => (key in overrides ? overrides[key] : CONFIG_DEFAULTS[key]))
                    .build(),
                buildLogger().build()
            );
        },
    };
    return builder;
}

// Static presets
buildConfig.allOptionsEnabled = () => {
    return buildConfig()
        .withApiClient(CONFIG_DEFAULTS.apiClient)
        .withXmdbApiKey(CONFIG_DEFAULTS.xmdbApiKey)
        .withOmdbApiKey(CONFIG_DEFAULTS.omdbApiKey)
        .withShowRtRating(true)
        .withShowMcRating(true)
        .withEnableFadeUnderRating(true)
        .withFadeRatingThreshold(CONFIG_DEFAULTS.fadeRatingThreshold)
        .withEnableFadeToggle(true)
        .withDebug(true)
        .build();
};

buildConfig.allOptionsDisabled = () => {
    return buildConfig()
        .withApiClient(CONFIG_DEFAULTS.apiClient)
        .withXmdbApiKey(CONFIG_DEFAULTS.xmdbApiKey)
        .withOmdbApiKey(CONFIG_DEFAULTS.omdbApiKey)
        .withShowRtRating(false)
        .withShowMcRating(false)
        .withEnableFadeUnderRating(false)
        .withFadeRatingThreshold(CONFIG_DEFAULTS.fadeRatingThreshold)
        .withEnableFadeToggle(false)
        .withDebug(false)
        .build();
};

buildConfig.ratingsEnabled = () => {
    return buildConfig().withShowRtRating(true).withShowMcRating(true).build();
};

buildConfig.fadeEnabled = (threshold = 6.0) => {
    return buildConfig()
        .withEnableFadeUnderRating(true)
        .withFadeRatingThreshold(threshold)
        .withEnableFadeToggle(true)
        .build();
};

buildConfig.defaultCacheTtl = () => {
    return buildConfig()
        .withCacheTtlRatedOldYear(CONFIG_DEFAULTS.cacheTtlRatedOldYear)
        .withCacheTtlRatedNewYear(CONFIG_DEFAULTS.cacheTtlRatedNewYear)
        .withCacheTtlNoRating(CONFIG_DEFAULTS.cacheTtlNoRating)
        .build();
};

// Parametrized presets
buildConfig.withCacheTtl = ttl => {
    return buildConfig().withCacheTtlRatedOldYear(ttl).withCacheTtlRatedNewYear(ttl).withCacheTtlNoRating(ttl).build();
};

buildConfig.withFadeThreshold = threshold => {
    return buildConfig()
        .withFadeRatingThreshold(threshold)
        .withEnableFadeUnderRating(true)
        .withEnableFadeToggle(true)
        .build();
};

export { buildConfig };
