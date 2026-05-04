import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startApp } from '../../../src/core/app.js';

vi.mock('../../../src/platform/userscript.js');
vi.mock('../../../src/core/config.js');
vi.mock('../../../src/core/config-fields.js', () => ({
    CONFIG_FIELDS: [],
    CONFIG_DEFAULTS: {}
}));
vi.mock('../../../src/core/app.js');

describe('Userscript Entry', () => {
    beforeEach(() => {
        vi.stubGlobal('GM_config', {
            init: vi.fn(),
            get: vi.fn(),
            open: vi.fn(),
            close: vi.fn(),
            save: vi.fn()
        });
        vi.stubGlobal('window', {
            location: { reload: vi.fn() },
            GM_config: GM_config
        });
    });

    it('should initialize GM_config with correct fields', async () => {
        await import('../../../src/targets/userscript/entry.js');
        expect(window.GM_config.init).toHaveBeenCalled();
        const callArgs = window.GM_config.init.mock.calls[0][0];
        expect(callArgs.id).toBe('FlixMonkey');
    });
});
