/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it } from 'vitest';

import { parseExtensionMessage } from '../../../../src/targets/extension/messages';

describe('parseExtensionMessage', () => {
    it('accepts the migrations message', () => {
        expect(parseExtensionMessage({ type: 'FM_RUN_MIGRATIONS' })).toEqual({ type: 'FM_RUN_MIGRATIONS' });
    });

    it('accepts a fetch message without options', () => {
        expect(parseExtensionMessage({ type: 'FM_FETCH', url: 'https://xmdbapi.com' })).toEqual({
            type: 'FM_FETCH',
            url: 'https://xmdbapi.com',
        });
    });

    it('preserves valid options and ignores unknown keys', () => {
        expect(
            parseExtensionMessage({
                type: 'FM_FETCH',
                url: 'https://xmdbapi.com',
                options: { responseType: 'text', timeout: 1234, ignored: true },
            })
        ).toEqual({ type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { responseType: 'text', timeout: 1234 } });
    });

    it('preserves an empty options object', () => {
        expect(parseExtensionMessage({ type: 'FM_FETCH', url: 'https://xmdbapi.com', options: {} })).toEqual({
            type: 'FM_FETCH',
            url: 'https://xmdbapi.com',
            options: {},
        });
    });

    it('accepts a zero timeout', () => {
        expect(
            parseExtensionMessage({ type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { timeout: 0 } })
        ).toEqual({ type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { timeout: 0 } });
    });

    it.each([
        ['null', null],
        ['an array', []],
        ['a string', 'FM_FETCH'],
        ['an empty object', {}],
        ['an unknown type', { type: 'OTHER' }],
        ['a fetch message without a URL', { type: 'FM_FETCH' }],
        ['a non-string URL', { type: 'FM_FETCH', url: 42 }],
        ['numeric options', { type: 'FM_FETCH', url: 'https://xmdbapi.com', options: 42 }],
        ['null options', { type: 'FM_FETCH', url: 'https://xmdbapi.com', options: null }],
        ['array options', { type: 'FM_FETCH', url: 'https://xmdbapi.com', options: [] }],
        [
            'an unsupported responseType',
            { type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { responseType: 'xml' } },
        ],
        ['a negative timeout', { type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { timeout: -1 } }],
        ['a NaN timeout', { type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { timeout: Number.NaN } }],
        [
            'an infinite timeout',
            { type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { timeout: Number.POSITIVE_INFINITY } },
        ],
        ['a string timeout', { type: 'FM_FETCH', url: 'https://xmdbapi.com', options: { timeout: '5' } }],
    ])('rejects %s', (_label, value) => {
        expect(parseExtensionMessage(value)).toBeUndefined();
    });
});
