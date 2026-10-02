/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it, vi } from 'vitest';

import { XmdbApiClient } from '../../../../src/core/api/';
import { createMockAdapter } from '../../../mocks/adapter.js';
import { createMockLogger } from '../../../mocks/logger.js';

const mockOverrideManager = {
    getImdbId: vi.fn().mockResolvedValue(null),
};

describe('BaseApiClient (via XmdbApiClient)', () => {
    it('should return healthy status when not disabled', async () => {
        const mockDisabledManager = {
            isDisabled: vi.fn().mockResolvedValue(false),
        };
        const client = new XmdbApiClient(
            mockDisabledManager,
            {},
            { get: _k => 'key' },
            createMockLogger(),
            mockOverrideManager
        );
        const status = await client.getStatus();
        expect(status).toEqual({ healthy: true });
    });

    it('should return unhealthy status when disabled', async () => {
        const mockDisabledManager = {
            isDisabled: vi.fn().mockResolvedValue(true),
        };
        const client = new XmdbApiClient(
            mockDisabledManager,
            {},
            { get: _k => 'key' },
            createMockLogger(),
            mockOverrideManager
        );
        const status = await client.getStatus();
        expect(status.healthy).toBe(false);
        expect(status.reason).toBeDefined();
    });

    it('should throw when fetch encounters an error', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockRejectedValue(new Error('Network error')),
        });
        const client = new XmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            {
                get: _k => 'key',
            },
            createMockLogger(),
            mockOverrideManager
        );

        await expect(client.fetch('Some Title')).rejects.toThrow('Network error');
    });

    it('should return null if search returns no match', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue({ results: [] }),
        });
        const client = new XmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            {
                get: _k => 'key',
            },
            createMockLogger(),
            mockOverrideManager
        );
        const result = await client.fetch('Unknown');
        expect(result).toBeNull();
    });

    it('should return Title with override ID when override exists but getDetails returns null', async () => {
        const mockAdapter = createMockAdapter({
            httpFetch: vi.fn().mockResolvedValue(null),
        });
        const mockOverrideManager = {
            getImdbId: vi.fn().mockResolvedValue('tt1234567'),
        };
        const client = new XmdbApiClient(
            { isDisabled: vi.fn().mockResolvedValue(false) },
            mockAdapter,
            { get: _k => 'key' },
            createMockLogger(),
            mockOverrideManager
        );
        // Mock getDetails to return null (details fetch failed)
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
