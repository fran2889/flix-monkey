/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Summary of a storage migration run.
 * @typedef {Object} MigrationSummary
 * @property {number} [migrated] - Number of entries successfully migrated.
 * @property {number} [skipped] - Number of entries that didn't need migration.
 * @property {number} [deleted] - Number of entries deleted.
 */

/**
 * Definition of a storage migration.
 * @typedef {Object} StorageMigration
 * @property {number} version
 * @property {string} description
 * @property {(adapter: import('../platform/adapter.js').PlatformAdapter) => Promise<MigrationSummary>} upgrade
 * @property {(adapter: import('../platform/adapter.js').PlatformAdapter, error: unknown) => Promise<MigrationSummary>} [onFailure]
 */

export {};
