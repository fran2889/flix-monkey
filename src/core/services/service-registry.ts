/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { StreamingService } from './base-streaming-service.js';
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
     * @returns StreamingService instance or null if no match found
     */
    static detect(): StreamingService | null {
        const currentHost: string = window.location.hostname;
        for (const service of Object.values(SERVICES)) {
            if (service.domains.some(d => currentHost === d || currentHost.endsWith(`.${d}`))) {
                return service;
            }
        }
        return null;
    }
}
