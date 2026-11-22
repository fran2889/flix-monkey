/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { flushAsyncWork } from '../../../helpers/async';

// Module-level spies captured by the hoisted vi.mock() factories.
let renderSpy: Mock;
let tabsQuerySpy: Mock;
let tabsReloadSpy: Mock;
let migrationPromise: Promise<unknown>;
let resolveMigrations: (_value: unknown) => void;

vi.mock('../../../../src/core/ui/settings-ui', () => ({
    SettingsUI: class {
        render(..._args: unknown[]) {
            return renderSpy(..._args);
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
            query: (..._args: unknown[]) => tabsQuerySpy(..._args),
            reload: (..._args: unknown[]) => tabsReloadSpy(..._args),
        },
    },
}));

// options.js constructs ConfigManager, CacheManager, and DisabledClientsManager
// with `new`. Use class stubs so they are valid constructors.
vi.mock('../../../../src/core/config/config-manager', () => ({
    ConfigManager: class {
        configGet() {
            return undefined;
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
    let browser: {
        runtime: { sendMessage: Mock; id: string };
        storage: { local: { get: Mock; set: Mock } };
        tabs: { query: Mock; reload: Mock };
    };

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.useFakeTimers();

        migrationPromise = new Promise(resolve => {
            resolveMigrations = resolve;
        });

        renderSpy = vi.fn().mockResolvedValue(undefined);
        tabsQuerySpy = vi.fn().mockResolvedValue([{ id: 1 }, { id: 42 }]);
        tabsReloadSpy = vi.fn().mockResolvedValue(undefined);

        browser = (await import('webextension-polyfill')).default as unknown as {
            runtime: { sendMessage: Mock; id: string };
            storage: { local: { get: Mock; set: Mock } };
            tabs: { query: Mock; reload: Mock };
        };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('waits for migrations before rendering settings', async () => {
        const entryImport = import('../../../../src/targets/extension/options');
        await entryImport;

        expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ type: 'FM_RUN_MIGRATIONS' });
        expect(renderSpy).not.toHaveBeenCalled();

        resolveMigrations({});
        await flushAsyncWork();

        expect(renderSpy).toHaveBeenCalledWith(document.body);
        expect(renderSpy).toHaveBeenCalledAfter(browser.runtime.sendMessage);
    });

    it('does not render settings and logs when migrations report an error', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        migrationPromise = Promise.resolve({ error: 'migration boom' });

        await import('../../../../src/targets/extension/options');

        await flushAsyncWork();
        expect(errorSpy).toHaveBeenCalled();
        expect(renderSpy).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith(
            '[FlixMonkey] FlixMonkey options page failed to start',
            expect.any(Error)
        );
        errorSpy.mockRestore();
    });
});
