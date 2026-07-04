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
import { beforeEach, describe, expect, it } from 'vitest';

import { DisabledClientsManager } from '../../../src/core/disabled-clients.js';
import { createMockAdapter } from '../../mocks/adapter.js';

describe('core/disabled-clients', () => {
    let mockAdapter, manager;

    beforeEach(() => {
        mockAdapter = createMockAdapter();
        manager = new DisabledClientsManager(mockAdapter);
    });

    it('should initially not be disabled', async () => {
        mockAdapter.storageGet.mockResolvedValue(null);
        expect(await manager.isDisabled('test-source')).toBe(false);
    });

    it('should disable a source and store expiry', async () => {
        const now = Date.now();
        await manager.disable('test-source', 1000);

        expect(mockAdapter.storageSet).toHaveBeenCalledWith('fm_disabled_test-source', expect.any(String));

        const expiry = Number.parseInt(mockAdapter.storageSet.mock.calls[0][1], 10);
        expect(expiry).toBeGreaterThanOrEqual(now + 1000);
    });

    it('should report as disabled if not expired', async () => {
        mockAdapter.storageGet.mockResolvedValue(Date.now() + 5000);
        expect(await manager.isDisabled('test-source')).toBe(true);
    });

    it('should report as NOT disabled if expired', async () => {
        mockAdapter.storageGet.mockResolvedValue(Date.now() - 1000);
        expect(await manager.isDisabled('test-source')).toBe(false);
    });

    it('should reset all disabled clients and return their list', async () => {
        mockAdapter.storageGet.mockImplementation(async key => {
            if (key === 'fm_disabled_xmdb') return (Date.now() + 5000).toString();
            if (key === 'fm_disabled_omdb') return '0';
            return '0';
        });

        const reenabled = await manager.resetAll();
        expect(reenabled).toEqual(['xmdb']);
        expect(mockAdapter.storageSet).toHaveBeenCalledWith('fm_disabled_xmdb', '0');
        expect(mockAdapter.storageSet).not.toHaveBeenCalledWith('fm_disabled_omdb', '0');
    });
});
