/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

/** @typedef {{ migrated?: number, deleted?: number }} MigrationSummary */

/**
 * @typedef {object} StorageMigration
 * @property {number} version
 * @property {(adapter: import('../platform/adapter.js').PlatformAdapter) => Promise<MigrationSummary>} upgrade
 * @property {(adapter: import('../platform/adapter.js').PlatformAdapter, error: unknown) => Promise<MigrationSummary>} [onFailure]
 */

export const DATA_VERSION_KEY = 'fm_data_version';
const CACHE_PREFIX = 'fmc:';

async function clearCache(adapter) {
    const keys = await adapter.storageGetKeys(CACHE_PREFIX);
    await Promise.all(keys.map(key => adapter.storageDelete(key)));
    return { cleared: keys.length };
}

async function migrateImdbRating(adapter) {
    const keys = await adapter.storageGetKeys(CACHE_PREFIX);
    const updates = {};
    let migrated = 0;
    let deleted = 0;

    for (const key of keys) {
        const raw = await adapter.storageGet(key);
        let entry;
        try {
            entry = JSON.parse(raw);
        } catch {
            await adapter.storageDelete(key);
            deleted += 1;
            continue;
        }
        const data = entry?.data;
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            await adapter.storageDelete(key);
            deleted += 1;
            continue;
        }
        if (!Object.hasOwn(data, 'rating')) {
            continue;
        }
        if (!Object.hasOwn(data, 'imdbRating')) data.imdbRating = data.rating;
        delete data.rating;
        updates[key] = JSON.stringify(entry);
        migrated += 1;
    }

    if (migrated > 0) await adapter.storageSetMany(updates);
    return { migrated, deleted };
}

/** @type {ReadonlyArray<StorageMigration>} */
export const MIGRATIONS = Object.freeze([{ version: 1, upgrade: migrateImdbRating, onFailure: clearCache }]);

/**
 * Run each migration newer than the stored data version.
 *
 * A failed upgrade, including a failed recovery handler, deliberately advances
 * the data version. This prevents a broken migration from trapping startup in
 * an infinite retry loop.
 *
 * @param {import('../platform/adapter.js').PlatformAdapter} adapter
 * @param {{ info: Function, error: Function }} logger
 * @param {ReadonlyArray<StorageMigration>} [migrations=MIGRATIONS]
 * @returns {Promise<void>}
 */
export async function runMigrations(adapter, logger, migrations = MIGRATIONS) {
    validateMigrations(migrations);
    const currentVersion = parseStoredVersion(await adapter.storageGet(DATA_VERSION_KEY));

    for (const migration of migrations) {
        if (migration.version <= currentVersion) continue;

        try {
            const summary = await migration.upgrade(adapter);
            logger.info(`Migration ${migration.version} completed`, summary);
        } catch (error) {
            logger.error(`Migration ${migration.version} failed`, error);
            if (migration.onFailure) {
                try {
                    const summary = await migration.onFailure(adapter, error);
                    logger.info(`Migration ${migration.version} recovery completed`, summary);
                } catch (recoveryError) {
                    logger.error(`Migration ${migration.version} recovery failed`, recoveryError);
                }
            }
        }

        await adapter.storageSet(DATA_VERSION_KEY, String(migration.version));
    }
}

function parseStoredVersion(value) {
    if (typeof value === 'number') {
        return Number.isSafeInteger(value) && value >= 0 ? value : 0;
    }
    if (typeof value === 'string' && /^(?:0|[1-9]\d*)$/.test(value)) {
        const version = Number(value);
        return Number.isSafeInteger(version) ? version : 0;
    }
    return 0;
}

function validateMigrations(migrations) {
    if (!Array.isArray(migrations)) {
        throw new TypeError('Migrations must be an array');
    }

    let previousVersion = 0;
    for (const migration of migrations) {
        if (!migration || !Number.isSafeInteger(migration.version) || migration.version <= 0) {
            throw new TypeError('Migration versions must be positive safe integers');
        }
        if (migration.version <= previousVersion) {
            throw new TypeError('Migration versions must be strictly increasing');
        }
        if (typeof migration.upgrade !== 'function') {
            throw new TypeError('Migration upgrade must be a function');
        }
        if (migration.onFailure !== undefined && typeof migration.onFailure !== 'function') {
            throw new TypeError('Migration onFailure must be a function');
        }
        previousVersion = migration.version;
    }
}
