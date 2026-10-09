/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it } from 'vitest';

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
