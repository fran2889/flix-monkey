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

import { afterEach, assert, describe, it } from 'vitest';

import { NetflixService, ServiceRegistry, SERVICES, StreamingService } from '../../../src/core/services.js';

describe('StreamingService', () => {
    it('throws on unimplemented id getter', () => {
        const service = new StreamingService();
        assert.throws(() => service.id, /Not implemented/);
    });

    it('throws on unimplemented domains getter', () => {
        const service = new StreamingService();
        assert.throws(() => service.domains, /Not implemented/);
    });

    it('throws on unimplemented SurfaceManager getter', () => {
        const service = new StreamingService();
        assert.throws(() => service.SurfaceManager, /Not implemented/);
    });

    it('returns empty object for constants by default', () => {
        const service = new StreamingService();
        assert.deepEqual(service.constants, {});
    });
});

describe('NetflixService', () => {
    it('has id netflix', () => {
        const service = new NetflixService();
        assert.equal(service.id, 'netflix');
    });

    it('has netflix.com and www.netflix.com domains', () => {
        const service = new NetflixService();
        assert.deepEqual(service.domains, ['netflix.com', 'www.netflix.com']);
    });

    it('returns domains as frozen object', () => {
        const service = new NetflixService();
        assert(Object.isFrozen(service.domains));
    });

    it('provides TOP_10_BADGE constant', () => {
        const service = new NetflixService();
        assert.equal(service.constants.TOP_10_BADGE, 'title-card-top-10');
    });

    it('returns constants as frozen object', () => {
        const service = new NetflixService();
        assert(Object.isFrozen(service.constants));
    });
});

describe('SERVICES registry', () => {
    it('contains netflix service', () => {
        assert('netflix' in SERVICES);
    });

    it('netflix service is a NetflixService instance', () => {
        assert(SERVICES.netflix instanceof NetflixService);
    });

    it('registry is frozen', () => {
        assert(Object.isFrozen(SERVICES));
    });
});

describe('ServiceRegistry', () => {
    const originalLocation = window.location;

    afterEach(() => {
        Object.defineProperty(window, 'location', { value: originalLocation });
    });

    describe('detect()', () => {
        it('returns Netflix service on netflix.com', () => {
            Object.defineProperty(window, 'location', {
                value: { hostname: 'www.netflix.com' },
                configurable: true,
            });
            const service = ServiceRegistry.detect();
            assert.notEqual(service, null);
            assert.equal(service.id, 'netflix');
        });

        it('returns Netflix service on netflix.com subdomain', () => {
            Object.defineProperty(window, 'location', {
                value: { hostname: 'netflix.com' },
                configurable: true,
            });
            const service = ServiceRegistry.detect();
            assert.notEqual(service, null);
            assert.equal(service.id, 'netflix');
        });

        it('returns null on unknown domain', () => {
            Object.defineProperty(window, 'location', {
                value: { hostname: 'www.youtube.com' },
                configurable: true,
            });
            const service = ServiceRegistry.detect();
            assert.equal(service, null);
        });

        it('returns null on empty hostname', () => {
            Object.defineProperty(window, 'location', {
                value: { hostname: '' },
                configurable: true,
            });
            const service = ServiceRegistry.detect();
            assert.equal(service, null);
        });
    });
});
