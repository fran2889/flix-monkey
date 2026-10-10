/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

let adapter: { registerMenuCommand: Mock };
let appHandle: { cacheManager: unknown; disabledManager: unknown } | null;
let cacheConstructor: Mock<(..._args: unknown[]) => unknown>;
let configConstructor: Mock<(..._args: unknown[]) => unknown>;
let disabledConstructor: Mock<(..._args: unknown[]) => unknown>;
let loggerConstructor: Mock<(..._args: unknown[]) => unknown>;
let settingsConstructor: Mock<(..._args: unknown[]) => void>;
let migrationRunner: Mock<(..._args: unknown[]) => Promise<unknown>>;
let resolveMigrations: (_value?: unknown) => void;

vi.mock('../../../../src/core/app', () => ({
    startApp: vi.fn(() => appHandle),
}));

vi.mock('../../../../src/platform/userscript', () => ({
    UserscriptAdapter: class {
        constructor() {
            return adapter;
        }
    },
}));

// Mock the actual implementations - these are test mocks
// The constructor return types don't match the actual classes because we're returning mock objects

vi.mock('../../../../src/core/cache/cache-manager', () => ({
    CacheManager: class {
        constructor(..._args: any[]) {
            // @ts-ignore - constructor returns mock object, not actual CacheManager
            return cacheConstructor(..._args);
        }
    },
}));

vi.mock('../../../../src/core/config/config-manager', () => ({
    ConfigManager: class {
        constructor(..._args: any[]) {
            // @ts-ignore - constructor returns mock object, not actual ConfigManager
            return configConstructor(..._args);
        }
    },
}));

vi.mock('../../../../src/core/disabled-clients', () => ({
    DisabledClientsManager: class {
        constructor(..._args: any[]) {
            // @ts-ignore - constructor returns mock object, not actual DisabledClientsManager
            return disabledConstructor(..._args);
        }
    },
}));

vi.mock('../../../../src/core/logger', () => ({
    Logger: class {
        constructor(..._args: any[]) {
            // @ts-ignore - constructor returns mock object, not actual Logger
            return loggerConstructor(..._args);
        }
    },
}));

vi.mock('../../../../src/core/migrations', () => ({
    runMigrations: vi.fn((..._args: any[]) => migrationRunner(..._args)),
}));

vi.mock('../../../../src/core/ui/modal', () => ({
    Modal: class {
        getContentContainer() {
            return document.body;
        }

        close() {}

        open() {}
    },
}));

vi.mock('../../../../src/core/ui/settings-ui', () => ({
    SettingsUI: class {
        constructor(..._args: any[]) {
            settingsConstructor(..._args);
        }

        render() {
            return Promise.resolve();
        }
    },
}));

