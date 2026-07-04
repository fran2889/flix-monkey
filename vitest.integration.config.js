import { defineConfig, mergeConfig } from 'vitest/config';

import baseConfig from './vitest.config.js';

// Extends the base config so shared defaults (environment, future timeouts,
// reporters, etc.) stay in sync. mergeConfig concatenates arrays, so the base
// setupFiles (./tests/setup.js) and the integration credential guard combine.
export default mergeConfig(
    baseConfig,
    defineConfig({
        test: {
            include: ['tests/integration/**/*.test.js'],
            setupFiles: ['./tests/integration/setup.js'],
        },
    })
);
