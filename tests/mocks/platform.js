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
import { vi } from 'vitest';

export function setupUserscriptMocks() {
    vi.stubGlobal('GM_getValue', vi.fn());
    vi.stubGlobal('GM_setValue', vi.fn());
    vi.stubGlobal('GM_deleteValue', vi.fn());
    vi.stubGlobal('GM_listValues', vi.fn());
    vi.stubGlobal('GM_xmlhttpRequest', vi.fn());
    vi.stubGlobal('GM_registerMenuCommand', vi.fn());
}
