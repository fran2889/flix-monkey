import { vi } from 'vitest';

export function setupUserscriptMocks() {
    vi.stubGlobal('GM_getValue', vi.fn());
    vi.stubGlobal('GM_setValue', vi.fn());
    vi.stubGlobal('GM_xmlhttpRequest', vi.fn());
    vi.stubGlobal('GM_registerMenuCommand', vi.fn());
}
