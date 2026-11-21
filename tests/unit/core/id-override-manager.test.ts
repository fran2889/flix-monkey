/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { IdOverrideManager } from '../../../src/core/id-override-manager';
import { buildMockAdapter, type MockPlatformAdapter } from '../../mocks/adapter';

describe('IdOverrideManager', () => {
    let manager: IdOverrideManager;
    let mockAdapter: MockPlatformAdapter;

    beforeEach(() => {
        mockAdapter = buildMockAdapter()
            .withStorageGetResolvingTo(undefined)
            .withStorageSetResolvingTo(undefined)
            .build();
        manager = new IdOverrideManager(mockAdapter);
    });

    describe('getImdbId', () => {
        it('returns the stored IMDb ID when an override exists', async () => {
            mockAdapter.storageGet.mockResolvedValue('{"imdbId":"tt0133093"}');
            const result = await manager.getImdbId('The Matrix');
            expect(result).toBe('tt0133093');
        });

        it('normalizes special characters in the title to a storage key', async () => {
            mockAdapter.storageGet.mockImplementation((key: string) => {
                if (key === 'fm-idoverride:the_matrix_reloaded') {
                    return Promise.resolve('{"imdbId":"tt0242653"}');
                }
                return Promise.resolve(undefined);
            });
            const result = await manager.getImdbId('The Matrix: Reloaded!');
            expect(result).toBe('tt0242653');
            expect(mockAdapter.storageGet).toHaveBeenCalledWith('fm-idoverride:the_matrix_reloaded');
        });

        it('returns undefined when storage has no entry', async () => {
            mockAdapter.storageGet.mockResolvedValue(undefined);
            const result = await manager.getImdbId('The Matrix');
            expect(result).toBeUndefined();
        });

        it('returns undefined when the stored payload has no IMDb ID key', async () => {
            mockAdapter.storageGet.mockResolvedValue('{}');
            const result = await manager.getImdbId('The Matrix');
            expect(result).toBeUndefined();
        });

        it('returns undefined when the stored IMDb ID is null', async () => {
            mockAdapter.storageGet.mockResolvedValue('{"imdbId":null}');
            const result = await manager.getImdbId('The Matrix');
            expect(result).toBeUndefined();
        });

        it('returns undefined when the stored IMDb ID is not a string', async () => {
            mockAdapter.storageGet.mockResolvedValue('{"imdbId":123}');
            const result = await manager.getImdbId('Numeric ID Movie');
            expect(result).toBeUndefined();
        });

        it.each(['[]', 'true', '"tt123"'])('returns undefined for the non-object payload %s', async payload => {
            mockAdapter.storageGet.mockResolvedValue(payload);
            await expect(manager.getImdbId('Non Object Movie')).resolves.toBeUndefined();
        });
    });

    describe('setImdbId', () => {
        it('stores an IMDb ID and retrieves it', async () => {
            mockAdapter.storageGet.mockResolvedValue('{"imdbId":"tt0133093"}');
            await manager.setImdbId('The Matrix', 'tt0133093');
            const result = await manager.getImdbId('The Matrix');
            expect(result).toBe('tt0133093');
            expect(mockAdapter.storageSet).toHaveBeenCalledWith('fm-idoverride:the_matrix', '{"imdbId":"tt0133093"}');
        });

        it('normalizes special characters in the title when storing an IMDb ID', async () => {
            await manager.setImdbId('The Matrix: Reloaded!', 'tt0242653');
            expect(mockAdapter.storageSet).toHaveBeenCalledWith(
                'fm-idoverride:the_matrix_reloaded',
                '{"imdbId":"tt0242653"}'
            );
        });

        it('returns undefined when the stored data is corrupt JSON', async () => {
            mockAdapter.storageGet.mockResolvedValue('not-valid-json{');
            const result = await manager.getImdbId('Corrupt Movie');
            expect(result).toBeUndefined();
        });
    });
});
