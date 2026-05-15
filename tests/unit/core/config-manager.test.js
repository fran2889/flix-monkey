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
import { ConfigManager } from '../../../src/core/config-manager.js';
import { CONFIG_DEFAULTS } from '../../../src/core/config-fields.js';

describe('ConfigManager', () => {
    it('should use default values when no getter is provided', () => {
        const config = new ConfigManager();
        expect(config.get('overlayCorner')).toBe(CONFIG_DEFAULTS.overlayCorner);
    });

    it('should use provided getter function', () => {
        const getter = vi.fn().mockReturnValue('bottom-right');
        const config = new ConfigManager(getter);
        expect(config.get('overlayCorner')).toBe('bottom-right');
        expect(getter).toHaveBeenCalledWith('overlayCorner');
    });

    it('should use fallback when getter returns null/undefined', () => {
        const getter = vi.fn().mockReturnValue(null);
        const config = new ConfigManager(getter);
        expect(config.get('nonExistentKey', 'fallback')).toBe('fallback');
    });

    it('should handle integer conversion', () => {
        const getter = vi.fn().mockReturnValue('42');
        const config = new ConfigManager(getter);
        expect(config.getInt('someInt', 0)).toBe(42);
    });

    it('should return fallback for invalid integer', () => {
        const getter = vi.fn().mockReturnValue('not-a-number');
        const config = new ConfigManager(getter);
        expect(config.getInt('someInt', 10)).toBe(10);
    });

    it('should handle float conversion', () => {
        const getter = vi.fn().mockReturnValue('3.14');
        const config = new ConfigManager(getter);
        expect(config.getFloat('someFloat', 0)).toBe(3.14);
    });

    it('should return fallback for invalid float', () => {
        const getter = vi.fn().mockReturnValue('not-a-number');
        const config = new ConfigManager(getter);
        expect(config.getFloat('someFloat', 2.5)).toBe(2.5);
    });
});
