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
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '../../../src/core/logger.js';

describe('core/logger', () => {
    it('should log without crashing', () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        logger.warn('test warning');
        expect(spy).toHaveBeenCalledWith('[FlixMonkey] test warning');
        spy.mockRestore();
    });

    it('should handle multiple arguments', () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        logger.warn('test', { foo: 'bar' });
        expect(spy).toHaveBeenCalledWith('[FlixMonkey] test', { foo: 'bar' });
        spy.mockRestore();
    });

    it('should log errors', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        logger.error('test error');
        expect(spy).toHaveBeenCalledWith('[FlixMonkey] test error');
        spy.mockRestore();
    });

    it('should log info', () => {
        const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
        logger.info('test info');
        expect(spy).toHaveBeenCalledWith('[FlixMonkey] test info');
        spy.mockRestore();
    });
});
