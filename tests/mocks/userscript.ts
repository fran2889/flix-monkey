/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

export const GM_xmlhttpRequest = vi.fn();
export const GM_config = {
    init: vi.fn(),
    get: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
    save: vi.fn(),
};

// Stub globals for TypeScript
vi.stubGlobal('GM_xmlhttpRequest', GM_xmlhttpRequest);
vi.stubGlobal('GM_getValue', vi.fn());
vi.stubGlobal('GM_setValue', vi.fn());
vi.stubGlobal('GM_deleteValue', vi.fn());
vi.stubGlobal('GM_listValues', vi.fn());
vi.stubGlobal('GM_registerMenuCommand', vi.fn());
vi.stubGlobal('GM_config', GM_config);
