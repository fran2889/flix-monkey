/**
 * SPDX-FileCopyrightText: 2026 Fran
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { config } from 'dotenv';

// Load a local .env for developer convenience. dotenv does NOT override
// variables already present in the environment, so in CI the keys supplied
// via the workflow `env:` block take precedence and .env is irrelevant
// (it is never present in CI).
config();

const REQUIRED_KEYS = ['XMDB_API_KEY', 'OMDB_API_KEY'];

const missing = REQUIRED_KEYS.filter(key => !process.env[key]);
if (missing.length > 0) {
    throw new Error(`Integration tests require ${REQUIRED_KEYS.join(', ')}; missing: ${missing.join(', ')}`);
}
