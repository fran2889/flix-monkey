// tests/mocks/userscript.js
export const GM_info = {};
export const GM_xmlhttpRequest = vi.fn();
export const GM_config = {
    init: vi.fn(),
    get: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
    save: vi.fn(),
};
window.GM_config = GM_config;
