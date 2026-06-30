# Integration Chrome Test Design

## Overview

Add a local-only Playwright Test suite named `integration-chrome` that verifies the real Chrome extension against a live Netflix session. The suite uses a dedicated persistent Chrome or Chromium profile that the developer has already logged into Netflix.

The suite is not part of `npm test` or regular PR CI. It is an opt-in manual integration check for release confidence and local regression testing.

## Goals

- Build and load the real Chrome extension from `dist/chrome`.
- Exercise FlixMonkey on the real Netflix browse UI in a live browser.
- Verify ratings display, rating visibility settings, overlay positioning, fade settings, fade override behavior, Clear Cache, and Reset Disabled Clients.
- Keep all local machine and account details in `.env`.
- Keep rating data deterministic by seeding known cache entries for visible Netflix titles.

## Non-Goals

- Do not automate Netflix login.
- Do not run this suite in normal CI.
- Do not depend on live rating API responses for assertions.
- Do not use Chrome DevTools CLI unless a future debugging workflow needs it.

## File Layout

- `tests/integration-chrome/`
- `playwright.integration-chrome.config.js`
- `npm run test:integration-chrome`
- `.env.example` additions for local Chrome and Netflix profile settings
- README or contributor documentation for local setup

## Environment Contract

The Netflix browse URL is a code constant, not an environment variable. It should be easy to update in the test helper if Netflix routing changes.

`.env` contains only local browser, profile, and suite behavior settings:

```dotenv
CHROME_EXECUTABLE_PATH=
CHROME_USER_DATA_DIR=
CHROME_PROFILE_DIRECTORY=
NETFLIX_PROFILE_NAME=
CHROME_INTEGRATION_HEADLESS=false
CHROME_INTEGRATION_KEEP_OPEN=false
CHROME_INTEGRATION_TIMEOUT_MS=30000
```

`CHROME_EXECUTABLE_PATH` points to the local Chrome or Chromium binary. `CHROME_USER_DATA_DIR` points to a dedicated test profile directory. `CHROME_PROFILE_DIRECTORY` is optional and should be used only when the browser setup requires selecting a named Chrome profile within the user data dir. `NETFLIX_PROFILE_NAME` identifies the Netflix viewer profile to select when the profile chooser appears.

## Architecture

Use Playwright Test as the runner and browser automation layer.

The suite launches a persistent Chrome or Chromium context with the unpacked extension loaded from `dist/chrome`. Test setup runs `npm run build:chrome` before launching the browser.

Helpers should cover:

- launching the persistent browser context
- discovering the loaded extension ID
- opening the extension options page
- reading and writing extension storage
- selecting a Netflix profile when the chooser appears
- waiting for Netflix browse content
- discovering visible Netflix titles
- computing FlixMonkey cache keys with the same slug rules as production
- seeding cache entries
- waiting for Netflix reload after options save
- asserting overlay content and fade state
- collecting failure artifacts

## State Model

The suite assumes a dedicated Chrome profile for FlixMonkey integration testing.

At suite start and cleanup:

- preserve API keys:
    - `omdbApiKey`
    - `xmdbApiKey`
- remove all other option and config keys
- remove all rating cache entries with the `fmc:` prefix
- remove all fade overrides with the `fm-fade:` prefix

Tests seed known rating cache entries for visible Netflix titles. Assertions compare the rendered overlay to the seeded cache data.

Any setting changed directly in extension storage requires a Netflix page reload before assertions. Any setting changed through the options UI save flow should expect Netflix tabs to reload before assertions.

Fade override clicks are the exception: they must update the current live Netflix view immediately and must also persist after page reload.

## Test Cases

### Ratings Display And Rating Visibility Settings

