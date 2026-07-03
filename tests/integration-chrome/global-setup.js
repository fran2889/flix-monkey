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
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { loadChromeIntegrationEnv } from './env.js';

export default async function globalSetup() {
    const env = loadChromeIntegrationEnv();
    console.info('Chrome integration environment:', {
        netflixProfileName: env.netflixProfileName,
        headless: env.headless,
        keepOpen: env.keepOpen,
        timeoutMs: env.timeoutMs,
    });

    const chromiumPath = chromium.executablePath();
    if (!existsSync(chromiumPath)) {
        throw new Error(
            `Playwright Chromium not found at ${chromiumPath}. ` +
                'Run "npx playwright install chromium" to install it.'
        );
    }

    try {
        execFileSync('npm', ['run', 'build:chrome'], {
            cwd: process.cwd(),
            stdio: 'inherit',
        });
    } catch {
        throw new Error('Chrome extension build failed. Run "npm run build:chrome" manually to see errors.');
    }

    const extensionPath = resolve(process.cwd(), 'dist/chrome');
    if (!existsSync(extensionPath)) {
        throw new Error(`Chrome extension build output missing: ${extensionPath}`);
    }
}
