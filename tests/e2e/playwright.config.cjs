const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './',
  use: {
    connectOverCDP: 'http://localhost:9222',
  },
});
