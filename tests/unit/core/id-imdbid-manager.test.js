/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IdImdbIdManager } from '../../../src/core/id-imdbid-manager.js';
import { createMockAdapter } from '../../mocks/adapter.js';

describe('IdImdbIdManager', () => {
    let manager;
    let mockAdapter;

    beforeEach(() => {
        mockAdapter = createMockAdapter({
            storageGet: vi.fn().mockResolvedValue(null),
            storageSet: vi.fn().mockResolvedValue(undefined),
        });
        manager = new IdImdbIdManager(mockAdapter);
    });

    describe('getImdbId', () => {
        it('returns null when no override exists', async () => {
            const result = await manager.getImdbId('The Matrix');
            expect(result).toBeNull();
        });

        it('returns stored imdbId when override exists', async () => {
            mockAdapter.storageGet.mockResolvedValue('"tt0133093"');
            const result = await manager.getImdbId('The Matrix');
            expect(result).toBe('tt0133093');
        });

        it('handles special characters in title', async () => {
            mockAdapter.storageGet.mockImplementation(key => {
                if (key === 'fm-imdbid:the_matrix_reloaded') {
                    return Promise.resolve('"tt0242653"');
                }
                return Promise.resolve(null);
            });
            const result = await manager.getImdbId('The Matrix: Reloaded!');
            expect(result).toBe('tt0242653');
            expect(mockAdapter.storageGet).toHaveBeenCalledWith('fm-imdbid:the_matrix_reloaded');
        });

        it('returns null when storage returns undefined', async () => {
            mockAdapter.storageGet.mockResolvedValue(undefined);
            const result = await manager.getImdbId('The Matrix');
            expect(result).toBeNull();
        });
    });

    describe('setImdbId', () => {
        it('stores imdbId and retrieves it', async () => {
            mockAdapter.storageGet.mockResolvedValue('"tt0133093"');
            await manager.setImdbId('The Matrix', 'tt0133093');
            const result = await manager.getImdbId('The Matrix');
            expect(result).toBe('tt0133093');
            expect(mockAdapter.storageSet).toHaveBeenCalledWith('fm-imdbid:the_matrix', '"tt0133093"');
        });

        it('stores imdbId with special characters in title', async () => {
            await manager.setImdbId('The Matrix: Reloaded!', 'tt0242653');
            expect(mockAdapter.storageSet).toHaveBeenCalledWith('fm-imdbid:the_matrix_reloaded', '"tt0242653"');
        });

        it('handles corrupt storage data gracefully', async () => {
            mockAdapter.storageGet.mockResolvedValue('not-valid-json{');
            const result = await manager.getImdbId('Corrupt Movie');
            expect(result).toBeNull();
        });
    });
});
