import { describe, it, expect, vi } from 'vitest';

// Mock polyfill before importing adapter
vi.mock('webextension-polyfill', () => ({
    default: {
        storage: { local: { get: vi.fn(), set: vi.fn() } },
        runtime: { sendMessage: vi.fn() }
    }
}));

import { PlatformAdapter } from '../../../src/platform/adapter.js';
import { UserscriptAdapter } from '../../../src/platform/userscript.js';
import { WebExtensionAdapter } from '../../../src/platform/webextension.js';

describe('PlatformAdapter Contract', () => {
    const adapters = [new UserscriptAdapter(), new WebExtensionAdapter()];

    adapters.forEach(adapter => {
        it(`${adapter.constructor.name} should implement storageGet`, async () => {
            expect(typeof adapter.storageGet).toBe('function');
        });

        it(`${adapter.constructor.name} should implement storageSet`, async () => {
            expect(typeof adapter.storageSet).toBe('function');
        });

        it(`${adapter.constructor.name} should implement httpFetch`, async () => {
            expect(typeof adapter.httpFetch).toBe('function');
        });

        it(`${adapter.constructor.name} should implement registerMenuCommand`, async () => {
            expect(typeof adapter.registerMenuCommand).toBe('function');
        });
    });
});
