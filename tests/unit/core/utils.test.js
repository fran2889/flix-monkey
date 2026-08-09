/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { debounce, FlixMonkeyError, runIdle, slugify } from '../../../src/core/utils.js';

describe('core/utils', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('debounce', () => {
        it('should debounce function calls', () => {
            const func = vi.fn();
            const debounced = debounce(func, 100);

            debounced();
            debounced();
            debounced();

            expect(func).not.toHaveBeenCalled();

            vi.advanceTimersByTime(50);
            expect(func).not.toHaveBeenCalled();

            vi.advanceTimersByTime(51);
            expect(func).toHaveBeenCalledTimes(1);
        });

        it('should pass arguments to the debounced function', () => {
            const func = vi.fn();
            const debounced = debounce(func, 100);

            debounced('arg1', 'arg2');
            vi.advanceTimersByTime(101);

            expect(func).toHaveBeenCalledWith('arg1', 'arg2');
        });

        it('should maintain context', () => {
            const context = { value: 'test' };
            let capturedContext;
            const func = function () {
                capturedContext = this;
            };
            const debounced = debounce(func, 100);

            debounced.call(context);
            vi.advanceTimersByTime(101);

            expect(capturedContext).toBe(context);
        });
    });

    describe('runIdle', () => {
        it('should use requestIdleCallback if available', () => {
            const mockRIC = vi.fn(callback => callback());
            vi.stubGlobal('requestIdleCallback', mockRIC);

            const func = vi.fn();
            runIdle(func);

            expect(mockRIC).toHaveBeenCalled();
            expect(func).toHaveBeenCalled();

            vi.unstubAllGlobals();
        });

        it('should fallback to setTimeout if requestIdleCallback is not available', () => {
            vi.stubGlobal('requestIdleCallback', undefined);

            const func = vi.fn();
            runIdle(func);

            expect(func).not.toHaveBeenCalled();
            vi.advanceTimersByTime(1);
            expect(func).toHaveBeenCalled();

            vi.unstubAllGlobals();
        });

        it('falls back to setTimeout when window is undefined', () => {
            const savedWindow = global.window;
            global.window = undefined;
            const func = vi.fn();
            runIdle(func);
            vi.advanceTimersByTime(1);
            expect(func).toHaveBeenCalled();
            global.window = savedWindow;
        });
    });

    describe('FlixMonkeyError', () => {
        it('should store all constructor params', () => {
            const err = new FlixMonkeyError('HTTP 401', 'https://api.example.com/foo', 401, 'Unauthorized');
            expect(err).toBeInstanceOf(Error);
            expect(err.name).toBe('FlixMonkeyError');
            expect(err.message).toBe('HTTP 401');
            expect(err.url).toBe('https://api.example.com/foo');
            expect(err.status).toBe(401);
            expect(err.body).toBe('Unauthorized');
        });

        it('should default optional params to null', () => {
            const err = new FlixMonkeyError('test error');
            expect(err.url).toBeNull();
            expect(err.status).toBeNull();
            expect(err.body).toBeNull();
        });
    });

    describe('slugify', () => {
        it('preserves legacy ASCII title keys', () => {
            expect(slugify("Schitt's Creek")).toBe('schitt_s_creek');
            expect(slugify('Test: Movie')).toBe('test_movie');
            expect(slugify('Hello World')).toBe('hello_world');
        });

        it('encodes lowercased non-ASCII letters and numbers', () => {
            expect(slugify('\u00C9lodie')).toBe('%C3%A9lodie');
            expect(slugify('\u0661\u0662\u0663')).toBe('%D9%A1%D9%A2%D9%A3');
        });

        it('keeps Unicode letters distinct across scripts', () => {
            expect(slugify('\uAE30\uC0DD\uCDA9')).not.toBe(slugify('\u5BC4\u751F\u7345'));
        });

        it('normalizes equivalent Unicode title forms', () => {
            expect(slugify('Caf\u00E9')).toBe('caf%C3%A9');
            expect(slugify('Caf\u00E9')).toBe(slugify('Cafe\u0301'));
        });

        it('applies legacy separators around encoded Unicode letters', () => {
            expect(slugify("Am\u00E9lie: Director's Cut")).toBe('am%C3%A9lie_director_s_cut');
        });

        it('should trim leading and trailing underscores', () => {
            expect(slugify('  Hello  ')).toBe('hello');
            expect(slugify('!Movie!')).toBe('movie');
        });

        it('should produce the same slug for titles differing only by punctuation', () => {
            expect(slugify('Test: Movie')).toBe(slugify('Test Movie'));
        });
    });
});
