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
        mockAdapter = buildMockAdapter().withStorageGetResolvingTo(null).withStorageSetResolvingTo(undefined).build();
        manager = new IdOverrideManager(mockAdapter);
    });

    describe('getImdbId', () => {
        it('returns null when no override exists', async () => {
            const result = await manager.getImdbId('The Matrix');
            expect(result).toBeNull();
        });

        it('returns stored imdbId when override exists', async () => {
            mockAdapter.storageGet.mockResolvedValue('{"imdbId":"tt0133093"}');
            const result = await manager.getImdbId('The Matrix');
            expect(result).toBe('tt0133093');
        });

        it('handles special characters in title', async () => {
            mockAdapter.storageGet.mockImplementation((key: string) => {
                if (key === 'fm-idoverride:the_matrix_reloaded') {
                    return Promise.resolve('{"imdbId":"tt0242653"}');
                }
                return Promise.resolve(null);
            });
            const result = await manager.getImdbId('The Matrix: Reloaded!');
            expect(result).toBe('tt0242653');
            expect(mockAdapter.storageGet).toHaveBeenCalledWith('fm-idoverride:the_matrix_reloaded');
        });

        it('returns null when storage returns undefined', async () => {
            mockAdapter.storageGet.mockResolvedValue(undefined);
            const result = await manager.getImdbId('The Matrix');
            expect(result).toBeNull();
        });
    });

    describe('setImdbId', () => {
        it('stores imdbId and retrieves it', async () => {
            mockAdapter.storageGet.mockResolvedValue('{"imdbId":"tt0133093"}');
            await manager.setImdbId('The Matrix', 'tt0133093');
            const result = await manager.getImdbId('The Matrix');
            expect(result).toBe('tt0133093');
            expect(mockAdapter.storageSet).toHaveBeenCalledWith('fm-idoverride:the_matrix', '{"imdbId":"tt0133093"}');
        });

        it('stores imdbId with special characters in title', async () => {
            await manager.setImdbId('The Matrix: Reloaded!', 'tt0242653');
            expect(mockAdapter.storageSet).toHaveBeenCalledWith(
                'fm-idoverride:the_matrix_reloaded',
                '{"imdbId":"tt0242653"}'
            );
        });

        it('handles corrupt storage data gracefully', async () => {
            mockAdapter.storageGet.mockResolvedValue('not-valid-json{');
            const result = await manager.getImdbId('Corrupt Movie');
            expect(result).toBeNull();
        });
    });
});
