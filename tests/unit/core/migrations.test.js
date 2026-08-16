/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it, vi } from 'vitest';

import { DATA_VERSION_KEY, runMigrations } from '../../../src/core/migrations.js';
import { createMockAdapter } from '../../mocks/adapter.js';

describe('runMigrations', () => {
    const logger = { info: vi.fn(), error: vi.fn() };

    it.each([null, 'bad', '-1', -1])('treats %j as version zero', async stored => {
        const adapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue(stored) });
        const upgrade = vi.fn().mockResolvedValue({ transformed: 2, removed: 1 });

        await runMigrations(adapter, logger, [{ version: 1, upgrade }]);

        expect(upgrade).toHaveBeenCalledWith(adapter);
        expect(adapter.storageSet).toHaveBeenCalledWith(DATA_VERSION_KEY, '1');
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Migration 1 completed'), {
            transformed: 2,
            removed: 1,
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
        const onFailure = vi.fn().mockResolvedValue({ removed: 4 });
        const adapter = createMockAdapter({ storageGet: vi.fn().mockResolvedValue('0') });

        await runMigrations(adapter, logger, [{ version: 1, upgrade: vi.fn().mockRejectedValue(error), onFailure }]);

        expect(onFailure).toHaveBeenCalledWith(adapter, error);
        expect(adapter.storageSet).toHaveBeenCalledWith(DATA_VERSION_KEY, '1');
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Migration 1 failed'), error);
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Migration 1 recovery completed'), {
            removed: 4,
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
