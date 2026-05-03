import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    alias: {
      '@core': '/home/fran/Projects/flix-monkey/src/core',
      '@core/': '/home/fran/Projects/flix-monkey/src/core/',
      '@platform': '/home/fran/Projects/flix-monkey/src/platform',
      '@platform/': '/home/fran/Projects/flix-monkey/src/platform/',
    },
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
