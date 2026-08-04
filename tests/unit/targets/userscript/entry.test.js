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
import { beforeEach, describe, expect, it, vi } from 'vitest';

let adapter;
let appHandle;
let cacheConstructor;
let configConstructor;
let disabledConstructor;
let loggerConstructor;
let settingsConstructor;

vi.mock('../../../../src/core/app.js', () => ({
    startApp: vi.fn(() => appHandle),
}));

vi.mock('../../../../src/platform/userscript.js', () => ({
    UserscriptAdapter: class {
        constructor() {
            return adapter;
        }
    },
}));

vi.mock('../../../../src/core/cache.js', () => ({
    CacheManager: class {
        constructor(...args) {
            return cacheConstructor(...args);
        }
    },
}));

vi.mock('../../../../src/core/config-manager.js', () => ({
    ConfigManager: class {
        constructor(...args) {
            return configConstructor(...args);
        }
    },
}));

vi.mock('../../../../src/core/disabled-clients.js', () => ({
    DisabledClientsManager: class {
        constructor(...args) {
            return disabledConstructor(...args);
        }
    },
}));

vi.mock('../../../../src/core/logger.js', () => ({
    Logger: class {
        constructor(...args) {
            return loggerConstructor(...args);
        }
    },
}));

vi.mock('../../../../src/core/ui/modal.js', () => ({
    Modal: class {
        getContentContainer() {
            return document.body;
        }

        close() {}

        open() {}
    },
}));

vi.mock('../../../../src/core/ui/settings-ui.js', () => ({
    SettingsUI: class {
        constructor(...args) {
            settingsConstructor(...args);
        }

        render() {
            return Promise.resolve();
        }
    },
}));

describe('userscript entry point', () => {
    beforeEach(() => {
        vi.resetModules();
        adapter = {
            registerMenuCommand: vi.fn(),
        };
        appHandle = null;
        cacheConstructor = vi.fn(() => ({ source: 'fallback-cache' }));
        configConstructor = vi.fn(() => ({ source: 'fallback-config' }));
        disabledConstructor = vi.fn(() => ({ source: 'fallback-disabled' }));
        loggerConstructor = vi.fn(() => ({ source: 'fallback-logger' }));
        settingsConstructor = vi.fn();
    });

    it('registers the settings menu when startApp returns null', async () => {
        const appModule = await import('../../../../src/core/app.js');

        await expect(import('../../../../src/targets/userscript/entry.js')).resolves.toBeDefined();

        expect(appModule.startApp).toHaveBeenCalledOnce();
        expect(adapter.registerMenuCommand).toHaveBeenCalledWith('FlixMonkey Settings', expect.any(Function));
        expect(loggerConstructor).not.toHaveBeenCalled();
        expect(configConstructor).not.toHaveBeenCalled();
        expect(cacheConstructor).not.toHaveBeenCalled();
        expect(disabledConstructor).not.toHaveBeenCalled();

        const menuCallback = adapter.registerMenuCommand.mock.calls[0][1];
        menuCallback();

        const logger = loggerConstructor.mock.results[0].value;
        const config = configConstructor.mock.results[0].value;
        const cacheManager = cacheConstructor.mock.results[0].value;
        const disabledManager = disabledConstructor.mock.results[0].value;
        expect(loggerConstructor).toHaveBeenCalledWith(adapter);
        expect(configConstructor).toHaveBeenCalledWith(adapter, logger);
        expect(cacheConstructor).toHaveBeenCalledWith(adapter, config, logger);
        expect(disabledConstructor).toHaveBeenCalledWith(adapter);
        expect(settingsConstructor).toHaveBeenCalledWith(adapter, undefined, cacheManager, disabledManager);
    });

    it('uses the app managers in the settings menu when startApp returns an app handle', async () => {
        const cacheManager = { source: 'app-cache' };
        const disabledManager = { source: 'app-disabled' };
        appHandle = { cacheManager, disabledManager };

        await import('../../../../src/targets/userscript/entry.js');
        const menuCallback = adapter.registerMenuCommand.mock.calls[0][1];
        menuCallback();

        expect(settingsConstructor).toHaveBeenCalledWith(adapter, undefined, cacheManager, disabledManager);
        expect(cacheConstructor).not.toHaveBeenCalled();
        expect(disabledConstructor).not.toHaveBeenCalled();
    });
});
