import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        exclude: ['**/node_modules/**', '**/dist/**'],
        globals: false,
        setupFiles: ['./tests/setup.js'],
        coverage: {
            thresholds: { functions: 90, statements: 90, branches: 90 },
        },
    },
});
