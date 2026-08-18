/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DATA_VERSION_KEY, runMigrations } from '../../../src/core/migrations.js';
import { createMockAdapter } from '../../mocks/adapter.js';

describe('runMigrations', () => {
    const logger = { info: vi.fn(), error: vi.fn() };

    it.each([null, 'bad', '-1', -1])('treats %j as version zero', async stored => {
        const adapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue(stored) });
        const upgrade = vi.fn().mockResolvedValue({ migrated: 2, skipped: 0, deleted: 1 });

        await runMigrations(adapter, logger, [{ version: 1, upgrade }]);

        expect(upgrade).toHaveBeenCalledWith(adapter);
        expect(adapter.storageSet).toHaveBeenCalledWith(DATA_VERSION_KEY, '1');
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Migration 1 completed'), {
            migrated: 2,
            skipped: 0,
            deleted: 1,
        });
    });

    it('runs only newer migrations in ascending order', async () => {
        const calls = [];
        const migrations = [
            { version: 1, upgrade: vi.fn() },
            { version: 2, upgrade: vi.fn(async () => calls.push(2)) },
            { version: 3, upgrade: vi.fn(async () => calls.push(3)) },
        ];
        const adapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue('1') });

        await runMigrations(adapter, logger, migrations);

        expect(calls).toEqual([2, 3]);
        expect(migrations[0].upgrade).not.toHaveBeenCalled();
        expect(adapter.storageSet).toHaveBeenNthCalledWith(1, DATA_VERSION_KEY, '2');
        expect(adapter.storageSet).toHaveBeenNthCalledWith(2, DATA_VERSION_KEY, '3');
    });

    it('runs recovery, logs it, and advances after upgrade failure', async () => {
        const error = new Error('bad cache entry');
        const onFailure = vi.fn().mockResolvedValue({ migrated: 0, skipped: 0, deleted: 4 });
        const adapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue('0') });

        await runMigrations(adapter, logger, [{ version: 1, upgrade: vi.fn().mockRejectedValue(error), onFailure }]);

        expect(onFailure).toHaveBeenCalledWith(adapter, error);
        expect(adapter.storageSet).toHaveBeenCalledWith(DATA_VERSION_KEY, '1');
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Migration 1 failed'), error);
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Migration 1 recovery completed'), {
            migrated: 0,
            skipped: 0,
            deleted: 4,
        });
    });

    it('does not write when all migrations are current', async () => {
        const adapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue('2') });
        await runMigrations(adapter, logger, [
            { version: 1, upgrade: vi.fn() },
            { version: 2, upgrade: vi.fn() },
        ]);
        expect(adapter.storageSet).not.toHaveBeenCalled();
    });

    it('advances without recovery when onFailure is absent', async () => {
        const adapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue(0) });
        await runMigrations(adapter, logger, [{ version: 1, upgrade: vi.fn().mockRejectedValue(new Error('bad')) }]);
        expect(adapter.storageSet).toHaveBeenCalledWith(DATA_VERSION_KEY, '1');
    });

    it('logs recovery failure and continues to later migrations', async () => {
        const recoveryError = new Error('recovery bad');
        const calls = [];
        const adapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue(0) });
        await runMigrations(adapter, logger, [
            {
                version: 1,
                upgrade: vi.fn().mockRejectedValue(new Error('upgrade bad')),
                onFailure: vi.fn().mockRejectedValue(recoveryError),
            },
            { version: 2, upgrade: vi.fn(async () => calls.push(2)) },
        ]);
        expect(logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Migration 1 recovery failed'),
            recoveryError
        );
        expect(calls).toEqual([2]);
        expect(adapter.storageSet).toHaveBeenNthCalledWith(2, DATA_VERSION_KEY, '2');
    });

    it.each([
        [
            'duplicate versions',
            [
                { version: 1, upgrade: vi.fn() },
                { version: 1, upgrade: vi.fn() },
            ],
        ],
        [
            'unordered versions',
            [
                { version: 2, upgrade: vi.fn() },
                { version: 1, upgrade: vi.fn() },
            ],
        ],
        ['zero version', [{ version: 0, upgrade: vi.fn() }]],
        ['non-integer version', [{ version: 1.5, upgrade: vi.fn() }]],
        ['missing upgrade', [{ version: 1 }]],
        ['non-function onFailure', [{ version: 1, upgrade: vi.fn(), onFailure: true }]],
    ])('rejects %s registries', async (_name, migrations) => {
        await expect(runMigrations(createMockAdapter(), logger, migrations)).rejects.toThrow();
    });
});

