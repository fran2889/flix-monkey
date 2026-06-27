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
import { describe, it, expect } from 'vitest';
import { ConfigManager } from '../../../src/core/config-manager.js';
import { CONFIG_DEFAULTS } from '../../../src/core/config-fields.js';
import { createMockAdapter } from '../../mocks/adapter.js';
import { createMockLogger } from '../../mocks/logger.js';

describe('ConfigManager', () => {
    it('should return CONFIG_DEFAULTS when adapter returns undefined', () => {
        const config = new ConfigManager(createMockAdapter(), createMockLogger());
        expect(config.get('overlayCorner')).toBe(CONFIG_DEFAULTS.overlayCorner);
    });

    it('should return value from adapter.configGet', () => {
        const config = new ConfigManager(
            createMockAdapter({ configGet: key => (key === 'overlayCorner' ? 'bottom-right' : undefined) }),
            createMockLogger()
        );
        expect(config.get('overlayCorner')).toBe('bottom-right');
    });

    it('should throw for unknown key', () => {
        const config = new ConfigManager(createMockAdapter(), createMockLogger());
        expect(() => config.get('nonExistentKey')).toThrow('ConfigManager: unknown config key "nonExistentKey"');
    });

    it('should parse integer via getInt', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => '42' }), createMockLogger());
        expect(config.getInt('cacheTtlNoRating')).toBe(42);
    });

    it('should return CONFIG_DEFAULTS value for invalid integer', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => 'not-a-number' }), createMockLogger());
        expect(config.getInt('cacheTtlNoRating')).toBe(Number.parseInt(CONFIG_DEFAULTS.cacheTtlNoRating, 10));
    });

    it('should parse float via getFloat', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => '3.14' }), createMockLogger());
        expect(config.getFloat('fadeRatingThreshold')).toBe(3.14);
    });

    it('should return CONFIG_DEFAULTS value for invalid float', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => 'not-a-number' }), createMockLogger());
        expect(config.getFloat('fadeRatingThreshold')).toBe(Number.parseFloat(CONFIG_DEFAULTS.fadeRatingThreshold));
    });

    it('should call injected logger.warn when configGet throws', () => {
        const mockLogger = createMockLogger();
        const adapter = createMockAdapter({
            configGet: () => {
                throw new Error('oops');
            },
        });
        const config = new ConfigManager(adapter, mockLogger);
        config.get('overlayCorner');
        expect(mockLogger.warn).toHaveBeenCalledWith(
            'ConfigManager.get error, using fallback',
            expect.objectContaining({ key: 'overlayCorner' })
        );
    });

    it.each(Object.entries(CONFIG_DEFAULTS))('should return correct default for key "%s"', (key, expectedValue) => {
        const config = new ConfigManager(createMockAdapter(), createMockLogger());
        expect(config.get(key)).toBe(expectedValue);
    });

    it('should use CONFIG_DEFAULTS when configGet throws', () => {
        const mockLogger = createMockLogger();
        const config = new ConfigManager(
            createMockAdapter({
                configGet: () => {
                    throw new Error('Adapter error');
                },
            }),
            mockLogger
        );
        expect(config.get('overlayCorner')).toBe(CONFIG_DEFAULTS.overlayCorner);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            'ConfigManager.get error, using fallback',
            expect.objectContaining({ key: 'overlayCorner' })
        );
    });

    it('should fall back to CONFIG_DEFAULTS when configGet returns null', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => null }), createMockLogger());
        expect(config.get('overlayCorner')).toBe(CONFIG_DEFAULTS.overlayCorner);
    });

    it('should handle non-string values from configGet', () => {
        const config = new ConfigManager(
            createMockAdapter({
                configGet: key => (key === 'cacheTtlNoRating' ? 42 : key === 'fadeRatingThreshold' ? 1.5 : undefined),
            }),
            createMockLogger()
        );
        expect(config.getInt('cacheTtlNoRating')).toBe(42);
        expect(config.getFloat('fadeRatingThreshold')).toBe(1.5);
    });

    it('should handle falsy but valid values (0 and empty string)', () => {
        const config = new ConfigManager(
            createMockAdapter({
                configGet: key => (key === 'cacheTtlNoRating' ? 0 : key === 'omdbApiKey' ? '' : undefined),
            }),
            createMockLogger()
        );
        expect(config.get('cacheTtlNoRating')).toBe(0);
        expect(config.get('omdbApiKey')).toBe('');
        expect(config.getInt('cacheTtlNoRating')).toBe(0);
        expect(config.getFloat('cacheTtlNoRating')).toBe(0);
    });

    it('should return CONFIG_DEFAULTS from getInt when value is non-numeric', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => 'not-a-number' }), createMockLogger());
        const result = config.getInt('cacheTtlNoRating');
        expect(typeof result).toBe('number');
        expect(result).toBe(Number.parseInt(CONFIG_DEFAULTS.cacheTtlNoRating, 10));
    });

    it('should return CONFIG_DEFAULTS from getFloat when value is non-numeric', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => 'not-a-number' }), createMockLogger());
        const result = config.getFloat('fadeRatingThreshold');
        expect(typeof result).toBe('number');
        expect(result).toBe(Number.parseFloat(CONFIG_DEFAULTS.fadeRatingThreshold));
    });

    it('getBool should return true for boolean true', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => true }), createMockLogger());
        expect(config.getBool('showRtRating')).toBe(true);
    });

    it('getBool should return false for boolean false', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => false }), createMockLogger());
        expect(config.getBool('showRtRating')).toBe(false);
    });

    it('getBool should return true for string "true"', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => 'true' }), createMockLogger());
        expect(config.getBool('showRtRating')).toBe(true);
    });

    it('getBool should return false for string "false"', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => 'false' }), createMockLogger());
        expect(config.getBool('showRtRating')).toBe(false);
    });

    it('getBool should use CONFIG_DEFAULTS when adapter returns null', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => null }), createMockLogger());
        expect(config.getBool('showRtRating')).toBe(CONFIG_DEFAULTS.showRtRating);
        expect(config.getBool('enableFadeUnderRating')).toBe(CONFIG_DEFAULTS.enableFadeUnderRating);
    });

    it('should return default when stored value is not in select options (overlayCorner)', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => 'invalid-corner' }), createMockLogger());
        expect(config.get('overlayCorner')).toBe(CONFIG_DEFAULTS.overlayCorner);
    });

    it('should return default when stored value is not in select options (apiClient)', () => {
        const config = new ConfigManager(
            createMockAdapter({ configGet: () => 'unknown-provider' }),
            createMockLogger()
        );
        expect(config.get('apiClient')).toBe(CONFIG_DEFAULTS.apiClient);
    });
});
