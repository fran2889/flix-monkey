/**
 * Copyright (C) 2026 Fran
 *
 * This file is part of FlixMonkey.
 *
 * FlixMonkey is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * FlixMonkey is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * FlixMonkey. If not, see <https://www.gnu.org/licenses/>.
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
