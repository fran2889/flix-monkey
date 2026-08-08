/**
 * SPDX-FileCopyrightText: 2026 Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { execFileSync } from 'child_process';
import { describe, expect, it } from 'vitest';

describe('update-firefox-description', () => {
    it('does not bypass credential validation when DRY_RUN is set', () => {
        const environment = { ...process.env };
        delete environment.AMO_JWT_ISSUER;
        delete environment.AMO_JWT_SECRET;
        delete environment.AMO_ADDON_ID;
        environment.DRY_RUN = 'true';

        expect(() =>
            execFileSync(process.execPath, ['scripts/update-firefox-description.js'], {
                cwd: process.cwd(),
                encoding: 'utf8',
                env: environment,
                stdio: 'pipe',
            })
        ).toThrow(/Missing or empty required environment variable: AMO_JWT_ISSUER/);
    });
});
