/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
// The default hostname is read from window.location, which vmThreads cannot stub.
// @vitest-environment-options {"url": "https://www.netflix.com/browse"}
import { assert, describe, expect, it, vi } from 'vitest';

import { DisneyPlusService, HboMaxService, NetflixService, ServiceRegistry } from '../../../../src/core/services/index';
import { DISNEY_PLUS_SURFACES, HBO_MAX_SURFACES, NETFLIX_SURFACES } from '../../../../src/core/surfaces/index';
import { buildConfig } from '../../../mocks/config';

describe.each([
    ['Netflix', NetflixService, NETFLIX_SURFACES, 'enableNetflix'],
    ['HBO Max', HboMaxService, HBO_MAX_SURFACES, 'enableHboMax'],
    ['Disney+', DisneyPlusService, DISNEY_PLUS_SURFACES, 'enableDisneyPlus'],
])('%s service', (_name, Service, surfaceDefinitions, configKey) => {
    it('selects its surface definitions and enablement setting', () => {
        const service = new Service();
        const config = buildConfig().build();
        vi.spyOn(config, 'getBool').mockReturnValue(false);

        expect(service.surfaceDefinitions).toBe(surfaceDefinitions);
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
            ['hbomax.com', HboMaxService],
            ['play.hbomax.com', HboMaxService],
            ['www.hbomax.com', HboMaxService],
            ['www.disneyplus.com', DisneyPlusService],
        ])('returns the matching service for %s', (hostname, Service) => {
            assert(ServiceRegistry.detect(hostname) instanceof Service);
        });

        it.each(['evilhbomax.com', 'hbomax.com.evil.com', 'evilnetflix.com', 'www.youtube.com', ''])(
            'returns undefined for %s',
            hostname => {
                assert.strictEqual(ServiceRegistry.detect(hostname), undefined);
            }
        );
    });
});
