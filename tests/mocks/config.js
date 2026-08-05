/**
 * SPDX-FileCopyrightText: 2026 Fran
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { CONFIG_DEFAULTS, CONFIG_FIELDS } from '../../src/core/config-fields.js';
import { ConfigManager } from '../../src/core/config-manager.js';
import { createMockAdapter } from './adapter.js';

/**
 * Boolean config keys that control optional features.
 * Used to create configs with all options enabled/disabled.
 */
const BOOLEAN_CONFIG_KEYS = CONFIG_FIELDS.filter(f => f.type === 'checkbox').map(f => f.key);

/**
 * Creates a ConfigManager with all boolean options set to true.
 * Useful for tests that need all optional features enabled.
 */
export function createConfigWithAllOptionsEnabled() {
    return new ConfigManager(
        createMockAdapter({
            configGet: key => (BOOLEAN_CONFIG_KEYS.includes(key) ? true : undefined),
        })
    );
}

/**
 * Creates a ConfigManager with all boolean options set to false.
 * Useful for tests that need all optional features disabled.
 */
export function createConfigWithAllOptionsDisabled() {
    return new ConfigManager(
        createMockAdapter({
            configGet: key => (BOOLEAN_CONFIG_KEYS.includes(key) ? false : undefined),
        })
    );
}

/**
 * Creates a ConfigManager with default values and optional overrides.
 * For keys not in overrides, returns CONFIG_DEFAULTS value.
 *
 * @param {Object} overrides - Object with key-value pairs to override defaults
 * @returns {ConfigManager} ConfigManager instance with specified overrides
 */
export function createConfig(overrides = {}) {
    return new ConfigManager(
        createMockAdapter({
            configGet: key => (key in overrides ? overrides[key] : CONFIG_DEFAULTS[key]),
        })
    );
}

export { CONFIG_DEFAULTS, CONFIG_FIELDS };
