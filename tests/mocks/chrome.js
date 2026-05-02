// tests/mocks/chrome.js
export const chrome = {
  runtime: {
    getManifest: vi.fn(),
    onInstalled: { addListener: vi.fn() },
  },
};
