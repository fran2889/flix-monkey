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
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './',
    // Tests connect to a running Chrome instance with the extension pre-loaded.
    // Launch Chrome with: chrome --remote-debugging-port=9222 --load-extension=dist/chrome
    use: {
        connectOverCDP: 'http://localhost:9222',
        // Give CDP-connected tests a generous timeout (network + extension init)
        actionTimeout: 10_000,
    },
    // Fail fast so we don't accidentally bill API quota on broken runs
    maxFailures: 5,
    timeout: 30_000,
    // Run tests serially — we share a single CDP browser session
    workers: 1,
    reporter: [['list'], ['html', { open: 'never' }]],
});
