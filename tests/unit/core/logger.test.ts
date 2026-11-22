/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it, vi } from 'vitest';

import { Logger } from '../../../src/core/logger';
import { buildMockAdapter } from '../../mocks/adapter';

describe('Logger', () => {
    function makeLogger(debugVal: boolean | string = false) {
        return new Logger(
            buildMockAdapter()
                .withConfigGetReturning((key: string) => (key === 'debug' ? debugVal : undefined))
                .build()
        );
    }

    it('writes a prefixed warning to the console', () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        makeLogger().warn('test warning');
        expect(spy).toHaveBeenCalledWith('[FlixMonkey] test warning');
        spy.mockRestore();
    });

    it('passes additional arguments through to the console', () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        makeLogger().warn('test', { foo: 'bar' });
        expect(spy).toHaveBeenCalledWith('[FlixMonkey] test', { foo: 'bar' });
        spy.mockRestore();
    });

    it('writes a prefixed error to the console', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        makeLogger().error('test error');
        expect(spy).toHaveBeenCalledWith('[FlixMonkey] test error');
        spy.mockRestore();
    });

    it('writes a prefixed info message to the console', () => {
        const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
        makeLogger().info('test info');
        expect(spy).toHaveBeenCalledWith('[FlixMonkey] test info');
        spy.mockRestore();
    });

    it('logs debug output when the adapter returns true', () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        makeLogger(true).debug('test debug');
        expect(spy).toHaveBeenCalledWith('[FlixMonkey] test debug');
        spy.mockRestore();
    });

    it('does not log debug output when the adapter returns false', () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        makeLogger(false).debug('test debug');
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('logs debug output when the adapter returns the string "true"', () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const logger = new Logger(
            buildMockAdapter()
                .withConfigGetReturning((key: string) => (key === 'debug' ? 'true' : undefined))
                .build()
        );
        logger.debug('test debug from userscript');
        expect(spy).toHaveBeenCalledWith('[FlixMonkey] test debug from userscript');
        spy.mockRestore();
    });

    it('does not log debug output when the adapter returns the string "false"', () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const logger = new Logger(
            buildMockAdapter()
                .withConfigGetReturning((key: string) => (key === 'debug' ? 'false' : undefined))
                .build()
        );
        logger.debug('should not appear');
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('logs debug output when the adapter returns undefined on a fresh install', () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const logger = new Logger(
            buildMockAdapter()
                .withConfigGetReturning(() => undefined)
                .build()
        );
        logger.debug('fresh install debug');
        expect(spy).toHaveBeenCalledWith('[FlixMonkey] fresh install debug');
        spy.mockRestore();
    });

    it('logs debug output when the adapter returns null', () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const logger = new Logger(
            buildMockAdapter()
                .withConfigGetReturning(() => null)
                .build()
        );
        logger.debug('null debug');
        expect(spy).toHaveBeenCalledWith('[FlixMonkey] null debug');
        spy.mockRestore();
    });
});
