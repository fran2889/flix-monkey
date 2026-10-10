/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { Logger } from '../../core/logger';
import { runMigrations } from '../../core/migrations';
import { WebExtensionAdapter } from '../../platform/webextension';

/**
 * Create an executor that shares one migration run among all callers.
 *
 * @returns A function that returns a Promise that resolves when migrations are complete
 */
export function createExtensionMigrationExecutor(): () => Promise<void> {
    let migrationPromise: Promise<void> | null = null;

    return async () => {
        if (!migrationPromise) {
            const adapter = new WebExtensionAdapter();
            migrationPromise = runMigrations(adapter, new Logger(adapter));
        }
        return migrationPromise;
    };
}
