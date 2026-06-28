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
import { Logger } from '../../../src/core/logger.js';

describe('core/logger', () => {
    function makeLogger(debugVal = false) {
        return new Logger({ configGet: key => (key === 'debug' ? debugVal : undefined) });
    }

    it('should log warn without crashing', () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        makeLogger().warn('test warning');
        expect(spy).toHaveBeenCalledWith('[FlixMonkey] test warning');
        spy.mockRestore();
    });

    it('should handle multiple arguments', () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        makeLogger().warn('test', { foo: 'bar' });
        expect(spy).toHaveBeenCalledWith('[FlixMonkey] test', { foo: 'bar' });
        spy.mockRestore();
    });

    it('should log errors', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        makeLogger().error('test error');
        expect(spy).toHaveBeenCalledWith('[FlixMonkey] test error');
        spy.mockRestore();
    });

    it('should log info', () => {
        const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
        makeLogger().info('test info');
        expect(spy).toHaveBeenCalledWith('[FlixMonkey] test info');
        spy.mockRestore();
    });

    it('should log debug when adapter returns true', () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        makeLogger(true).debug('test debug');
        expect(spy).toHaveBeenCalledWith('[FlixMonkey] test debug');
        spy.mockRestore();
    });

    it('should not log debug when adapter returns false', () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        makeLogger(false).debug('test debug');
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('should log debug when adapter returns string "true"', () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const logger = new Logger({ configGet: key => (key === 'debug' ? 'true' : undefined) });
        logger.debug('test debug from userscript');
        expect(spy).toHaveBeenCalledWith('[FlixMonkey] test debug from userscript');
        spy.mockRestore();
    });

    it('should not log debug when adapter returns string "false"', () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const logger = new Logger({ configGet: key => (key === 'debug' ? 'false' : undefined) });
        logger.debug('should not appear');
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('should log debug when adapter returns undefined (fresh install default)', () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const logger = new Logger({ configGet: () => undefined });
        logger.debug('fresh install debug');
        expect(spy).toHaveBeenCalledWith('[FlixMonkey] fresh install debug');
        spy.mockRestore();
    });

    it('should log debug when adapter returns null', () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const logger = new Logger({ configGet: () => null });
        logger.debug('null debug');
        expect(spy).toHaveBeenCalledWith('[FlixMonkey] null debug');
        spy.mockRestore();
    });
});
