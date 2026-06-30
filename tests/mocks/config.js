/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
 */
import { ConfigManager } from '../../src/core/config-manager.js';
import { CONFIG_DEFAULTS, CONFIG_FIELDS } from '../../src/core/config-fields.js';
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
 * Creates a ConfigManager with a default fallback and specific overrides.
 * For keys not in overrides, returns CONFIG_DEFAULTS value.
 *
 * @param {Object} overrides - Object with key-value pairs to override defaults
 * @returns {ConfigManager} ConfigManager instance with specified overrides
 */
export function createConfig(overrides = {}) {
    return new ConfigManager(
        createMockAdapter({
            configGet: key => (key in overrides ? overrides[key] : undefined),
        })
    );
}

/**
 * Creates a ConfigManager that strictly uses CONFIG_DEFAULTS for all values.
 * Useful for tests that explicitly want to verify default behavior.
 */
export function createConfigWithDefaults() {
    return new ConfigManager(createMockAdapter());
}

export { CONFIG_DEFAULTS, CONFIG_FIELDS };
