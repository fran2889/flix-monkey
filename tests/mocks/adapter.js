/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
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
