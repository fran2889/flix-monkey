/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleFetchMessage } from '../../../../src/targets/extension/fetch-proxy';

const ALLOWED_URL = 'https://www.omdbapi.com/?apikey=k&i=tt0133093';

describe('handleFetchMessage', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    function stubFetch(response: Partial<Response> & { json?: () => Promise<unknown> }): ReturnType<typeof vi.fn> {
        const mock = vi.fn().mockResolvedValue(response);
        vi.stubGlobal('fetch', mock);
        return mock;
    }

    it('returns a validation error without fetching a disallowed domain', async () => {
        const fetchMock = stubFetch({ ok: true, json: () => Promise.resolve({}) });

        const result = await handleFetchMessage('https://evil.example.com/?steal=1', { responseType: 'json' });

        expect(result).toEqual({ error: 'Domain not allowed' });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns a validation error for an unparseable URL', async () => {
        const fetchMock = stubFetch({ ok: true, json: () => Promise.resolve({}) });

        const result = await handleFetchMessage('not a url', { responseType: 'json' });

        expect(result).toEqual({ error: 'Invalid URL' });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns parsed JSON for a successful response', async () => {
        stubFetch({ ok: true, status: 200, json: () => Promise.resolve({ Title: 'The Matrix' }) });

        const result = await handleFetchMessage(ALLOWED_URL, { responseType: 'json' });

        expect(result).toEqual({ data: { Title: 'The Matrix' } });
    });

    it('returns text for a successful response when responseType is text', async () => {
        stubFetch({ ok: true, status: 200, text: () => Promise.resolve('plain body') });

        const result = await handleFetchMessage(ALLOWED_URL, { responseType: 'text' });

        expect(result).toEqual({ data: 'plain body' });
    });

    it('reports an HTTP error with the status and truncated body', async () => {
        stubFetch({
            ok: false,
            status: 401,
            text: () => Promise.resolve('x'.repeat(500)),
        });

        const result = await handleFetchMessage(ALLOWED_URL, { responseType: 'json' });

        expect('error' in result).toBe(true);
        if (!('error' in result)) throw new Error('expected an error response');
        expect(result.error).toBe('HTTP 401');
        expect(result.status).toBe(401);
        expect(result.body).toHaveLength(200);
    });

    it('omits the body when an error response has none', async () => {
        stubFetch({ ok: false, status: 500, text: () => Promise.resolve('') });

        const result = await handleFetchMessage(ALLOWED_URL, { responseType: 'json' });

        expect(result).toEqual({ error: 'HTTP 500', status: 500, body: undefined });
    });

    it('omits the body when reading the error body rejects', async () => {
        stubFetch({
            ok: false,
            status: 502,
            text: () => Promise.reject(new Error('stream closed')),
        });

        const result = await handleFetchMessage(ALLOWED_URL, { responseType: 'json' });

        expect(result).toEqual({ error: 'HTTP 502', status: 502, body: undefined });
    });

    it('returns the message of a thrown Error', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

        const result = await handleFetchMessage(ALLOWED_URL, { responseType: 'json' });

        expect(result).toEqual({ error: 'network down' });
    });

    it('stringifies a non-Error rejection', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue('offline'));

        const result = await handleFetchMessage(ALLOWED_URL, { responseType: 'json' });

        expect(result).toEqual({ error: 'offline' });
    });
});
