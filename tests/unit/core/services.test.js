/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { afterEach, assert, describe, it, vi } from 'vitest';

import {
    DisneyPlusService,
    HboMaxService,
    NetflixService,
    ServiceRegistry,
    StreamingService,
} from '../../../src/core/services.js';
import { DisneyPlusSurfaceManager, HboMaxSurfaceManager, NetflixSurfaceManager } from '../../../src/core/surfaces.js';

describe('StreamingService', () => {
    it.each([
        ['id', service => service.id],
        ['domains', service => service.domains],
        ['SurfaceManager', service => service.SurfaceManager],
        ['isEnabled', service => service.isEnabled({ getBool: () => true })],
    ])('throws on unimplemented %s', (_member, access) => {
        const service = new StreamingService();
        assert.throws(() => access(service), /Not implemented/);
    });
});

describe.each([
    ['Netflix', NetflixService, NetflixSurfaceManager, 'enableNetflix'],
    ['HBO Max', HboMaxService, HboMaxSurfaceManager, 'enableHboMax'],
    ['Disney+', DisneyPlusService, DisneyPlusSurfaceManager, 'enableDisneyPlus'],
])('%s service', (_name, Service, SurfaceManager, configKey) => {
    // NOSONAR: Vitest assertions below are not recognized in this parameterized test.
    it('selects its surface manager and enablement setting', () => {
        const service = new Service();
        const config = { getBool: vi.fn().mockReturnValue(false) };

        assert.equal(service.SurfaceManager, SurfaceManager);
        assert.equal(service.isEnabled(config), false);
        assert.deepEqual(config.getBool.mock.calls, [[configKey]]);
    });
});

describe('ServiceRegistry', () => {
    const originalLocation = window.location;

    afterEach(() => {
        Object.defineProperty(window, 'location', { value: originalLocation });
    });

    describe('detect()', () => {
        it.each([
            ['netflix.com', NetflixService],
            ['www.netflix.com', NetflixService],
            ['browse.netflix.com', NetflixService],
            ['play.hbomax.com', HboMaxService],
            ['www.disneyplus.com', DisneyPlusService],
        ])('returns the matching service for %s', (hostname, Service) => {
            Object.defineProperty(window, 'location', {
                value: { hostname },
                configurable: true,
            });
            assert(ServiceRegistry.detect() instanceof Service);
        });

        it.each(['www.hbomax.com', 'evilnetflix.com', 'www.youtube.com', ''])('returns null for %s', hostname => {
            Object.defineProperty(window, 'location', {
                value: { hostname },
                configurable: true,
            });
            assert.equal(ServiceRegistry.detect(), null);
        });
    });
});
