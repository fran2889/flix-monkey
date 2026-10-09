/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Module-level spies captured by the hoisted vi.mock() factories.
let renderSpy;
let capturedInstance;
let tabsQuerySpy;
let tabsReloadSpy;
let migrationPromise;
let resolveMigrations;

vi.mock('../../../../src/core/ui/settings-ui', () => ({
    SettingsUI: class {
        constructor() {
            capturedInstance = this;
        }
        render(...args) {
            return renderSpy(...args);
        }
    },
}));

// options.js imports WebExtensionAdapter which uses webextension-polyfill.
vi.mock('webextension-polyfill', () => ({
    default: {
        storage: {
            local: {
                get: vi.fn().mockResolvedValue({}),
                set: vi.fn().mockResolvedValue(undefined),
            },
        },
        runtime: {
            sendMessage: vi.fn(() => migrationPromise),
            id: 'test-extension-id',
        },
        tabs: {
            query: (...args) => tabsQuerySpy(...args),
            reload: (...args) => tabsReloadSpy(...args),
        },
    },
}));

// options.js constructs ConfigManager, CacheManager, and DisabledClientsManager
// with `new`. Use class stubs so they are valid constructors.
vi.mock('../../../../src/core/config/config-manager', () => ({
    ConfigManager: class {
        configGet() {
            return null;
        }
    },
}));

vi.mock('../../../../src/core/cache/cache-manager', () => ({
    CacheManager: class {},
}));

vi.mock('../../../../src/core/disabled-clients', () => ({
    DisabledClientsManager: class {},
}));

describe('options.js entry point', () => {
    let browser;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        migrationPromise = new Promise(resolve => {
            resolveMigrations = resolve;
        });

        capturedInstance = null;
        renderSpy = vi.fn().mockResolvedValue(undefined);
        tabsQuerySpy = vi.fn().mockResolvedValue([{ id: 1 }, { id: 42 }]);
        tabsReloadSpy = vi.fn().mockResolvedValue(undefined);

        browser = (await import('webextension-polyfill')).default;
    });

    async function startAfterMigrations() {
        const entryImport = import('../../../../src/targets/extension/options');
        await entryImport;
        resolveMigrations({});
        await Promise.resolve();
        await Promise.resolve();
    }

    it('waits for migrations before rendering settings', async () => {
        const entryImport = import('../../../../src/targets/extension/options');
        await entryImport;

        expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ type: 'FM_RUN_MIGRATIONS' });
        expect(renderSpy).not.toHaveBeenCalled();

        resolveMigrations({});
        await Promise.resolve();
        await Promise.resolve();

        expect(renderSpy).toHaveBeenCalledWith(document.body);
        expect(renderSpy).toHaveBeenCalledAfter(browser.runtime.sendMessage);
    });

    it('should call SettingsUI.render with document.body', async () => {
        await startAfterMigrations();
        expect(renderSpy).toHaveBeenCalledWith(document.body);
    });

    it('should render settings UI without onSave callback', async () => {
        await startAfterMigrations();
        expect(capturedInstance).not.toBeNull();
        expect(renderSpy).toHaveBeenCalledWith(document.body);
    });
});
