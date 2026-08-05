/**
 * SPDX-FileCopyrightText: 2026 Fran
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */
import '../../mocks/webextension.js';

import { describe, expect, it } from 'vitest';

describe('WebExtension Entry Point', () => {
    it('should verify manifest structure', () => {
        const manifest = require('../../../src/targets/chrome/manifest.json');
        expect(manifest.manifest_version).toBe(3);
    });
});
