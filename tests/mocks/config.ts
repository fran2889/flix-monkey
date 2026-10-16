/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { ConfigKey } from '../../src/core/config/config-manager';
import { CONFIG_DEFAULTS, ConfigManager } from '../../src/core/config/index';
import { buildMockAdapter } from './adapter';
import { buildLogger } from './logger';

function buildConfig() {
    // Leave every config field unset so ConfigManager falls back to the default
    const overrides: Record<ConfigKey, string | number | boolean | undefined> = {
        apiClient: undefined,
        xmdbApiKey: undefined,
        omdbApiKey: undefined,
        overlayCorner: undefined,
        showRtRating: undefined,
        showMcRating: undefined,
        cacheTtlRatedOldYear: undefined,
        cacheTtlRatedNewYear: undefined,
        cacheTtlNoRating: undefined,
        enableFadeUnderRating: undefined,
        fadeRatingThreshold: undefined,
        enableFadeToggle: undefined,
        debug: undefined,
    } as Record<ConfigKey, string | number | boolean | undefined>;

    return {
        withApiClient(value: string | undefined) {
            overrides.apiClient = value;
            return this;
        },
        withXmdbApiKey(value: string | undefined) {
            overrides.xmdbApiKey = value;
            return this;
        },
        withOmdbApiKey(value: string | undefined) {
            overrides.omdbApiKey = value;
            return this;
        },
        withOverlayCorner(value: string | undefined) {
            overrides.overlayCorner = value;
            return this;
        },
        withShowRtRating(value: boolean | undefined) {
            overrides.showRtRating = value;
            return this;
        },
        withShowMcRating(value: boolean | undefined) {
            overrides.showMcRating = value;
            return this;
        },
        withCacheTtlRatedOldYear(value: string | number | undefined) {
            overrides.cacheTtlRatedOldYear = value;
            return this;
        },
        withCacheTtlRatedNewYear(value: string | number | undefined) {
            overrides.cacheTtlRatedNewYear = value;
            return this;
        },
        withCacheTtlNoRating(value: string | number | undefined) {
            overrides.cacheTtlNoRating = value;
            return this;
        },
        withEnableFadeUnderRating(value: boolean | undefined) {
            overrides.enableFadeUnderRating = value;
            return this;
        },
        withFadeRatingThreshold(value: string | number | undefined) {
            overrides.fadeRatingThreshold = value;
            return this;
        },
        withEnableFadeToggle(value: boolean | undefined) {
            overrides.enableFadeToggle = value;
            return this;
        },
        withDebug(value: boolean | undefined) {
            overrides.debug = value;
            return this;
        },
        build(): ConfigManager {
            return new ConfigManager(
                buildMockAdapter()
                    .withConfigGetReturning((key: string) =>
                        key in overrides ? overrides[key as ConfigKey] : CONFIG_DEFAULTS[key as ConfigKey]
                    )
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