describe('userscript entry point', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        adapter = {
            registerMenuCommand: vi.fn(),
        };
        appHandle = null;
        cacheConstructor = vi.fn((..._: any[]) => ({ source: 'fallback-cache' }));
        configConstructor = vi.fn((..._: any[]) => ({ source: 'fallback-config' }));
        disabledConstructor = vi.fn((..._: any[]) => ({ source: 'fallback-disabled' }));
        loggerConstructor = vi.fn((..._: any[]) => ({ source: 'fallback-logger' }));
        settingsConstructor = vi.fn();
        migrationRunner = vi.fn(
            (..._: any[]) =>
                new Promise((resolve: (_value: unknown) => void) => {
                    resolveMigrations = resolve;
                })
        );
    });

    it('waits for migrations before starting the app and registering the menu', async () => {
        const migrationsModule = await import('../../../../src/core/migrations');
        const appModule = await import('../../../../src/core/app');

        await import('../../../../src/targets/userscript/entry');

        expect(migrationsModule.runMigrations).toHaveBeenCalledWith(adapter, expect.anything());
        expect(appModule.startApp).not.toHaveBeenCalled();
        expect(adapter.registerMenuCommand).not.toHaveBeenCalled();

        // @ts-ignore - resolveMigrations expects a value but we're resolving without one
        resolveMigrations();
        await vi.waitFor(() => {
            expect(appModule.startApp).toHaveBeenCalledWith(adapter);
            expect(adapter.registerMenuCommand).toHaveBeenCalledWith('FlixMonkey Settings', expect.any(Function));
        });

        // @ts-ignore - accessing .mock on vi.mock'd function
        expect((migrationsModule.runMigrations as Mock).mock.calls[0][1]).toBe(loggerConstructor.mock.results[0].value);
        expect(loggerConstructor).toHaveBeenCalledWith(adapter);
        // @ts-ignore - accessing .mock on vi.mock'd function
        expect((appModule.startApp as Mock).mock.invocationCallOrder[0]).toBeGreaterThan(
            // @ts-ignore - accessing .mock on vi.mock'd function
            (migrationsModule.runMigrations as Mock).mock.invocationCallOrder[0]
        );
        expect((adapter.registerMenuCommand as Mock).mock.invocationCallOrder[0]).toBeGreaterThan(
            // @ts-ignore - accessing .mock on vi.mock'd function
            (appModule.startApp as Mock).mock.invocationCallOrder[0]
        );
    });

    it('registers the settings menu when startApp returns null', async () => {
        const appModule = await import('../../../../src/core/app');
        const migrationsModule = await import('../../../../src/core/migrations');

        await import('../../../../src/targets/userscript/entry');
        // @ts-ignore - resolveMigrations expects a value but we're resolving without one
        resolveMigrations();
        await vi.waitFor(() => expect(adapter.registerMenuCommand).toHaveBeenCalled());

        expect(appModule.startApp).toHaveBeenCalledOnce();
        expect(adapter.registerMenuCommand).toHaveBeenCalledWith('FlixMonkey Settings', expect.any(Function));
        expect(loggerConstructor).toHaveBeenCalledWith(adapter);
        expect(configConstructor).not.toHaveBeenCalled();
        expect(cacheConstructor).not.toHaveBeenCalled();
        expect(disabledConstructor).not.toHaveBeenCalled();

        // @ts-ignore - accessing .mock on vi.mock'd function
        const menuCallback = (adapter.registerMenuCommand as Mock).mock.calls[0][1];
        menuCallback();

        const logger = loggerConstructor.mock.results[0].value;
        // @ts-ignore - accessing .mock on vi.mock'd function
        expect((migrationsModule.runMigrations as Mock).mock.calls[0][1]).toBe(logger);
        const config = configConstructor.mock.results[0].value;
        const cacheManager = cacheConstructor.mock.results[0].value;
        const disabledManager = disabledConstructor.mock.results[0].value;
        expect(loggerConstructor).toHaveBeenCalledWith(adapter);
        expect(configConstructor).toHaveBeenCalledWith(adapter, logger);
        expect(cacheConstructor).toHaveBeenCalledWith(adapter, config, logger);
        expect(disabledConstructor).toHaveBeenCalledWith(adapter);
        expect(settingsConstructor).toHaveBeenCalledWith(adapter, logger, cacheManager, disabledManager);
    });

    it('uses the app managers in the settings menu when startApp returns an app handle', async () => {
        const cacheManager = { source: 'app-cache' };
        const disabledManager = { source: 'app-disabled' };
        appHandle = { cacheManager, disabledManager };

        await import('../../../../src/targets/userscript/entry');
        // @ts-ignore - resolveMigrations expects a value but we're resolving without one
        resolveMigrations();
        await vi.waitFor(() => expect(adapter.registerMenuCommand).toHaveBeenCalled());
        const menuCallback = adapter.registerMenuCommand.mock.calls[0][1];
        menuCallback();

        const logger = loggerConstructor.mock.results[0].value;
        expect(settingsConstructor).toHaveBeenCalledWith(adapter, logger, cacheManager, disabledManager);
        expect(cacheConstructor).not.toHaveBeenCalled();
        expect(disabledConstructor).not.toHaveBeenCalled();
    });
});
