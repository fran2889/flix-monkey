/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
// with `new` — use class stubs so they are valid constructors.
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

    it('should wire onSave to reload Netflix tabs and close the window', async () => {
        const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});

        expect(capturedInstance.onSave).toBeTypeOf('function');
        await capturedInstance.onSave();

        expect(tabsQuerySpy).toHaveBeenCalledWith({ url: '*://*.netflix.com/*' });
        expect(tabsReloadSpy).toHaveBeenCalledWith(1);
        expect(tabsReloadSpy).toHaveBeenCalledWith(42);
        expect(closeSpy).toHaveBeenCalled();

        closeSpy.mockRestore();
    });
});
