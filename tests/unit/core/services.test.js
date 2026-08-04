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

import { afterEach, assert, describe, it, vi } from 'vitest';

import {
    DisneyPlusService,
    HboMaxService,
    NetflixService,
    ServiceRegistry,
    SERVICES,
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

describe('Disney+ service registry metadata', () => {
    it('registers the disneyplus service with its ID and domain', () => {
        assert.instanceOf(SERVICES.disneyplus, DisneyPlusService);
        assert.equal(SERVICES.disneyplus.id, 'disneyplus');
        assert.deepEqual(SERVICES.disneyplus.domains, ['disneyplus.com']);
    });
});
