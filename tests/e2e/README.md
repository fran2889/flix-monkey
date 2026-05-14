# FlixMonkey E2E Tests

End-to-end tests use [Playwright](https://playwright.dev/) connecting to a **live Chrome instance** via Chrome DevTools Protocol (CDP).

## Prerequisites

1. **Build the extension**

    ```bash
    npm run build:chrome
    ```

2. **Launch Chrome with CDP and the extension pre-loaded**

    ```bash
    google-chrome \
      --remote-debugging-port=9222 \
      --load-extension=dist/chrome \
      --user-data-dir=/tmp/flixmonkey-e2e
    ```

    > Use a dedicated `--user-data-dir` to isolate extension storage from your personal profile.

3. **Set the extension ID** (optional — the adapter will attempt auto-detection)

    ```bash
    export FLIXMONKEY_EXT_ID=<your-extension-id>
    ```

    The ID is visible in `chrome://extensions` after loading the unpacked extension.

4. **Run the tests**

    ```bash
    npm run test:e2e
    ```

## Test Structure

| File                               | Description                                               |
| ---------------------------------- | --------------------------------------------------------- |
| `playwright.config.cjs`            | Playwright configuration (CDP connect, timeouts, workers) |
| `adapter.cjs`                      | Base `TestAdapter` interface                              |
| `adapters/userscript-adapter.cjs`  | Adapter for Tampermonkey/userscript context               |
| `adapters/settings-ui-adapter.cjs` | Adapter for the extension options page                    |
| `surfaces/browse-surface.cjs`      | Helper for Netflix browse page interactions               |
| `browse.ui.test.cjs`               | Smoke test for Netflix browse navigation                  |
| `options.ui.test.cjs`              | Full options-page UI + config persistence tests           |

## Notes

- Tests run **serially** (`workers: 1`) because they share a single browser session.
- The options-page tests write to `chrome.storage.local`; they restore values only where noted.
- Netflix tests require an active Netflix session in the connected browser.
