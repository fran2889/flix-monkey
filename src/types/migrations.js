/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Summary of a storage migration run.
 * @typedef {object} MigrationSummary
 * @property {readonly number} [migrated] - Number of entries successfully migrated.
 * @property {readonly number} [skipped] - Number of entries that didn't need migration.
 * @property {readonly number} [deleted] - Number of entries deleted.
 */

/**
 * Definition of a storage migration.
 * @typedef {object} StorageMigration
 * @property {readonly number} version
 * @property {readonly string} description
 * @property {readonly (adapter: import('../platform/adapter.js').PlatformAdapter) => Promise<MigrationSummary>} upgrade
 * @property {readonly (adapter: import('../platform/adapter.js').PlatformAdapter, error: unknown) => Promise<MigrationSummary>} [onFailure]
 */

export {};
