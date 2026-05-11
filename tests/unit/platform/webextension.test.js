import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebExtensionAdapter } from '../../../src/platform/webextension.js';
import browser from 'webextension-polyfill';

vi.mock('webextension-polyfill', () => ({
    default: {
        storage: { local: { get: vi.fn(), set: vi.fn() } },
        runtime: { sendMessage: vi.fn() },
    },
}));

describe('WebExtensionAdapter', () => {
    let adapter;

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = new WebExtensionAdapter();
    });

    it('storageGet should call storage.local.get', async () => {
        browser.storage.local.get.mockResolvedValue({ key: 'value' });
        const result = await adapter.storageGet('key');
        expect(browser.storage.local.get).toHaveBeenCalledWith('key');
        expect(result).toBe('value');
    });

    it('storageSet should call storage.local.set', async () => {
        await adapter.storageSet('key', 'value');
        expect(browser.storage.local.set).toHaveBeenCalledWith({ key: 'value' });
    });
});
