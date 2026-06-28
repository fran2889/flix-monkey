import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        exclude: ['**/node_modules/**', '**/dist/**'],
        globals: false,
        setupFiles: ['./tests/setup.js'],
        coverage: {
            thresholds: { branches: 90, statements: 90, functions: 90 },
        },
    },
});
