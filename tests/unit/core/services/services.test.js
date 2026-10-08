/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { afterEach, assert, describe, expect, it, vi } from 'vitest';

import {
    DisneyPlusService,
    HboMaxService,
    NetflixService,
    ServiceRegistry,
    StreamingService,
} from '../../../../src/core/services/index.js';
import {
    DisneyPlusSurfaceManager,
    HboMaxSurfaceManager,
    NetflixSurfaceManager,
} from '../../../../src/core/surfaces/index.js';
import { buildConfig } from '../../../mocks/config.js';

describe('StreamingService', () => {
    it.each([
        ['domains', service => service.domains],
        ['SurfaceManager', service => service.SurfaceManager],
        ['isEnabled', service => service.isEnabled(buildConfig().build())],
    ])('throws on unimplemented %s', (_member, access) => {
        const service = new StreamingService();
        assert.throws(() => access(service), /Not implemented/);
    });
});

describe.each([
    ['Netflix', NetflixService, NetflixSurfaceManager, 'enableNetflix', 'withEnableNetflix'],
    ['HBO Max', HboMaxService, HboMaxSurfaceManager, 'enableHboMax', 'withEnableHboMax'],
    ['Disney+', DisneyPlusService, DisneyPlusSurfaceManager, 'enableDisneyPlus', 'withEnableDisneyPlus'],
])('%s service', (_name, Service, SurfaceManager, configKey, configMethod) => {
    it('selects its surface manager and enablement setting', () => {
        const service = new Service();
        const config = buildConfig()[configMethod](false).build();
        const getBoolSpy = vi.spyOn(config, 'getBool');

        expect(service.SurfaceManager).toBe(SurfaceManager);
        expect(service.isEnabled(config)).toBe(false);
        expect(getBoolSpy).toHaveBeenCalledTimes(1);
        expect(getBoolSpy).toHaveBeenCalledWith(configKey);
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
