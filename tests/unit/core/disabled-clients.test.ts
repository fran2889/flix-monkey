/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { ApiSource } from '../../../src/core/constants';
import { DisabledClientsManager } from '../../../src/core/disabled-clients';
import type { StorageValue } from '../../../src/platform/adapter';
import type { MockPlatformAdapter } from '../../mocks/adapter';
import { buildMockAdapter } from '../../mocks/adapter';

describe('DisabledClientsManager', () => {
    let mockAdapter: MockPlatformAdapter;
    let manager: DisabledClientsManager;

    beforeEach(() => {
        mockAdapter = buildMockAdapter().build();
        manager = new DisabledClientsManager(mockAdapter);
    });

    it.each([
        { label: 'a missing marker', stored: undefined, expected: false },
        { label: 'a zero marker', stored: '0', expected: false },
        { label: 'an unexpired marker', stored: (Date.now() + 5000).toString(), expected: true },
        { label: 'an expired marker', stored: (Date.now() - 5000).toString(), expected: false },
        { label: 'a non-numeric marker', stored: 'abc', expected: false },
        { label: 'a numeric-prefix marker', stored: '12abc', expected: false },
        { label: 'a non-finite marker', stored: 'Infinity', expected: false },
        { label: 'a negative marker', stored: '-5', expected: false },
        { label: 'a boolean marker', stored: true, expected: false },
    ])('reports $label as $expected without writing to storage', async ({ stored, expected }) => {
        mockAdapter.storageGet.mockResolvedValue(stored as StorageValue | undefined);

        expect(await manager.isDisabled('xmdb')).toBe(expected);
        expect(mockAdapter.storageSet).not.toHaveBeenCalled();
    });

    it('disables a source and stores its expiry', async () => {
        const now = Date.now();
        await manager.disable('xmdb', 1000);

        expect(mockAdapter.storageSet).toHaveBeenCalledWith('fm_disabled_xmdb', expect.any(String));

        const expiry = Number.parseInt(mockAdapter.storageSet.mock.calls[0]?.[1] as string, 10);
        expect(expiry).toBeGreaterThanOrEqual(now + 1000);
    });

    it('resets all disabled clients and returns their names', async () => {
        mockAdapter.storageGet.mockImplementation(async (key: string) => {
            if (key === 'fm_disabled_xmdb') return (Date.now() + 5000).toString();
            if (key === 'fm_disabled_omdb') return '0';
            return '0';
        });

        const reenabled = await manager.resetAll();
        expect(reenabled).toEqual(['xmdb']);
        expect(mockAdapter.storageSet).toHaveBeenCalledWith('fm_disabled_xmdb', '0');
        expect(mockAdapter.storageSet).not.toHaveBeenCalledWith('fm_disabled_omdb', '0');
    });

    it('resets every client in ApiSource order', async () => {
        mockAdapter.storageGet.mockResolvedValue((Date.now() + 5000).toString());

        const reenabled = await manager.resetAll();

        expect(reenabled).toEqual(Object.values(ApiSource));
        expect(mockAdapter.storageSet.mock.calls).toEqual([
            ['fm_disabled_xmdb', '0'],
            ['fm_disabled_omdb', '0'],
            ['fm_disabled_agregarr', '0'],
        ]);
    });

    it('stops at the first storage error during reset', async () => {
        mockAdapter.storageGet.mockResolvedValue((Date.now() + 5000).toString());
        mockAdapter.storageSet.mockRejectedValue(new Error('storage failed'));

        await expect(manager.resetAll()).rejects.toThrow('storage failed');
        expect(mockAdapter.storageSet).toHaveBeenCalledOnce();
    });
});
