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

    it('should return explicit fallback when adapter returns null', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => null }), createMockLogger());
        expect(config.get('nonExistentKey', 'fallback')).toBe('fallback');
    });

    it('should parse integer via getInt', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => '42' }), createMockLogger());
        expect(config.getInt('someInt', 0)).toBe(42);
    });

    it('should return fallback for invalid integer', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => 'not-a-number' }), createMockLogger());
        expect(config.getInt('someInt', 10)).toBe(10);
    });

    it('should parse float via getFloat', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => '3.14' }), createMockLogger());
        expect(config.getFloat('someFloat', 0)).toBe(3.14);
    });

    it('should return fallback for invalid float', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => 'not-a-number' }), createMockLogger());
        expect(config.getFloat('someFloat', 2.5)).toBe(2.5);
    });

    it('should call injected logger.warn when configGet throws', () => {
        const mockLogger = createMockLogger();
        const adapter = createMockAdapter({
            configGet: () => {
                throw new Error('oops');
            },
        });
        const config = new ConfigManager(adapter, mockLogger);
        config.get('someKey');
        expect(mockLogger.warn).toHaveBeenCalledWith(
            'ConfigManager.get error, using fallback',
            expect.objectContaining({ key: 'someKey' })
        );
    });

    it.each(Object.entries(CONFIG_DEFAULTS))('should return correct default for key "%s"', (key, expectedValue) => {
        const config = new ConfigManager(createMockAdapter(), createMockLogger());
        expect(config.get(key)).toBe(expectedValue);
    });

    it('should use explicit fallback when configGet throws', () => {
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
        expect(config.get('overlayCorner', 'top-left')).toBe('top-left');
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
            createMockAdapter({ configGet: key => (key === 'someInt' ? 42 : key === 'someFloat' ? 1.5 : undefined) }),
            createMockLogger()
        );
        expect(config.getInt('someInt')).toBe(42);
        expect(config.getFloat('someFloat')).toBe(1.5);
    });

    it('should handle falsy but valid values (0 and empty string)', () => {
        const config = new ConfigManager(
            createMockAdapter({ configGet: key => (key === 'zero' ? 0 : key === 'empty' ? '' : undefined) }),
            createMockLogger()
        );
        expect(config.get('zero')).toBe(0);
        expect(config.get('empty')).toBe('');
        expect(config.getInt('zero', 10)).toBe(0);
        expect(config.getFloat('zero', 10)).toBe(0);
    });

    it('should return 0 from getInt when both value and fallback are non-numeric', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => 'not-a-number' }), createMockLogger());
        const result = config.getInt('someKey');
        expect(typeof result).toBe('number');
        expect(result).toBe(0);
    });

    it('should return 0 from getFloat when both value and fallback are non-numeric', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => 'not-a-number' }), createMockLogger());
        const result = config.getFloat('someKey');
        expect(typeof result).toBe('number');
        expect(result).toBe(0);
    });

    it('should return numeric fallback from getInt when value is non-numeric', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => undefined }), createMockLogger());
        expect(config.getInt('someKey', 7)).toBe(7);
    });

    it('should return numeric fallback from getFloat when value is non-numeric', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => undefined }), createMockLogger());
        expect(config.getFloat('someKey', 1.5)).toBe(1.5);
    });
});
