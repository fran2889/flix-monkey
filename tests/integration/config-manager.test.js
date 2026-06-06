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
import { describe, it, expect, vi } from 'vitest';
import { ConfigManager } from '../../src/core/config-manager.js';
import { CONFIG_DEFAULTS } from '../../src/core/config-fields.js';
import { logger } from '../../src/core/logger.js';
import { createMockAdapter } from '../mocks/adapter.js';

describe('ConfigManager Integration', () => {
    describe('CONFIG_DEFAULTS integration', () => {
        it.each(Object.entries(CONFIG_DEFAULTS))('should return correct default for key "%s"', (key, expectedValue) => {
            const config = new ConfigManager(createMockAdapter());
            expect(config.get(key)).toBe(expectedValue);
        });
    });

    it('should handle errors in configGet and fall back', () => {
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
        const config = new ConfigManager(
            createMockAdapter({
                configGet: () => {
                    throw new Error('Adapter error');
                },
            })
        );
        expect(config.get('overlayCorner')).toBe(CONFIG_DEFAULTS.overlayCorner);
        expect(config.get('overlayCorner', 'top-left')).toBe('top-left');
        expect(warnSpy).toHaveBeenCalledWith(
            'ConfigManager.get error, using fallback',
            expect.objectContaining({ key: 'overlayCorner' })
        );
        warnSpy.mockRestore();
    });

    it('should fall back to CONFIG_DEFAULTS when configGet returns null', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => null }));
        expect(config.get('overlayCorner')).toBe(CONFIG_DEFAULTS.overlayCorner);
    });

    it('should handle non-string values from configGet', () => {
        const config = new ConfigManager(
            createMockAdapter({
                configGet: key => (key === 'someInt' ? 42 : key === 'someFloat' ? 1.5 : undefined),
            })
        );
        expect(config.getInt('someInt')).toBe(42);
        expect(config.getFloat('someFloat')).toBe(1.5);
    });

    it('should handle falsy but valid values (0 and empty string)', () => {
        const config = new ConfigManager(
            createMockAdapter({
                configGet: key => (key === 'zero' ? 0 : key === 'empty' ? '' : undefined),
            })
        );
        expect(config.get('zero')).toBe(0);
        expect(config.get('empty')).toBe('');
        expect(config.getInt('zero', 10)).toBe(0);
        expect(config.getFloat('zero', 10)).toBe(0);
    });
});