- Reset extension storage to the clean test state.
- Navigate to Netflix browse and select `NETFLIX_PROFILE_NAME` if needed.
- Discover visible Netflix title surfaces.
- Seed known cache entries with IMDb, Rotten Tomatoes, and Metacritic values.
- Open the options UI.
- Enable Rotten Tomatoes and Metacritic through the UI.
- Save settings.
- Wait for the Netflix tab to reload.
- Assert IMDb, RT, and MC badges appear for seeded titles.
- Reopen the options UI.
- Disable RT and MC.
- Save settings.
- Wait for reload.
- Assert IMDb remains visible while RT and MC are hidden.

### Overlay Position Setting

- Seed at least one visible title.
- Open the options UI.
- Change `overlayCorner`.
- Save settings.
- Wait for Netflix reload.
- Assert the overlay moved to the expected corner using computed style or bounding boxes.

### Fade Threshold Settings

- Seed a visible title with a low IMDb rating.
- Open the options UI.
- Enable `enableFadeUnderRating` and set `fadeRatingThreshold` above the seeded rating.
- Save settings.
- Wait for Netflix reload.
- Assert the matching title container has `.fm-faded`.
- Reopen options.
- Disable fade or lower the threshold below the seeded rating.
- Save settings.
- Wait for reload.
- Assert `.fm-faded` is removed.

### Fade Override Behavior

- Seed a visible title with a rating that makes auto fade behavior unambiguous.
- Open the options UI.
- Enable `enableFadeToggle`.
- Save settings.
- Wait for Netflix reload.
- Open a hover or preview surface where the fade override control is shown.
- Assert the toggle starts in auto state.
- Click the toggle to `always`.
- Assert the visible title fades immediately without page reload.
- Assert `fm-fade:<slug>` is stored as `always`.
- Reload Netflix and assert the same title is still faded.
- Click the toggle to `never`.
- Assert fade is removed immediately.
- Assert `fm-fade:<slug>` is stored as `never`.
- Reload Netflix and assert the same title is still not faded.
- Click the toggle back to auto.
- Assert `fm-fade:<slug>` is removed.
- Assert auto fade behavior applies immediately.
- Reload Netflix and assert auto fade behavior still applies.

### Settings Maintenance Buttons

Clear Cache:

- Seed rating cache entries.
- Open the options UI.
- Click Clear Cache.
- Assert success status is shown.
- Assert all `fmc:*` keys are removed.
- Reload Netflix and assert seeded cached ratings are gone until the test seeds them again.

Reset Disabled Clients:

- Seed disabled-client storage keys using the same prefix and value shape as production.
- Open the options UI.
- Click Reset Disabled Clients.
- Assert success or reset status is shown.
- Assert disabled-client keys are removed.

### Profile And Login Guard

- Fail fast if Chrome cannot launch with the configured profile.
- Fail fast if the extension is not loaded.
- Fail fast if Netflix shows a logged-out page.
- If the profile chooser appears, select `NETFLIX_PROFILE_NAME`.
- Fail with a clear message if the configured Netflix profile is not found.
- Fail with a clear message if no discoverable Netflix title surfaces appear.

## Failure Artifacts

On failure, collect:

- screenshot
- Playwright trace
- relevant console logs from Netflix and extension/options pages
- redacted extension storage dump when useful

API key values must be redacted in all logs and dumps.

## Documentation

Document the suite as a local manual integration test:

- how to create a dedicated Chrome profile
- how to log into Netflix before running tests
- how to populate `.env`
- how to run `npm run test:integration-chrome`
- what the suite resets in extension storage
- how `CHROME_INTEGRATION_KEEP_OPEN` affects debugging and cleanup

## Open Implementation Notes

- Prefer stable helper functions over embedding Netflix selectors throughout tests.
- Keep all extension storage manipulation behind a small helper so key prefixes and redaction rules are centralized.
- Use seeded cache data instead of live API responses for deterministic assertions.
- Prefer Playwright Test fixtures for browser context, extension ID, Netflix page, and options page lifecycle. Use global setup only for one-time build and environment validation.
