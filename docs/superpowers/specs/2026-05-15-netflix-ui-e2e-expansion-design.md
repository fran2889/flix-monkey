# Design Spec: Netflix UI E2E Test Expansion

## Overview

This specification expands the existing E2E testing suite to provide comprehensive coverage of FlixMonkey's UI overlays across the four primary Netflix surfaces: Browse, Search, Hover (Bob), and Preview Modal. It employs the **Surface-Object Pattern** to encapsulate complex Netflix DOM interactions and provide a stable API for test assertions.

## Architecture

The testing infrastructure leverages Playwright connecting via CDP to a real, authenticated Chrome instance.

### 1. Surface Objects

Each surface object represents a distinct Netflix UI context and manages the lifecycle of triggering and locating that context.

#### `BrowseSurface`
- **Context:** Main grid views (`/browse`, `/genre/*`).
- **Target:** `.title-card` elements.
- **Key Methods:**
    - `getTitleCards()`: Locates all visible title cards.
    - `getOverlay(card)`: Returns an `OverlayComponent` scoped to the card.

#### `SearchSurface`
- **Context:** Search results page (`/search?q=...`).
- **Target:** `[data-uia="search-gallery-video-card"]`.
- **Key Methods:**
    - `searchFor(query)`: Executes a search via URL or search bar.
    - `getResults()`: Locates gallery cards in the search grid.

#### `BobSurface`
- **Context:** The dynamic "Bob" hover card that appears over title cards.
- **Target:** `.bob-container`.
- **Key Methods:**
    - `triggerHover(card)`: Hovers a card and waits for the Bob container to be attached to the DOM and stable.

#### `PreviewModalSurface`
- **Context:** The full-screen "More Info" modal.
- **Target:** `.previewModal`.
- **Key Methods:**
    - `open(card)`: Triggers the "More Info" action and waits for the modal transition to complete.

### 2. `OverlayComponent`

A unified component used by all surfaces to verify FlixMonkey's injected rating UI.

- **Selector:** `.fm-rating-overlay`.
- **States:**
    - `Loading`: Identified by `.fm-loading`.
    - `Faded`: Identified by `.fm-faded`.
- **Assertions:**
    - `waitForLoaded()`: Retries until the loading state is cleared.
    - `getImdbValue()`: Parses the IMDb rating from the DOM.
    - `isFaded()`: Verifies if the low-rating fade effect is applied.

## Testing Strategy

### Data Determinism
To avoid flaky tests and API quota exhaustion:
- Tests will pre-seed `chrome.storage.local` with mock rating data for specific Netflix titles.
- The `SettingsUIAdapter` will be used to ensure specific features (like Fading) are enabled.

### Verification Scenarios
1. **Browse Injection:** Verify overlays appear on the standard grid.
2. **Search Results:** Verify overlays appear in search galleries.
3. **Hover Lifecycle:** Verify that hovering a card correctly injects the overlay into the Bob container.
4. **Modal Lifecycle:** Verify that opening the "More Info" modal shows the overlay.
5. **Configuration Reflectivity:** Verify that changing the `overlayCorner` in Settings moves the overlay position on Netflix (Visual check via bounding box).

## Success Criteria
- All 4 Netflix surfaces have dedicated E2E test coverage.
- Tests use real interactions (hover/click) rather than manual URL navigation where appropriate.
- Selectors are abstracted into Surface objects to minimize maintenance.
