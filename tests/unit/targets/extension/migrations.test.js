/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it, vi } from 'vitest';

const { Logger, runMigrations, WebExtensionAdapter } = vi.hoisted(() => ({
    Logger: vi.fn(),
    runMigrations: vi.fn(),
    WebExtensionAdapter: vi.fn(),
}));

vi.mock('../../../../src/core/logger.js', () => ({ Logger }));
vi.mock('../../../../src/core/migrations.js', () => ({ runMigrations }));
vi.mock('../../../../src/platform/webextension.js', () => ({ WebExtensionAdapter }));

describe('createExtensionMigrationExecutor', () => {
    it('shares one in-flight migration run with concurrent callers', async () => {
        let resolveMigrations;
        const migrationsComplete = new Promise(resolve => {
            resolveMigrations = resolve;
        });
        runMigrations.mockReturnValueOnce(migrationsComplete);

        const { createExtensionMigrationExecutor } = await import('../../../../src/targets/extension/migrations.js');
        const executeMigrations = createExtensionMigrationExecutor();

        const first = executeMigrations();
        const second = executeMigrations();

        expect(runMigrations).toHaveBeenCalledOnce();
        expect(first).toBe(second);

        resolveMigrations();
        await expect(first).resolves.toBeUndefined();
        await expect(second).resolves.toBeUndefined();
    });
});
