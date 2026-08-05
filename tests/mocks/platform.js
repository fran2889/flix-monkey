/**
 * SPDX-FileCopyrightText: 2026 Fran
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { vi } from 'vitest';

export function setupUserscriptMocks() {
    vi.stubGlobal('GM_getValue', vi.fn());
    vi.stubGlobal('GM_setValue', vi.fn());
    vi.stubGlobal('GM_deleteValue', vi.fn());
    vi.stubGlobal('GM_listValues', vi.fn());
    vi.stubGlobal('GM_xmlhttpRequest', vi.fn());
    vi.stubGlobal('GM_registerMenuCommand', vi.fn());
}
