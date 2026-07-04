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

import { PlatformAdapter } from '../../src/platform/adapter.js';

class MockPlatformAdapter extends PlatformAdapter {
    #configGetFn;

    constructor({ configGet = () => undefined, ...rest } = {}) {
        super();
        this.#configGetFn = configGet;
        Object.assign(this, rest);
    }

    configGet(key) {
        return this.#configGetFn(key);
    }
}

export function createMockAdapter(overrides = {}) {
    const { configGet, ...rest } = overrides;
    const adapter = new MockPlatformAdapter({ configGet });
    adapter.httpFetch = vi.fn().mockResolvedValue({});
    adapter.storageGet = vi.fn().mockResolvedValue(null);
    adapter.storageSet = vi.fn().mockResolvedValue(undefined);
    adapter.storageDelete = vi.fn().mockResolvedValue(undefined);
    adapter.storageGetKeys = vi.fn().mockResolvedValue([]);
    adapter.storageGetAll = vi.fn().mockResolvedValue({});
    adapter.storageSetMany = vi.fn().mockResolvedValue(undefined);
    Object.assign(adapter, rest);
    return adapter;
}
