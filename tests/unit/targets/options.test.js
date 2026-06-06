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

// Module-level spy captured by the hoisted vi.mock() factory.
let renderSpy;

vi.mock('../../../src/core/ui/settings-ui.js', () => ({
    SettingsUI: class {
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

        // Provide a fresh spy for each test run.
        renderSpy = vi.fn().mockResolvedValue(undefined);

        await import('../../../src/targets/extension/options.js');
    });

    it('should call SettingsUI.render with document.body', () => {
        expect(renderSpy).toHaveBeenCalledWith(document.body);
    });
});
