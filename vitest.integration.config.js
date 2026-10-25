import { defineConfig, mergeConfig } from 'vitest/config';

import baseConfig from './vitest.config.js';

// Extends the base config so shared defaults (environment, future timeouts,
// reporters, etc.) stay in sync. mergeConfig concatenates arrays, so the base
// setupFiles (./tests/setup.ts) and the integration credential guard combine.
export default mergeConfig(
    baseConfig,
    defineConfig({
        test: {
            // Live API tests keep the default pool; vmThreads targets the jsdom suites.
            pool: 'forks',
            include: ['tests/integration/**/*.test.ts'],
            setupFiles: ['./tests/integration/setup.ts'],
        },
    })
);
