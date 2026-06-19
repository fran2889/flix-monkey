import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/integration/**/*.test.js'],
        environment: 'jsdom',
        setupFiles: ['./tests/setup.js', './tests/integration/setup.js'],
    },
});
