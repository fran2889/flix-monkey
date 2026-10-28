/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { StreamingService } from './base-streaming-service';
import { DisneyPlusService } from './disney-plus-service';
import { HboMaxService } from './hbo-max-service';
import { NetflixService } from './netflix-service';

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
     * @param [hostname] - Hostname to inspect; defaults to the current page hostname.
     * @returns StreamingService instance or undefined if no match found
     */
    static detect(hostname: string = window.location.hostname): StreamingService | undefined {
        for (const service of Object.values(SERVICES)) {
            if (service.domains.some(d => hostname === d || hostname.endsWith(`.${d}`))) {
                return service;
            }
        }
        return undefined;
    }
}
