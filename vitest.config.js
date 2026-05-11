import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    alias: {
      '@core': './src/core',
      '@core/': './src/core/',
      '@platform': './src/platform',
      '@platform/': './src/platform/',
    },
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
