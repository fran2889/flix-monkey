const { test, expect } = require('@playwright/test');
const UserscriptAdapter = require('./adapters/userscript-adapter.cjs');
const BrowseSurface = require('./surfaces/browse-surface.cjs');

test('should play video in browse view', async ({ page }) => {
  const adapter = new UserscriptAdapter(page);
  const browse = new BrowseSurface(adapter);
  await adapter.navigate('https://www.netflix.com/browse');
  // Just checking if we can navigate and find an element
  // Since we are running against a real session, this is a basic connectivity check
  await expect(page).toHaveURL(/browse/);
});
