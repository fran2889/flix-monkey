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
import { PlatformAdapter } from '../../../src/platform/adapter.js';

describe('PlatformAdapter', () => {
    const adapter = new PlatformAdapter();

    it.each([
        ['storageGet', () => adapter.storageGet('key')],
        ['storageSet', () => adapter.storageSet('key', 'value')],
        ['storageDelete', () => adapter.storageDelete('key')],
        ['storageGetKeys', () => adapter.storageGetKeys('prefix')],
        ['storageGetAll', () => adapter.storageGetAll()],
        ['httpFetch', () => adapter.httpFetch('url', {})],
    ])('should throw if %s is not implemented', async (_method, call) => {
        await expect(call()).rejects.toThrow(`PlatformAdapter: ${_method}() must be implemented by subclass`);
    });

    it('should allow setting and getting configGet', () => {
        const fn = () => 'test';
        adapter.configGet = fn;
        expect(adapter.configGet).toBe(fn);
    });
});
