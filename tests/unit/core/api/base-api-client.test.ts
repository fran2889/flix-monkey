/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it, vi } from 'vitest';

import { BaseApiClient } from '../../../../src/core/api/base-api-client';
import { type ApiClientDeps, XmdbApiClient } from '../../../../src/core/api/index';
import type { ConfigManager } from '../../../../src/core/config/config-manager';
import type { DisabledClientsManager } from '../../../../src/core/disabled-clients';
import type { IdOverrideManager } from '../../../../src/core/id-override-manager';
import type { Logger } from '../../../../src/core/logger';
import { ParseError } from '../../../../src/core/parse-utils';
import type { RequestQueue } from '../../../../src/core/request-queue';
import type { Title } from '../../../../src/core/title';
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

const deps: ApiClientDeps = {
    adapter: mockAdapter,
    config: mockConfig,
    disabledManager: mockDisabledManager,
    logger: mockLogger,
    overrideManager: mockOverrideManager,
};

describe('BaseApiClient (via XmdbApiClient)', () => {
    it('should return healthy status when not disabled', async () => {
        const client = new XmdbApiClient(deps);
        const status = await client.getStatus();
        expect(status).toEqual({ healthy: true });
    });

    it('should return unhealthy status when disabled', async () => {
        const mockDisabledManagerForTest: DisabledClientsManager = {
            isDisabled: vi.fn().mockResolvedValue(true),
            disable: vi.fn().mockResolvedValue(undefined),
            resetAll: vi.fn().mockResolvedValue([]),
        } as unknown as DisabledClientsManager;
        const client = new XmdbApiClient({ ...deps, disabledManager: mockDisabledManagerForTest });
        const status = await client.getStatus();
        expect(status.healthy).toBe(false);
        expect((status as { healthy: false; reason: string }).reason).toBe('Temporarily disabled due to errors');
    });

    it('should throw when fetch encounters an error', async () => {
        const mockAdapterForTest = buildMockAdapter().withHttpFetchRejectingWith(new Error('Network error')).build();
        const client = new XmdbApiClient({ ...deps, adapter: mockAdapterForTest });

        await expect(client.fetch('Some Title')).rejects.toThrow('Network error');
    });

    it('should return undefined if search returns no match', async () => {
        const mockAdapterForTest = buildMockAdapter().withHttpFetchResolvingTo({ results: [] }).build();
        const client = new XmdbApiClient({ ...deps, adapter: mockAdapterForTest });
        const result = await client.fetch('Unknown');
        expect(result).toBeUndefined();
    });

    it('should return Title with override ID when override exists but getDetails returns undefined', async () => {
        const mockAdapterForTest = buildMockAdapter().withHttpFetchResolvingTo(null).build();
        const mockOverrideManagerForTest: IdOverrideManager = {
            getImdbId: vi.fn().mockResolvedValue('tt1234567'),
            setImdbId: vi.fn().mockResolvedValue(undefined),
        } as unknown as IdOverrideManager;
        const client = new XmdbApiClient({
            ...deps,
            adapter: mockAdapterForTest,
            overrideManager: mockOverrideManagerForTest,
        });
        client.getDetails = vi.fn().mockResolvedValue(undefined);

        const result = await client.fetch('Some Title');

        expect(result).not.toBeUndefined();
        expect(result!.imdbId).toBe('tt1234567');
        expect(result!.displayTitle).toBe('Some Title');
        expect(result!.imdbRating).toBeUndefined();
        expect(result!.source).toBe('xmdb');
        expect(mockOverrideManagerForTest.getImdbId).toHaveBeenCalledWith('Some Title');
    });

    it('should return undefined for an explicit IMDb ID when details are not found', async () => {
        const client = new XmdbApiClient(deps);
        const search = vi.spyOn(client, 'search');
        client.getDetails = vi.fn().mockResolvedValue(undefined);

        const result = await client.fetch('Some Title', 'tt1234567');

        expect(result).toBeUndefined();
        expect(search).not.toHaveBeenCalled();
    });

    it('should prefer the stored override ID over an explicit IMDb ID', async () => {
        const mockOverrideManagerForTest: IdOverrideManager = {
            getImdbId: vi.fn().mockResolvedValue('tt9999999'),
            setImdbId: vi.fn().mockResolvedValue(undefined),
        } as unknown as IdOverrideManager;
        const client = new XmdbApiClient({ ...deps, overrideManager: mockOverrideManagerForTest });
        client.getDetails = vi.fn().mockResolvedValue(undefined);

        const result = await client.fetch('Some Title', 'tt1234567');

        expect(result?.imdbId).toBe('tt9999999');
        expect(client.getDetails).toHaveBeenCalledWith(expect.objectContaining({ imdbId: 'tt9999999' }));
    });

    describe('BaseApiClient surface', () => {
        class StubClient extends BaseApiClient {
            constructor(
                source: 'xmdb' | 'omdb' | 'agregarr',
                logger: Logger,
                queue?: RequestQueue,
                adapter: PlatformAdapter = mockAdapter
            ) {
                super({ ...deps, adapter, logger }, source, queue);
            }
            async search(): Promise<Title | undefined> {
                return undefined;
            }
            async getDetails(): Promise<Title | undefined> {
                return undefined;
            }
        }

        function buildQueue(clearedCount: number): RequestQueue {
            return {
                clear: vi.fn().mockReturnValue(clearedCount),
                enqueue: vi.fn((url: string, _priority: number, fetchFn: (requestUrl: string) => Promise<unknown>) =>
                    fetchFn(url)
                ),
            } as unknown as RequestQueue;
        }

        it('exposes its ApiSource identifier', () => {
            const queue = buildQueue(0);
            const logger: Logger = buildLogger().build();
            expect(new StubClient('omdb', logger, queue).source).toBe('omdb');
            expect(new StubClient('agregarr', logger, queue).source).toBe('agregarr');
        });

        it('returns the parser result', async () => {
            const adapter = buildMockAdapter().withHttpFetchResolvingTo({ id: 'tt1' }).build();
            const client = new StubClient('xmdb', buildLogger().build(), buildQueue(0), adapter);

            const result = await client.fetchParsed(
                'https://example.test',
                0,
                raw => ({ id: (raw as { id: string }).id }),
                'test'
            );

            expect(result).toEqual({ id: 'tt1' });
        });

        it('logs one warning and returns undefined for ParseError', async () => {
            const logger = buildLogger().build();
            const adapter = buildMockAdapter().withHttpFetchResolvingTo({ id: 42 }).build();
            const client = new StubClient('xmdb', logger, buildQueue(0), adapter);

            const result = await client.fetchParsed(
                'https://example.test',
                0,
                () => {
                    throw new ParseError('expected string at "id"');
                },
                'XMDb search for "Test"'
            );

            expect(result).toBeUndefined();
            expect(logger.warn).toHaveBeenCalledWith('Malformed XMDb search for "Test"', {
                response: { id: 42 },
                error: 'expected string at "id"',
            });
            expect(logger.warn).toHaveBeenCalledTimes(1);
        });

        it('rethrows a non-ParseError', async () => {
            const logger = buildLogger().build();
            const client = new StubClient('xmdb', logger, buildQueue(0), mockAdapter);
            const boom = new Error('boom');

            await expect(
                client.fetchParsed(
                    'https://example.test',
                    0,
                    () => {
                        throw boom;
                    },
                    'test'
                )
            ).rejects.toThrow('boom');

            expect(logger.warn).not.toHaveBeenCalled();
        });

        it('does not catch a queue error', async () => {
            const logger = buildLogger().build();
            const adapter = buildMockAdapter().withHttpFetchRejectingWith(new Error('network')).build();
            const client = new StubClient('xmdb', logger, buildQueue(0), adapter);

            await expect(client.fetchParsed('https://example.test', 0, raw => raw, 'test')).rejects.toThrow('network');

            expect(logger.warn).not.toHaveBeenCalled();
        });

        it('builds a default request queue when none is injected', async () => {
            const logger: Logger = buildLogger().build();
            await new StubClient('xmdb', logger).disable();
            expect(logger.warn).toHaveBeenCalledWith('xmdb disabled for 60 min, purging 0 queued requests');
        });

        it('clears the queue on disable()', async () => {
            const queue = buildQueue(0);
            const logger: Logger = buildLogger().build();
            await new StubClient('xmdb', logger, queue).disable();
            expect(queue.clear).toHaveBeenCalledOnce();
        });

        it('reports a single purged request without a plural suffix', async () => {
            const logger: Logger = buildLogger().build();
            await new StubClient('xmdb', logger, buildQueue(1)).disable();
            expect(logger.warn).toHaveBeenCalledWith('xmdb disabled for 60 min, purging 1 queued request');
        });

        it('reports multiple purged requests with a plural suffix', async () => {
            const logger: Logger = buildLogger().build();
            await new StubClient('xmdb', logger, buildQueue(3)).disable();
            expect(logger.warn).toHaveBeenCalledWith('xmdb disabled for 60 min, purging 3 queued requests');
        });
    });
});
