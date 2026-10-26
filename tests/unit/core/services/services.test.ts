/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
// The default hostname is read from window.location, which vmThreads cannot stub.
// @vitest-environment-options {"url": "https://www.netflix.com/browse"}
import { assert, describe, expect, it, vi } from 'vitest';

import { DisneyPlusService, HboMaxService, NetflixService, ServiceRegistry } from '../../../../src/core/services/index';
import {
    DisneyPlusSurfaceManager,
    HboMaxSurfaceManager,
    NetflixSurfaceManager,
} from '../../../../src/core/surfaces/index';
import { buildConfig } from '../../../mocks/config';

describe.each([
    ['Netflix', NetflixService, NetflixSurfaceManager, 'enableNetflix'],
    ['HBO Max', HboMaxService, HboMaxSurfaceManager, 'enableHboMax'],
    ['Disney+', DisneyPlusService, DisneyPlusSurfaceManager, 'enableDisneyPlus'],
])('%s service', (_name, Service, SurfaceManager, configKey) => {
    it('selects its surface manager and enablement setting', () => {
        const service = new Service();
        const config = buildConfig().build();
        vi.spyOn(config, 'getBool').mockReturnValue(false);

        expect(service.SurfaceManager).toBe(SurfaceManager);
        expect(service.isEnabled(config)).toBe(false);
        expect(config.getBool).toHaveBeenCalledOnce();
        expect(config.getBool).toHaveBeenCalledWith(configKey);
    });
});

describe('ServiceRegistry', () => {
    describe('detect()', () => {
        it('defaults to the current page hostname', () => {
            assert(ServiceRegistry.detect() instanceof NetflixService);
        });

        it.each([
            ['netflix.com', NetflixService],
            ['www.netflix.com', NetflixService],
            ['browse.netflix.com', NetflixService],
            ['play.hbomax.com', HboMaxService],
            ['www.disneyplus.com', DisneyPlusService],
        ])('returns the matching service for %s', (hostname, Service) => {
            assert(ServiceRegistry.detect(hostname) instanceof Service);
        });

        it.each(['www.hbomax.com', 'evilnetflix.com', 'www.youtube.com', ''])('returns undefined for %s', hostname => {
            assert.strictEqual(ServiceRegistry.detect(hostname), undefined);
        });
    });
});
