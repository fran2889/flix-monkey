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
