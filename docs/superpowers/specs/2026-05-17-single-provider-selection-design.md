# Design: Single Ratings Provider Selection

## Overview
This design replaces the current automatic fallback mechanism for ratings providers with a user-selectable single provider model. Users will choose exactly one active provider from the supported list in the settings, and the extension will use only that provider.

## Goals
- Simplify the API fetching logic by removing runtime fallback.
- Provide users with predictable data sources.
- Improve system stability by reducing complexity.
- Set the default provider to IMDb API.

## Architecture Changes
### 1. Configuration
- Update the configuration UI to enforce single-selection mode for ratings providers (e.g., using a dropdown).
- The `apiClient` configuration field will store a single value (string representing the provider ID).
- Default value set to `imdbapi`.

### 2. ApiClientManager
- Modify `ApiClientManager` to hold a single client instance.
- The `getData` method will invoke the `fetch` method on this single initialized client.

## Implementation Details
- Existing client classes will remain untouched.
- `ApiClientManager` will maintain its reliance on `ApiClient` interfaces.
- Legacy configuration handling is out of scope; the default will override previous states.
