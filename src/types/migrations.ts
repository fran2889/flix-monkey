/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { PlatformAdapter } from '../platform/adapter';

/**
 * Summary of a storage migration run.
 */
export interface MigrationSummary {
    migrated?: number;
    skipped?: number;
    deleted?: number;
}

/**
 * Definition of a storage migration.
 */
export interface StorageMigration {
    version: number;
    description: string;
    upgrade: (_adapter: PlatformAdapter) => Promise<MigrationSummary>;
    onFailure?: (_adapter: PlatformAdapter, _error: unknown) => Promise<MigrationSummary>;
}
