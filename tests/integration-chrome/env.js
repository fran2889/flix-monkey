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

config();

function parseBoolean(name, defaultValue) {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return defaultValue;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    throw new Error(`${name} must be "true" or "false"; received "${raw}"`);
}

function parseTimeout() {
    const raw = process.env.CHROME_INTEGRATION_TIMEOUT_MS ?? '30000';
    const value = Number.parseInt(raw, 10);
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`CHROME_INTEGRATION_TIMEOUT_MS must be a positive integer; received "${raw}"`);
    }
    return value;
}

export function loadChromeIntegrationEnv() {
    const netflixProfileName = process.env.NETFLIX_PROFILE_NAME;
    if (!netflixProfileName) {
        throw new Error('NETFLIX_PROFILE_NAME is required for npm run test:integration-chrome');
    }

    return {
        netflixProfileName,
        headless: parseBoolean('CHROME_INTEGRATION_HEADLESS', false),
        keepOpen: parseBoolean('CHROME_INTEGRATION_KEEP_OPEN', false),
        timeoutMs: parseTimeout(),
    };
}

export function redactEnv(env) {
    return {
        ...env,
    };
}
