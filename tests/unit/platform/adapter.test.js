import { describe, it, expect } from 'vitest';
import { PlatformAdapter } from '../../../src/platform/adapter.js';

describe('PlatformAdapter', () => {
    const adapter = new PlatformAdapter();

    it('should throw an error if storageGet is not implemented', async () => {
        await expect(adapter.storageGet('key')).rejects.toThrow('PlatformAdapter: storageGet() must be implemented by subclass');
    });

    it('should throw an error if storageSet is not implemented', async () => {
        await expect(adapter.storageSet('key', 'value')).rejects.toThrow('PlatformAdapter: storageSet() must be implemented by subclass');
    });

    it('should throw an error if httpFetch is not implemented', async () => {
        await expect(adapter.httpFetch('url', {})).rejects.toThrow('PlatformAdapter: httpFetch() must be implemented by subclass');
    });

    it('should throw an error if registerMenuCommand is not implemented', () => {
        expect(() => adapter.registerMenuCommand('label', () => {})).toThrow('PlatformAdapter: registerMenuCommand() must be implemented by subclass');
    });
});
