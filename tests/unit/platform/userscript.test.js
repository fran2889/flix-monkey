import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserscriptAdapter } from '../../../src/platform/userscript.js';

describe('UserscriptAdapter', () => {
    let adapter;

    beforeEach(() => {
        vi.stubGlobal('GM_getValue', vi.fn());
        vi.stubGlobal('GM_setValue', vi.fn());
        vi.stubGlobal('GM_xmlhttpRequest', vi.fn());
        vi.stubGlobal('GM_registerMenuCommand', vi.fn());
        adapter = new UserscriptAdapter();
    });

    it('storageGet should call GM_getValue', async () => {
        GM_getValue.mockReturnValue('test-value');
        const result = await adapter.storageGet('key');
        expect(GM_getValue).toHaveBeenCalledWith('key');
        expect(result).toBe('test-value');
    });

    it('storageSet should call GM_setValue', async () => {
        await adapter.storageSet('key', 'value');
        expect(GM_setValue).toHaveBeenCalledWith('key', 'value');
    });
});
