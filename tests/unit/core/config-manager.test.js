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
