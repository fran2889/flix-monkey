/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { describe, expect, it } from 'vitest';

import { ApiSource } from '../../../src/core/constants';
import { RATE_LIMIT_SYNC_KEYS } from '../../../src/core/rate-limits';

describe('RATE_LIMIT_SYNC_KEYS', () => {
    it('keeps a distinct, provider-scoped key per API source', () => {
        const keys = Object.values(RATE_LIMIT_SYNC_KEYS);

        expect(new Set(keys).size).toBe(keys.length);
        for (const source of Object.values(ApiSource)) {
            expect(RATE_LIMIT_SYNC_KEYS[source]).toContain(source);
        }
    });
});