describe('default migrations', () => {
    const logger = { info: vi.fn(), error: vi.fn() };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renames cached rating fields while preserving cache metadata', async () => {
        const entries = {
            'fmc:first': JSON.stringify({
                data: { displayTitle: 'First', rating: '8.5', rtRating: 90 },
                expires: 12345,
            }),
            'fmc:second': JSON.stringify({
                data: { displayTitle: 'Second', rating: null, imdbRating: 7.2 },
                expires: null,
            }),
            'fmc:third': JSON.stringify({
                data: { displayTitle: 'Third', rating: 9.1 },
                expires: 67890,
            }),
            'fmc:not-found': JSON.stringify({
                data: { displayTitle: 'Missing', rating: null },
                expires: 54321,
            }),
        };
        const adapter = createMockAdapter({
            storageGet: vi.fn(async key => (key === DATA_VERSION_KEY ? null : entries[key])),
            storageGetKeys: vi.fn().mockResolvedValue(Object.keys(entries)),
        });

        await runMigrations(adapter, logger);

        expect(adapter.storageGetKeys).toHaveBeenCalledWith('fmc:');
        expect(adapter.storageSetMany).toHaveBeenCalledWith({
            'fmc:first': JSON.stringify({
                data: { displayTitle: 'First', rtRating: 90, imdbRating: '8.5' },
                expires: 12345,
            }),
            'fmc:second': JSON.stringify({
                data: { displayTitle: 'Second', imdbRating: 7.2 },
                expires: null,
            }),
            'fmc:third': JSON.stringify({
                data: { displayTitle: 'Third', imdbRating: 9.1 },
                expires: 67890,
            }),
            'fmc:not-found': JSON.stringify({
                data: { displayTitle: 'Missing', imdbRating: null },
                expires: 54321,
            }),
        });
        expect(adapter.storageSet).toHaveBeenCalledWith(DATA_VERSION_KEY, '1');
        expect(logger.info).toHaveBeenCalledWith('Migration 1 completed', { migrated: 4, skipped: 0, deleted: 0 });
    });

    it('deletes malformed entries and keeps valid entries without rating', async () => {
        const entries = {
            'fmc:malformed': '{bad json',
            'fmc:no-data': JSON.stringify({ expires: 12345 }),
            'fmc:array-data': JSON.stringify({ data: [{ rating: 8.5 }], expires: 12345 }),
            'fmc:current': JSON.stringify({ data: { imdbRating: 8.5 }, expires: 12345 }),
        };
        const adapter = createMockAdapter({
            storageGet: vi.fn(async key => (key === DATA_VERSION_KEY ? null : entries[key])),
            storageGetKeys: vi.fn().mockResolvedValue(Object.keys(entries)),
            storageDelete: vi.fn().mockResolvedValue(undefined),
        });

        await runMigrations(adapter, logger);

        expect(adapter.storageDelete).toHaveBeenCalledWith('fmc:malformed');
        expect(adapter.storageDelete).toHaveBeenCalledWith('fmc:no-data');
        expect(adapter.storageDelete).toHaveBeenCalledWith('fmc:array-data');
        expect(adapter.storageDelete).not.toHaveBeenCalledWith('fmc:current');
        expect(adapter.storageSetMany).not.toHaveBeenCalled();
        expect(adapter.storageSet).toHaveBeenCalledWith(DATA_VERSION_KEY, '1');
        expect(logger.info).toHaveBeenCalledWith('Migration 1 completed', { migrated: 0, skipped: 1, deleted: 3 });
    });

    it('clears cache on migration failure via onFailure handler', async () => {
        const entries = {
            'fmc:first': JSON.stringify({ data: { rating: 8.5 }, expires: 12345 }),
            'fmc:second': JSON.stringify({ data: { rating: 7.2 }, expires: 67890 }),
        };
        const adapter = createMockAdapter({
            storageGet: vi.fn(async key => (key === DATA_VERSION_KEY ? null : entries[key])),
            storageGetKeys: vi.fn().mockResolvedValue(Object.keys(entries)),
            storageDelete: vi.fn().mockResolvedValue(undefined),
        });
        const error = new Error('migration failed');

        await runMigrations(adapter, logger, [
            {
                version: 1,
                upgrade: vi.fn().mockRejectedValue(error),
                onFailure: vi.fn().mockImplementation(async adapter => {
                    const keys = await adapter.storageGetKeys('fmc:');
                    await Promise.all(keys.map(key => adapter.storageDelete(key)));
                    return { migrated: 0, skipped: 0, deleted: keys.length };
                }),
            },
        ]);

        expect(adapter.storageGetKeys).toHaveBeenCalledWith('fmc:');
        expect(adapter.storageDelete).toHaveBeenCalledWith('fmc:first');
        expect(adapter.storageDelete).toHaveBeenCalledWith('fmc:second');
        expect(adapter.storageSet).toHaveBeenCalledWith(DATA_VERSION_KEY, '1');
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Migration 1 failed'), error);
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Migration 1 recovery completed'), {
            migrated: 0,
            skipped: 0,
            deleted: 2,
        });
    });
});
