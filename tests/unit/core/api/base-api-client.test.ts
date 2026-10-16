/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it, vi } from 'vitest';

import { BaseApiClient } from '../../../../src/core/api/base-api-client';
import { XmdbApiClient } from '../../../../src/core/api/index';
import type { ConfigManager } from '../../../../src/core/config/config-manager';
import type { DisabledClientsManager } from '../../../../src/core/disabled-clients';
import type { IdOverrideManager } from '../../../../src/core/id-override-manager';
import type { Logger } from '../../../../src/core/logger';
import type { RequestQueue } from '../../../../src/core/request-queue';
import { Title } from '../../../../src/core/title';
import type { PlatformAdapter } from '../../../../src/platform/adapter';
import { buildMockAdapter } from '../../../mocks/adapter';
import { buildLogger } from '../../../mocks/logger';

const mockOverrideManager: IdOverrideManager = {
    getImdbId: vi.fn().mockResolvedValue(undefined),
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

    it('should return undefined if search returns no match', async () => {
        const mockAdapterForTest = buildMockAdapter().withHttpFetchResolvingTo({ results: [] }).build();
        const client = new XmdbApiClient(
            mockAdapterForTest,
            mockConfig,
            mockDisabledManager,
            mockLogger,
            mockOverrideManager
        );
        const result = await client.fetch('Unknown');
        expect(result).toBeUndefined();
    });

    it('should return Title with override ID when override exists but getDetails returns undefined', async () => {
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
        client.getDetails = vi.fn().mockResolvedValue(undefined);

        const result = await client.fetch('Some Title');

        expect(result).not.toBeUndefined();
        expect(result!.imdbId).toBe('tt1234567');
        expect(result!.displayTitle).toBe('Some Title');
        expect(result!.imdbRating).toBeUndefined();
        expect(result!.source).toBe('xmdb');
        expect(mockOverrideManagerForTest.getImdbId).toHaveBeenCalledWith('Some Title');
    });

    describe('BaseApiClient surface', () => {
        class StubClient extends BaseApiClient {
            constructor(queue: RequestQueue, source: 'xmdb' | 'omdb' | 'agregarr', logger: Logger) {
                super(mockAdapter, mockConfig, mockDisabledManager, logger, mockOverrideManager, queue, source);
            }
            async search(): Promise<Title | undefined> {
                return undefined;
            }
            async getDetails(): Promise<Title | undefined> {
                return undefined;
            }
        }

        function buildQueue(clearedCount: number): RequestQueue {
            return { clear: vi.fn().mockReturnValue(clearedCount) } as unknown as RequestQueue;
        }

        it('exposes its ApiSource identifier', () => {
            const queue = buildQueue(0);
            const logger: Logger = buildLogger().build();
            expect(new StubClient(queue, 'omdb', logger).source).toBe('omdb');
            expect(new StubClient(queue, 'agregarr', logger).source).toBe('agregarr');
        });

        it('clears the queue on disable()', async () => {
            const queue = buildQueue(0);
            const logger: Logger = buildLogger().build();
            await new StubClient(queue, 'xmdb', logger).disable();
            expect(queue.clear).toHaveBeenCalledOnce();
        });

        it('reports a single purged request without a plural suffix', async () => {
            const logger: Logger = buildLogger().build();
            await new StubClient(buildQueue(1), 'xmdb', logger).disable();
            expect(logger.warn).toHaveBeenCalledWith('xmdb disabled for 60 min, purging 1 queued request');
        });

        it('reports multiple purged requests with a plural suffix', async () => {
            const logger: Logger = buildLogger().build();
            await new StubClient(buildQueue(3), 'xmdb', logger).disable();
            expect(logger.warn).toHaveBeenCalledWith('xmdb disabled for 60 min, purging 3 queued requests');
        });
    });
});
