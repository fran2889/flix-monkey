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

describe('Firefox Background Script', () => {
    let messageListener;

    beforeEach(async () => {
        vi.resetModules();
        vi.useFakeTimers();

        global.browser = {
            runtime: {
                onMessage: {
                    addListener: vi.fn(fn => {
                        messageListener = fn;
                    }),
                },
            },
            action: { onClicked: { addListener: vi.fn() } },
        };

        global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));

        await import('../../../../src/targets/firefox/background.js');
    });

    it('should respect custom timeout in options', async () => {
        const customTimeout = 1234;
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

        messageListener({ type: 'FM_FETCH', url: 'http://api.com', options: { timeout: customTimeout } });

        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), customTimeout);
        setTimeoutSpy.mockRestore();
    });

    it('should fall back to default HTTP_TIMEOUT (8000ms)', async () => {
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
        messageListener({ type: 'FM_FETCH', url: 'http://api.com', options: {} });
        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 8000);
        setTimeoutSpy.mockRestore();
    });

    it('should actually abort fetch when timer fires', async () => {
        const customTimeout = 500;
        messageListener({ type: 'FM_FETCH', url: 'http://api.com', options: { timeout: customTimeout } });

        const fetchOptions = global.fetch.mock.calls[0][1];
        expect(fetchOptions.signal.aborted).toBe(false);

        await vi.advanceTimersByTimeAsync(customTimeout + 10);
        expect(fetchOptions.signal.aborted).toBe(true);
    });
});
