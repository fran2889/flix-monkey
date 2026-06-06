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

describe('ConfigManager', () => {
    it('should return CONFIG_DEFAULTS when adapter returns undefined', () => {
        const config = new ConfigManager(createMockAdapter());
        expect(config.get('overlayCorner')).toBe(CONFIG_DEFAULTS.overlayCorner);
    });

    it('should return value from adapter.configGet', () => {
        const config = new ConfigManager(
            createMockAdapter({ configGet: key => (key === 'overlayCorner' ? 'bottom-right' : undefined) })
        );
        expect(config.get('overlayCorner')).toBe('bottom-right');
    });

    it('should return explicit fallback when adapter returns null', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => null }));
        expect(config.get('nonExistentKey', 'fallback')).toBe('fallback');
    });

    it('should parse integer via getInt', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => '42' }));
        expect(config.getInt('someInt', 0)).toBe(42);
    });

    it('should return fallback for invalid integer', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => 'not-a-number' }));
        expect(config.getInt('someInt', 10)).toBe(10);
    });

    it('should parse float via getFloat', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => '3.14' }));
        expect(config.getFloat('someFloat', 0)).toBe(3.14);
    });

    it('should return fallback for invalid float', () => {
        const config = new ConfigManager(createMockAdapter({ configGet: () => 'not-a-number' }));
        expect(config.getFloat('someFloat', 2.5)).toBe(2.5);
    });
});
