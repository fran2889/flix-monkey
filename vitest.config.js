import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        exclude: ['**/node_modules/**', '**/dist/**'],
        globals: false,
        setupFiles: ['./tests/setup.js'],
        coverage: {
            thresholds: { lines: 90, functions: 90, statements: 97, branches: 90 },
        },
    },
});
