/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { DisneyPlusService } from './disney-plus-service.js';
import { HboMaxService } from './hbo-max-service.js';
import { NetflixService } from './netflix-service.js';

const SERVICES = Object.freeze({
    netflix: new NetflixService(),
    hbomax: new HboMaxService(),
    disneyplus: new DisneyPlusService(),
});

/** Registry for detecting and accessing streaming service implementations. */
export class ServiceRegistry {
    /**
     * Detects the current streaming service from the hostname.
     *
     * @returns {import('./base-streaming-service.js').StreamingService|null}
     */
    static detect() {
        const currentHost = window.location.hostname;
        for (const service of Object.values(SERVICES)) {
            if (service.domains.some(d => currentHost === d || currentHost.endsWith(`.${d}`))) {
                return service;
            }
        }
        return null;
    }
}
