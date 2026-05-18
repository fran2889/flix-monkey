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
import { ConfigManager } from '../../src/core/config-manager.js';
import { CONFIG_DEFAULTS } from '../../src/core/config-fields.js';

describe('ConfigManager Integration', () => {
    it('should integrate with CONFIG_DEFAULTS for all keys', () => {
        const config = new ConfigManager();
        Object.keys(CONFIG_DEFAULTS).forEach(key => {
            expect(config.get(key)).toBe(CONFIG_DEFAULTS[key]);
        });
    });

    it('should handle errors in the getter function and fall back', () => {
        const throwingGetter = () => {
            throw new Error('Adapter error');
        };
        const config = new ConfigManager(throwingGetter);

        // Should fall back to global default when getter throws
        expect(config.get('overlayCorner')).toBe(CONFIG_DEFAULTS.overlayCorner);
        // Should fall back to provided fallback when getter throws
        expect(config.get('overlayCorner', 'top-left')).toBe('top-left');
    });

    it('should handle null/undefined from getter and fall back to CONFIG_DEFAULTS', () => {
        const nullGetter = () => null;
        const config = new ConfigManager(nullGetter);
        expect(config.get('overlayCorner')).toBe(CONFIG_DEFAULTS.overlayCorner);
    });

    it('should handle non-string values from getter correctly', () => {
        const weirdGetter = key => {
            if (key === 'someInt') return 42;
            if (key === 'someFloat') return 1.5;
            return undefined;
        };
        const config = new ConfigManager(weirdGetter);
        expect(config.getInt('someInt')).toBe(42);
        expect(config.getFloat('someFloat')).toBe(1.5);
    });

    it('should handle falsy but valid values (like 0 or empty string)', () => {
        const falsyGetter = key => {
            if (key === 'zero') return 0;
            if (key === 'empty') return '';
            return undefined;
        };
        const config = new ConfigManager(falsyGetter);
        expect(config.get('zero')).toBe(0);
        expect(config.get('empty')).toBe('');
        expect(config.getInt('zero', 10)).toBe(0);
        expect(config.getFloat('zero', 10)).toBe(0);
    });
});
