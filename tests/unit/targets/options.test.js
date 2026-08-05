/**
 * SPDX-FileCopyrightText: 2026 Fran
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Module-level spies captured by the hoisted vi.mock() factories.
let renderSpy;
let capturedInstance;
let tabsQuerySpy;
let tabsReloadSpy;

vi.mock('../../../src/core/ui/settings-ui.js', () => ({
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
            sendMessage: vi.fn().mockResolvedValue({ data: {} }),
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
vi.mock('../../../src/core/config-manager.js', () => ({
    ConfigManager: class {
        configGet() {
            return null;
        }
    },
}));

vi.mock('../../../src/core/cache.js', () => ({
    CacheManager: class {},
}));

vi.mock('../../../src/core/disabled-clients.js', () => ({
    DisabledClientsManager: class {},
}));

describe('options.js entry point', () => {
    beforeEach(async () => {
        vi.resetModules();

        capturedInstance = null;
        renderSpy = vi.fn().mockResolvedValue(undefined);
        tabsQuerySpy = vi.fn().mockResolvedValue([{ id: 1 }, { id: 42 }]);
        tabsReloadSpy = vi.fn().mockResolvedValue(undefined);

        await import('../../../src/targets/extension/options.js');
    });

    it('should call SettingsUI.render with document.body', () => {
        expect(renderSpy).toHaveBeenCalledWith(document.body);
    });

    it('should wire onSave to reload Netflix, HBO Max, and Disney+ tabs', async () => {
        expect(capturedInstance.onSave).toBeTypeOf('function');
        await capturedInstance.onSave();

        expect(tabsQuerySpy).toHaveBeenCalledWith({
            url: ['*://*.netflix.com/*', '*://play.hbomax.com/*', '*://www.disneyplus.com/*'],
        });
        expect(tabsReloadSpy).toHaveBeenCalledWith(1);
        expect(tabsReloadSpy).toHaveBeenCalledWith(42);
    });
});
