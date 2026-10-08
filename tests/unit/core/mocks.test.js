/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it } from 'vitest';

import { BaseApiClient } from '../../../src/core/api/base-api-client.js';
import { CacheManager } from '../../../src/core/cache/cache-manager.js';
import { DisabledClientsManager } from '../../../src/core/disabled-clients.js';
import { FadeManager } from '../../../src/core/fade-manager.js';
import { IdOverrideManager } from '../../../src/core/id-override-manager.js';
import { OverlayRenderer } from '../../../src/core/overlay.js';
import { SurfaceManager } from '../../../src/core/surfaces/index.js';
import { buildMockApiClient } from '../../mocks/api-client.js';
import { buildMockCacheManager } from '../../mocks/cache-manager.js';
import { buildMockDisabledClientsManager } from '../../mocks/disabled-clients.js';
import { buildMockFadeManager } from '../../mocks/fade-manager.js';
import { buildMockIdOverrideManager } from '../../mocks/id-override-manager.js';
import { buildMockOverlayRenderer } from '../../mocks/overlay-renderer.js';
import { buildMockSurfaceManager } from '../../mocks/surface-manager.js';

/**
 * Lists the public methods a class declares on its prototype, excluding the
 * constructor and any accessors.
 *
 * Reads property descriptors rather than the values, so an accessor backed by
 * an uninitialised #private field is not invoked.
 *
 * @param {Function} Class - Class to inspect.
 * @returns {string[]} Method names.
 */
function publicMethodNames(Class) {
    return Object.getOwnPropertyNames(Class.prototype).filter(name => {
        if (name === 'constructor') return false;
        const descriptor = Object.getOwnPropertyDescriptor(Class.prototype, name);
        return 'value' in descriptor && typeof descriptor.value === 'function';
    });
}

const DOUBLES = [
    ['BaseApiClient', BaseApiClient, buildMockApiClient],
    ['CacheManager', CacheManager, buildMockCacheManager],
    ['DisabledClientsManager', DisabledClientsManager, buildMockDisabledClientsManager],
    ['FadeManager', FadeManager, buildMockFadeManager],
    ['IdOverrideManager', IdOverrideManager, buildMockIdOverrideManager],
    ['OverlayRenderer', OverlayRenderer, buildMockOverlayRenderer],
    ['SurfaceManager', SurfaceManager, buildMockSurfaceManager],
];

describe('Mock completeness', () => {
    // Each builder's build() casts its literal through unknown to return the
    // real class, because a plain object cannot satisfy one declaring #private
    // fields, and a cast from unknown is unchecked. MockOf makes members
    // optional so a double can stand in for the real class, which means neither
    // the typedef nor the cast catches a dropped method. At runtime the drop
    // only shows up as "is not a function" in whichever suite happens to reach
    // it, so it is pinned here instead.
    it.each(DOUBLES)('buildMock for %s provides every public method', (_name, Class, build) => {
        const double = build().build();

        for (const method of publicMethodNames(Class)) {
            expect(typeof double[method], `${_name} double is missing ${method}()`).toBe('function');
        }
    });
});
