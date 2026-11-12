/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { isRecord } from '../../core/parse-utils';
import type { HttpFetchOptions } from '../../platform/adapter';

/** Message asking the background context to run storage migrations. */
export interface FMRunMigrationsMessage {
    type: 'FM_RUN_MIGRATIONS';
}

/** Message asking the background context to proxy an HTTP request. */
export interface FMFetchMessage {
    type: 'FM_FETCH';
    url: string;
    options?: HttpFetchOptions;
}

/** Message accepted by the background message listener. */
export type ExtensionMessage = FMRunMigrationsMessage | FMFetchMessage;

/**
 * Parses an untrusted runtime message into the supported message shapes.
 *
 * @param value - Raw runtime message.
 * @returns The parsed message, or undefined when the shape is invalid.
 */
export function parseExtensionMessage(value: unknown): ExtensionMessage | undefined {
    if (!isRecord(value) || typeof value.type !== 'string') return undefined;
    if (value.type === 'FM_RUN_MIGRATIONS') return { type: 'FM_RUN_MIGRATIONS' };
    if (value.type !== 'FM_FETCH' || typeof value.url !== 'string') return undefined;
    if (!('options' in value) || value.options === undefined) {
        return { type: 'FM_FETCH', url: value.url };
    }

    const options = parseFetchOptions(value.options);
    if (!options) return undefined;
    return { type: 'FM_FETCH', url: value.url, options };
}

function parseFetchOptions(value: unknown): HttpFetchOptions | undefined {
    if (!isRecord(value)) return undefined;

    const options: HttpFetchOptions = {};
    if ('responseType' in value) {
        const responseType = value.responseType;
        if (responseType !== 'json' && responseType !== 'text') return undefined;
        options.responseType = responseType;
    }
    if ('timeout' in value) {
        const timeout = value.timeout;
        if (typeof timeout !== 'number' || !Number.isFinite(timeout) || timeout < 0) return undefined;
        options.timeout = timeout;
    }
    return options;
}
