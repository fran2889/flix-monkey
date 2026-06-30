import { defineConfig } from '@playwright/test';
import { loadChromeIntegrationEnv } from './tests/integration-chrome/env.js';

const env = loadChromeIntegrationEnv();

export default defineConfig({
    testDir: './tests/integration-chrome',
    testMatch: '**/*.chrome.test.js',
    globalSetup: './tests/integration-chrome/global-setup.js',
    fullyParallel: false,
    workers: 1,
    timeout: env.timeoutMs,
    expect: {
        timeout: env.timeoutMs,
    },
    reporter: [['list'], ['html', { outputFolder: 'playwright-report/integration-chrome', open: 'never' }]],
    use: {
        actionTimeout: env.timeoutMs,
        navigationTimeout: env.timeoutMs,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        video: 'retain-on-failure',
    },
});
