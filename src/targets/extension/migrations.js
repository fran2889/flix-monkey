/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { Logger } from '../../core/logger.js';
import { runMigrations } from '../../core/migrations.js';
import { WebExtensionAdapter } from '../../platform/webextension.js';

/**
 * Create an executor that shares one migration run among all callers.
 *
 * @returns {() => Promise<void>} Idempotent callable that runs migrations at most once per process.
 */
export function createExtensionMigrationExecutor() {
    let migrationPromise = null;

    return () => {
        if (!migrationPromise) {
            const adapter = new WebExtensionAdapter();
            migrationPromise = runMigrations(adapter, new Logger(adapter));
        }
        return migrationPromise;
    };
}
