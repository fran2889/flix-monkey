/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it, vi } from 'vitest';

import { XmdbApiClient } from '../../../../src/core/api/index.js';
import { buildMockAdapter } from '../../../mocks/adapter.js';
import { buildMockDisabledClientsManager } from '../../../mocks/disabled-clients.js';
import { buildMockIdOverrideManager } from '../../../mocks/id-override-manager.js';
import { buildLogger } from '../../../mocks/logger.js';

const mockOverrideManager = buildMockIdOverrideManager().build();

describe('BaseApiClient (via XmdbApiClient)', () => {
    it('should return healthy status when not disabled', async () => {
        const mockDisabledManager = buildMockDisabledClientsManager().withIsDisabledResolving(false).build();
        const client = new XmdbApiClient(
            {},
            { get: _k => 'key' },
            mockDisabledManager,
            buildLogger().build(),
            mockOverrideManager
        );
        const status = await client.getStatus();
        expect(status).toEqual({ healthy: true });
    });

    it('should return unhealthy status when disabled', async () => {
        const mockDisabledManager = buildMockDisabledClientsManager().withIsDisabledResolving(true).build();
        const client = new XmdbApiClient(
            {},
            { get: _k => 'key' },
            mockDisabledManager,
            buildLogger().build(),
            mockOverrideManager
        );
        const status = await client.getStatus();
        expect(status.healthy).toBe(false);
        expect(status.reason).toBeDefined();
    });

    it('should throw when fetch encounters an error', async () => {
        const mockAdapter = buildMockAdapter().withHttpFetchRejectingWith(new Error('Network error')).build();
        const client = new XmdbApiClient(
            mockAdapter,
            {
                get: _k => 'key',
            },
            buildMockDisabledClientsManager.notDisabled(),
            buildLogger().build(),
            mockOverrideManager
        );

        await expect(client.fetch('Some Title')).rejects.toThrow('Network error');
    });

    it('should return null if search returns no match', async () => {
        const mockAdapter = buildMockAdapter().withHttpFetchResolvingTo({ results: [] }).build();
        const client = new XmdbApiClient(
            mockAdapter,
            {
                get: _k => 'key',
            },
            buildMockDisabledClientsManager.notDisabled(),
            buildLogger().build(),
            mockOverrideManager
        );
        const result = await client.fetch('Unknown');
        expect(result).toBeNull();
    });

    it('should return Title with override ID when override exists but getDetails returns null', async () => {
        const mockAdapter = buildMockAdapter().withHttpFetchResolvingTo(null).build();
        const mockOverrideManager = buildMockIdOverrideManager().withGetImdbIdResolving('tt1234567').build();
        const mockDisabledManager2 = buildMockDisabledClientsManager().withIsDisabledResolving(false).build();
        const client = new XmdbApiClient(
            mockAdapter,
            { get: _k => 'key' },
            mockDisabledManager2,
            buildLogger().build(),
            mockOverrideManager
        );
        client.getDetails = vi.fn().mockResolvedValue(null);

        const result = await client.fetch('Some Title');

        expect(result).not.toBeNull();
        expect(result.imdbId).toBe('tt1234567');
        expect(result.displayTitle).toBe('Some Title');
        expect(result.imdbRating).toBeNull();
        expect(result.source).toBe('xmdb');
        expect(mockOverrideManager.getImdbId).toHaveBeenCalledWith('Some Title');
    });
});
