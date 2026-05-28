import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        exclude: ['**/node_modules/**', '**/dist/**'],
        globals: true,
        setupFiles: ['./tests/setup.js'],
        coverage: {
            thresholds: { lines: 80, functions: 80 },
        },
    },
});
