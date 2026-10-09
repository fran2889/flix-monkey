/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { CONFIG_DEFAULTS, ConfigManager } from '../../src/core/config/index.js';
import { buildMockAdapter } from './adapter.js';
import { buildLogger } from './logger.js';
import type { ConfigKey } from '../../src/core/config/config-manager.js';

function buildConfig() {
    // Default all config fields to null for consistency
    const overrides: Record<ConfigKey, string | number | boolean | null> = {
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
    } as Record<ConfigKey, string | number | boolean | null>;

    return {
        withApiClient(value: string | null) {
            overrides.apiClient = value;
            return this;
        },
        withXmdbApiKey(value: string | null) {
            overrides.xmdbApiKey = value;
            return this;
        },
        withOmdbApiKey(value: string | null) {
            overrides.omdbApiKey = value;
            return this;
        },
        withOverlayCorner(value: string | null) {
            overrides.overlayCorner = value;
            return this;
        },
        withShowRtRating(value: boolean | null) {
            overrides.showRtRating = value;
            return this;
        },
        withShowMcRating(value: boolean | null) {
            overrides.showMcRating = value;
            return this;
        },
        withCacheTtlRatedOldYear(value: string | number | null) {
            overrides.cacheTtlRatedOldYear = value;
            return this;
        },
        withCacheTtlRatedNewYear(value: string | number | null) {
            overrides.cacheTtlRatedNewYear = value;
            return this;
        },
        withCacheTtlNoRating(value: string | number | null) {
            overrides.cacheTtlNoRating = value;
            return this;
        },
        withEnableFadeUnderRating(value: boolean | null) {
            overrides.enableFadeUnderRating = value;
            return this;
        },
        withFadeRatingThreshold(value: string | number | null) {
            overrides.fadeRatingThreshold = value;
            return this;
        },
        withEnableFadeToggle(value: boolean | null) {
            overrides.enableFadeToggle = value;
            return this;
        },
        withDebug(value: boolean | null) {
            overrides.debug = value;
            return this;
        },
        build(): ConfigManager {
            return new ConfigManager(
                buildMockAdapter()
                    .withConfigGetReturning((key: string) => (key in overrides ? overrides[key as ConfigKey] : CONFIG_DEFAULTS[key as ConfigKey]))
                    .build(),
                buildLogger().build()
            );
        },
    };
}

// Static presets
buildConfig.allOptionsEnabled = (): ConfigManager => {
    return buildConfig()
        .withApiClient(CONFIG_DEFAULTS.apiClient as string)
        .withXmdbApiKey(CONFIG_DEFAULTS.xmdbApiKey as string)
        .withOmdbApiKey(CONFIG_DEFAULTS.omdbApiKey as string)
        .withShowRtRating(true)
        .withShowMcRating(true)
        .withEnableFadeUnderRating(true)
        .withFadeRatingThreshold(CONFIG_DEFAULTS.fadeRatingThreshold as string)
        .withEnableFadeToggle(true)
        .withDebug(true)
        .build();
};

buildConfig.allOptionsDisabled = (): ConfigManager => {
    return buildConfig()
        .withApiClient(CONFIG_DEFAULTS.apiClient as string)
        .withXmdbApiKey(CONFIG_DEFAULTS.xmdbApiKey as string)
        .withOmdbApiKey(CONFIG_DEFAULTS.omdbApiKey as string)
        .withShowRtRating(false)
        .withShowMcRating(false)
        .withEnableFadeUnderRating(false)
        .withFadeRatingThreshold(CONFIG_DEFAULTS.fadeRatingThreshold as string)
        .withEnableFadeToggle(false)
        .withDebug(false)
        .build();
};

buildConfig.ratingsEnabled = (): ConfigManager => {
    return buildConfig().withShowRtRating(true).withShowMcRating(true).build();
};

buildConfig.fadeEnabled = (threshold: string | number = 6.0): ConfigManager => {
    return buildConfig()
        .withEnableFadeUnderRating(true)
        .withFadeRatingThreshold(threshold)
        .withEnableFadeToggle(true)
        .build();
};

buildConfig.defaultCacheTtl = (): ConfigManager => {
    return buildConfig()
        .withCacheTtlRatedOldYear(CONFIG_DEFAULTS.cacheTtlRatedOldYear as string)
        .withCacheTtlRatedNewYear(CONFIG_DEFAULTS.cacheTtlRatedNewYear as string)
        .withCacheTtlNoRating(CONFIG_DEFAULTS.cacheTtlNoRating as string)
        .build();
};

// Parametrized presets
buildConfig.withCacheTtl = (ttl: string | number): ConfigManager => {
    return buildConfig().withCacheTtlRatedOldYear(ttl).withCacheTtlRatedNewYear(ttl).withCacheTtlNoRating(ttl).build();
};

buildConfig.withFadeThreshold = (threshold: string | number): ConfigManager => {
    return buildConfig()
        .withFadeRatingThreshold(threshold)
        .withEnableFadeUnderRating(true)
        .withEnableFadeToggle(true)
        .build();
};

export { buildConfig };
