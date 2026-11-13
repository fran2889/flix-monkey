/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { PlatformAdapter } from '../platform/adapter';
import type { MigrationSummary, StorageMigration } from '../types/migrations';
import { isRecord } from './parse-utils';

export const DATA_VERSION_KEY: string = 'fm_data_version';
const CACHE_PREFIX: string = 'fmc:';

interface ParsedCacheEntry {
    entry: Record<string, unknown>;
    data: Record<string, unknown>;
}

type CacheEntryOutcome =
    { action: 'delete' } | { action: 'skip' } | { action: 'update'; entry: Record<string, unknown> };

type CacheEntryVisitor = (entry: Record<string, unknown>, data: Record<string, unknown>) => CacheEntryOutcome;

async function clearCache(adapter: PlatformAdapter): Promise<MigrationSummary> {
    const keys = await adapter.storageGetKeys(CACHE_PREFIX);
    for (const key of keys) {
        await adapter.storageDelete(key);
    }
    return { migrated: 0, skipped: 0, deleted: keys.length };
}

async function migrateCacheEntries(adapter: PlatformAdapter, visit: CacheEntryVisitor): Promise<MigrationSummary> {
    const keys = await adapter.storageGetKeys(CACHE_PREFIX);
    const updates: Record<string, string> = {};
    let migrated = 0;
    let skipped = 0;
    let deleted = 0;

    for (const key of keys) {
        const raw = await adapter.storageGet(key);
        const parsed = parseCacheEntry(raw);
        if (!parsed) {
            await adapter.storageDelete(key);
            deleted += 1;
            continue;
        }

        const outcome = visit(parsed.entry, parsed.data);
        if (outcome.action === 'skip') {
            skipped += 1;
            continue;
        }
        if (outcome.action === 'delete') {
            await adapter.storageDelete(key);
            deleted += 1;
            continue;
        }

        updates[key] = JSON.stringify(outcome.entry);
        migrated += 1;
    }

    if (migrated > 0) await adapter.storageSetMany(updates);
    return { migrated, skipped, deleted };
}

function parseCacheEntry(raw: unknown): ParsedCacheEntry | undefined {
    if (typeof raw !== 'string') return undefined;

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return undefined;
    }

    if (!isRecord(parsed) || !isRecord(parsed.data)) return undefined;
    return { entry: parsed, data: parsed.data };
}

function renameRating(entry: Record<string, unknown>, data: Record<string, unknown>): CacheEntryOutcome {
    if (!Object.hasOwn(data, 'rating')) return { action: 'skip' };
    if (!Object.hasOwn(data, 'imdbRating')) data.imdbRating = data.rating;
    delete data.rating;
    return { action: 'update', entry };
}

function hoistIdentity(entry: Record<string, unknown>, data: Record<string, unknown>): CacheEntryOutcome {
    if (Object.hasOwn(entry, 'displayTitle') && Object.hasOwn(entry, 'imdbId')) return { action: 'skip' };

    // Old format: identity fields are nested inside `data`.
    const displayTitle = data.displayTitle;
    const imdbId = data.imdbId ?? null;

    // Unrecoverable without a display title, so drop the key instead of retrying on every run.
    if (!displayTitle || typeof displayTitle !== 'string') return { action: 'delete' };

    delete data.displayTitle;

    // New format: identity fields hoisted to the entry level, `data` keeps only
    // the rating payload. Unknown entry fields are dropped; `expires` is preserved.
    return {
        action: 'update',
        entry: {
            displayTitle,
            imdbId,
            data,
            expires: entry.expires,
        },
    };
}

const MIGRATIONS: readonly StorageMigration[] = Object.freeze([
    {
        version: 1,
        description: 'Rename cached Title.rating to Title.imdbRating',
        upgrade: async (adapter: PlatformAdapter): Promise<MigrationSummary> =>
            migrateCacheEntries(adapter, renameRating),
        onFailure: async (adapter: PlatformAdapter): Promise<MigrationSummary> => clearCache(adapter),
    },
    {
        version: 2,
        description: 'Pull displayTitle and imdbId to cache entry top level',
        upgrade: async (adapter: PlatformAdapter): Promise<MigrationSummary> =>
            migrateCacheEntries(adapter, hoistIdentity),
        onFailure: async (adapter: PlatformAdapter): Promise<MigrationSummary> => clearCache(adapter),
    },
]);

/**
 * Retrieves a migration definition by its version number for targeted migration execution.
 *
 * @param version - The migration version to find (must be positive integer).
 * @returns The migration object or undefined if not found.
 */
export function getMigrationByVersion(version: number): StorageMigration | undefined {
    return MIGRATIONS.find(m => m.version === version);
}

/**
 * Logger type for migration progress and error reporting.
 */
interface MigrationLogger {
    info: (_message: string, ..._args: unknown[]) => void;
    error: (_message: string, _error: unknown) => void;
}

/**
 * Runs each migration newer than the stored data version, applying upgrades sequentially.
 *
 * A failed upgrade, including a failed recovery handler, deliberately advances
 * the data version. This prevents a broken migration from trapping startup in
 * an infinite retry loop.
 *
 * @param adapter - Platform storage adapter for version persistence.
 * @param logger - Logger for migration progress and error reporting.
 * @param migrations - Migration array to execute (defaults to MIGRATIONS).
 * @returns Promise that resolves when all applicable migrations have been executed.
 */
export async function runMigrations(
    adapter: PlatformAdapter,
    logger: MigrationLogger,
    migrations: readonly StorageMigration[] = MIGRATIONS
): Promise<void> {
    validateMigrations(migrations);
    const currentVersion = parseStoredVersion(await adapter.storageGet(DATA_VERSION_KEY));

    for (const migration of migrations) {
        if (migration.version <= currentVersion) continue;

        try {
            const summary = await migration.upgrade(adapter);
            logger.info(`Migration ${migration.version} (${migration.description}) completed`, summary);
        } catch (error) {
            logger.error(`Migration ${migration.version} (${migration.description}) failed`, error);
            if (migration.onFailure) {
                try {
                    const summary = await migration.onFailure(adapter, error);
                    logger.info(
                        `Migration ${migration.version} (${migration.description}) recovery completed`,
                        summary
                    );
                } catch (recoveryError) {
                    logger.error(
                        `Migration ${migration.version} (${migration.description}) recovery failed`,
                        recoveryError
                    );
                }
            }
        }

        await adapter.storageSet(DATA_VERSION_KEY, String(migration.version));
    }
}

function parseStoredVersion(value: unknown): number {
    if (typeof value === 'number') {
        return Number.isSafeInteger(value) && value >= 0 ? value : 0;
    }
    if (typeof value === 'string' && /^(?:0|[1-9]\d*)$/.test(value)) {
        const version = Number(value);
        return Number.isSafeInteger(version) ? version : 0;
    }
    return 0;
}

function validateMigrations(migrations: readonly StorageMigration[]): void {
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
        if (typeof migration.description !== 'string' || migration.description.trim() === '') {
            throw new TypeError('Migration description must be a non-empty string');
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
