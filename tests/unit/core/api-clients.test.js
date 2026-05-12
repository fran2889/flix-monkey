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
import { XmdbApiClient, ImdbApiDevClient } from '../../../src/core/api-clients.js';
import * as configModule from '../../../src/core/config.js';

beforeEach(() => {
    vi.spyOn(configModule, 'CONFIG', 'get').mockReturnValue({ xmdbApiKey: 'test-key' });
});

describe('BaseApiClient (via XmdbApiClient)', () => {
    it('should disable itself and purge queue on 4xx error', async () => {
        const error = new Error('HTTP 403');
        error.status = 403;

        // We need a slow promise to keep it in queue
        let _resolveFetch;
        const slowPromise = new Promise(resolve => {
            _resolveFetch = resolve;
        });

        const mockAdapter = {
            httpFetch: vi.fn().mockRejectedValueOnce(error).mockReturnValue(slowPromise),
            storageGet: vi.fn().mockResolvedValue(null),
            storageSet: vi.fn().mockResolvedValue(undefined),
        };
        const mockDisabledManager = {
            isDisabled: vi.fn().mockResolvedValue(false),
            disable: vi.fn().mockResolvedValue(undefined),
        };

        const client = new XmdbApiClient(mockDisabledManager, mockAdapter);

        // Trigger first fetch that fails and disables the client
        const p1 = client.queuedFetch('url1').catch(e => e);

        // Enqueue second fetch that should be purged
        const p2 = client.queuedFetch('url2').catch(e => e);

        const [err1, err2] = await Promise.all([p1, p2]);

        expect(err1.status).toBe(403);
        expect(err2.message).toBe('Client Disabled');
        expect(mockDisabledManager.disable).toHaveBeenCalled();
    });
});

describe('ImdbApiDevClient', () => {
    it('should match near years (fuzzy matching)', async () => {
        const mockAdapter = {
            httpFetch: vi.fn().mockResolvedValue({
                titles: [
                    { id: 'tt1', title: 'Wrong Year', startYear: 2020 },
                    { id: 'tt2', title: 'Close Year', startYear: 2022 },
                    { id: 'tt3', title: 'Far Year', startYear: 2025 },
                ],
            }),
            storageGet: vi.fn().mockResolvedValue(null),
            storageSet: vi.fn().mockResolvedValue(undefined),
        };
        const client = new ImdbApiDevClient({ isDisabled: vi.fn().mockResolvedValue(false) }, mockAdapter);

        // Request for 2023 should match 2022
        const result = await client.search('Some Movie', '2023');
        expect(result.id).toBe('tt2');
        expect(result.startYear).toBe(2022);
    });
});
