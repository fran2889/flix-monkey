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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce, runIdle, FlixMonkeyError, slugify } from '../../../src/core/utils.js';

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
        it('should lowercase and replace non-alphanumeric sequences with underscores', () => {
            expect(slugify("Schitt's Creek")).toBe('schitt_s_creek');
            expect(slugify('Test: Movie')).toBe('test_movie');
            expect(slugify('Hello World')).toBe('hello_world');
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
