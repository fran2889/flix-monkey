/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it, vi } from 'vitest';

import { XmdbApiClient } from '../../../../src/core/api/index';
import type { ConfigManager } from '../../../../src/core/config/config-manager';
import type { DisabledClientsManager } from '../../../../src/core/disabled-clients';
import type { IdOverrideManager } from '../../../../src/core/id-override-manager';
import type { Logger } from '../../../../src/core/logger';
import type { PlatformAdapter } from '../../../../src/platform/adapter';
import { buildMockAdapter } from '../../../mocks/adapter';
import { buildLogger } from '../../../mocks/logger';

const mockOverrideManager: IdOverrideManager = {
    getImdbId: vi.fn().mockResolvedValue(null),
    setImdbId: vi.fn().mockResolvedValue(undefined),
} as unknown as IdOverrideManager;

const mockAdapter: PlatformAdapter = buildMockAdapter().build();
const mockConfig: ConfigManager = {
    get: (_k: string) => 'key',
} as unknown as ConfigManager;
const mockDisabledManager: DisabledClientsManager = {
    isDisabled: vi.fn().mockResolvedValue(false),
    disable: vi.fn().mockResolvedValue(undefined),
    resetAll: vi.fn().mockResolvedValue([]),
} as unknown as DisabledClientsManager;
const mockLogger: Logger = buildLogger().build();

describe('BaseApiClient (via XmdbApiClient)', () => {
    it('should return healthy status when not disabled', async () => {
        const client = new XmdbApiClient(mockAdapter, mockConfig, mockDisabledManager, mockLogger, mockOverrideManager);
        const status = await client.getStatus();
        expect(status).toEqual({ healthy: true });
    });

    it('should return unhealthy status when disabled', async () => {
        const mockDisabledManagerForTest: DisabledClientsManager = {
            isDisabled: vi.fn().mockResolvedValue(true),
            disable: vi.fn().mockResolvedValue(undefined),
            resetAll: vi.fn().mockResolvedValue([]),
        } as unknown as DisabledClientsManager;
        const client = new XmdbApiClient(
            mockAdapter,
            mockConfig,
            mockDisabledManagerForTest,
            mockLogger,
            mockOverrideManager
        );
        const status = await client.getStatus();
        expect(status.healthy).toBe(false);
        expect((status as { healthy: false; reason: string }).reason).toBe('Temporarily disabled due to errors');
    });

    it('should throw when fetch encounters an error', async () => {
        const mockAdapterForTest = buildMockAdapter().withHttpFetchRejectingWith(new Error('Network error')).build();
        const client = new XmdbApiClient(
            mockAdapterForTest,
            mockConfig,
            mockDisabledManager,
            mockLogger,
            mockOverrideManager
        );

        await expect(client.fetch('Some Title')).rejects.toThrow('Network error');
    });

    it('should return null if search returns no match', async () => {
        const mockAdapterForTest = buildMockAdapter().withHttpFetchResolvingTo({ results: [] }).build();
        const client = new XmdbApiClient(
            mockAdapterForTest,
            mockConfig,
            mockDisabledManager,
            mockLogger,
            mockOverrideManager
        );
        const result = await client.fetch('Unknown');
        expect(result).toBeNull();
    });

    it('should return Title with override ID when override exists but getDetails returns null', async () => {
        const mockAdapterForTest = buildMockAdapter().withHttpFetchResolvingTo(null).build();
        const mockOverrideManagerForTest: IdOverrideManager = {
            getImdbId: vi.fn().mockResolvedValue('tt1234567'),
            setImdbId: vi.fn().mockResolvedValue(undefined),
        } as unknown as IdOverrideManager;
        const client = new XmdbApiClient(
            mockAdapterForTest,
            mockConfig,
            mockDisabledManager,
            mockLogger,
            mockOverrideManagerForTest
        );
        client.getDetails = vi.fn().mockResolvedValue(null);

        const result = await client.fetch('Some Title');

        expect(result).not.toBeNull();
        expect(result!.imdbId).toBe('tt1234567');
        expect(result!.displayTitle).toBe('Some Title');
        expect(result!.imdbRating).toBeNull();
        expect(result!.source).toBe('xmdb');
        expect(mockOverrideManagerForTest.getImdbId).toHaveBeenCalledWith('Some Title');
    });
});
